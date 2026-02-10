//! Dev playground at `~/.amber-dev/` — one job, ~20K real files, multiple snapshots.

use crate::error::{AmberError, Result};
use crate::services::index_service::IndexService;
use crate::services::manifest_service;
use crate::services::store::Store;
use crate::types::job::{DestinationType, JobStatus, RsyncConfig, SyncJob, SyncMode};
use crate::types::manifest::{ManifestSnapshot, ManifestSnapshotStatus};
use rand::Rng;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use std::time::Instant;

const JOB_ID: &str = "dev-backup";
const JOB_NAME: &str = "Dev Backup";
const SOURCE_DIR: &str = "source";
const BACKUP_DIR: &str = "backup";
/// Number of snapshots to create during seed (with churn between each)
const SEED_SNAPSHOTS: usize = 3;

#[derive(Debug, Clone, serde::Serialize)]
pub struct SeedResult {
    pub jobs_created: usize,
    pub snapshots_created: usize,
    pub files_created: usize,
    pub total_size_bytes: u64,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct BenchmarkResult {
    pub operation: String,
    pub iterations: usize,
    pub avg_ms: f64,
    pub min_ms: f64,
    pub max_ms: f64,
    pub total_ms: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ChurnResult {
    pub added: usize,
    pub modified: usize,
    pub deleted: usize,
}

pub struct DevSeeder {
    store: Arc<Store>,
    #[allow(dead_code)]
    app_data_path: PathBuf,
}

fn playground_root() -> PathBuf {
    dirs::home_dir()
        .expect("No home directory found")
        .join(".amber-dev")
}

impl DevSeeder {
    pub fn new(
        _index_service: &Arc<IndexService>,
        store: &Arc<Store>,
        app_data_path: PathBuf,
    ) -> Self {
        Self {
            store: Arc::clone(store),
            app_data_path,
        }
    }

    pub fn with_mock_data_path(self, _path: PathBuf) -> Self {
        self
    }

    pub fn is_seeded(&self) -> Result<bool> {
        let jobs = self.store.load_jobs()?;
        Ok(jobs.iter().any(|j| j.id == JOB_ID))
    }

    /// Create playground: ~20K source files, then 3 snapshots with churn between each.
    pub fn seed(&mut self) -> Result<SeedResult> {
        if self.is_seeded()? {
            return Ok(SeedResult {
                jobs_created: 0,
                snapshots_created: 0,
                files_created: 0,
                total_size_bytes: 0,
                duration_ms: 0,
            });
        }

        let start = Instant::now();
        let root = playground_root();
        let source = root.join(SOURCE_DIR);
        let dest = root.join(BACKUP_DIR);

        fs::create_dir_all(&source).map_err(AmberError::Io)?;
        fs::create_dir_all(&dest).map_err(AmberError::Io)?;

        let source_s = source.to_string_lossy().to_string();
        let dest_s = dest.to_string_lossy().to_string();

        // Create the source tree (~20K files)
        log::info!("Creating ~20K source files...");
        let file_count = create_source_tree(&source)?;
        log::info!("Created {} source files", file_count);

        // Create manifest
        let machine_id = crate::utils::get_machine_id();
        let mut manifest = crate::types::manifest::BackupManifest::new(
            JOB_ID.to_string(),
            JOB_NAME.to_string(),
            source_s.clone(),
            machine_id,
        );

        // Open the destination index once
        let meta_dir = manifest_service::get_meta_dir(&dest_s);
        fs::create_dir_all(&meta_dir).map_err(AmberError::Io)?;
        let dest_index = IndexService::for_destination(&dest_s)?;

        let mut total_size = 0u64;

        // Create multiple snapshots with churn between each
        for snap_i in 0..SEED_SNAPSHOTS {
            if snap_i > 0 {
                // Churn between snapshots
                log::info!("Applying churn before snapshot {}...", snap_i + 1);
                let _ = churn_source(&source, 200, 100, 50)?;
                // Small delay so folder names differ
                std::thread::sleep(std::time::Duration::from_secs(1));
            }

            let folder = chrono::Utc::now().format("%Y-%m-%d-%H%M%S").to_string();
            let snap_dir = dest.join(&folder);

            log::info!("Running rsync for snapshot {} ({})...", snap_i + 1, folder);
            run_rsync(&source, &snap_dir)?;

            let snap_size = dir_size(&snap_dir);
            let snap_files = count_files(&snap_dir);
            total_size += snap_size;

            // Use a single timestamp for both manifest and index
            let ts = chrono::Utc::now().timestamp_millis();

            let snapshot = ManifestSnapshot {
                id: ts.to_string(),
                timestamp: ts,
                folder_name: folder.clone(),
                file_count: snap_files,
                total_size: snap_size,
                status: ManifestSnapshotStatus::Complete,
                duration_ms: Some(start.elapsed().as_millis() as u64),
                changes_count: if snap_i > 0 { Some(350) } else { None },
            };
            manifest.add_snapshot(snapshot);

            // Index with the SAME timestamp
            dest_index.index_snapshot(JOB_ID, ts, &snap_dir.to_string_lossy())?;

            log::info!(
                "Snapshot {}: {} files, {} bytes",
                snap_i + 1,
                snap_files,
                snap_size
            );
        }

        // Write manifest
        let manifest_json = serde_json::to_string_pretty(&manifest)
            .map_err(|e| AmberError::Store(format!("Manifest serialize: {}", e)))?;
        fs::write(manifest_service::get_manifest_path(&dest_s), manifest_json)
            .map_err(AmberError::Io)?;

        // Register job
        self.store.save_job(SyncJob {
            id: JOB_ID.to_string(),
            name: JOB_NAME.to_string(),
            source_path: source_s,
            dest_path: dest_s,
            mode: SyncMode::TimeMachine,
            status: JobStatus::Idle,
            destination_type: Some(DestinationType::Local),
            config: RsyncConfig::default(),
            ..SyncJob::default()
        })?;

        let duration = start.elapsed();
        log::info!(
            "Seeding complete: {} files, {} snapshots in {:.1}s",
            file_count,
            SEED_SNAPSHOTS,
            duration.as_secs_f64()
        );

        Ok(SeedResult {
            jobs_created: 1,
            snapshots_created: SEED_SNAPSHOTS,
            files_created: file_count,
            total_size_bytes: total_size,
            duration_ms: duration.as_millis() as u64,
        })
    }

    /// Add/modify/delete files in the source directory.
    pub fn churn(&self) -> Result<ChurnResult> {
        let jobs = self.store.load_jobs()?;
        let job = jobs
            .iter()
            .find(|j| j.id == JOB_ID)
            .ok_or_else(|| AmberError::Job("No dev job. Seed first.".to_string()))?;

        let source = Path::new(&job.source_path);
        if !source.exists() {
            return Err(AmberError::Job(format!(
                "Source missing: {}",
                job.source_path
            )));
        }

        churn_source(source, 200, 100, 50)
    }

    /// Remove dev job and delete `~/.amber-dev/`.
    pub fn clear(&self) -> Result<()> {
        let jobs = self.store.load_jobs()?;
        for job in &jobs {
            if job.id == JOB_ID {
                self.store.delete_job(&job.id)?;
            }
        }
        let root = playground_root();
        if root.exists() {
            fs::remove_dir_all(&root).map_err(AmberError::Io)?;
        }
        Ok(())
    }

    pub fn run_benchmarks(&self) -> Result<Vec<BenchmarkResult>> {
        let jobs = self.store.load_jobs()?;
        let job = jobs
            .iter()
            .find(|j| j.id == JOB_ID)
            .ok_or_else(|| AmberError::Index("No dev job for benchmarks".to_string()))?;

        let idx = IndexService::for_destination(&job.dest_path)?;
        let n = 100;

        Ok(vec![
            bench("list_snapshots", n, || {
                idx.list_snapshots(JOB_ID)?;
                Ok(())
            })?,
            bench("directory_contents", n, || {
                let snaps = idx.list_snapshots(JOB_ID)?;
                if let Some(s) = snaps.first() {
                    idx.get_directory_contents(JOB_ID, s.timestamp, "")?;
                }
                Ok(())
            })?,
            bench("fts_search", n, || {
                idx.search_files_global("readme", None, 50)?;
                Ok(())
            })?,
            bench("snapshot_stats", n, || {
                let snaps = idx.list_snapshots(JOB_ID)?;
                if let Some(s) = snaps.first() {
                    idx.get_snapshot_stats(JOB_ID, s.timestamp)?;
                }
                Ok(())
            })?,
        ])
    }
}

// =============================================================================
// Source tree — ~20,000 files in a realistic monorepo layout
// =============================================================================

/// Create ~20,000 files organized as a realistic monorepo.
/// Target: mix of source code, configs, docs, images, data files.
fn create_source_tree(root: &Path) -> std::io::Result<usize> {
    let mut rng = rand::rng();
    let mut count = 0;

    // ---- apps/web (frontend) — ~4000 .tsx/.ts/.css files ----
    let web_dirs = [
        "apps/web/src/components/ui",
        "apps/web/src/components/layout",
        "apps/web/src/components/forms",
        "apps/web/src/components/data",
        "apps/web/src/components/navigation",
        "apps/web/src/components/modals",
        "apps/web/src/components/charts",
        "apps/web/src/components/cards",
        "apps/web/src/hooks",
        "apps/web/src/utils",
        "apps/web/src/context",
        "apps/web/src/pages",
        "apps/web/src/styles",
        "apps/web/src/types",
        "apps/web/src/api",
        "apps/web/src/features/auth",
        "apps/web/src/features/dashboard",
        "apps/web/src/features/settings",
        "apps/web/src/features/profile",
        "apps/web/src/features/notifications",
        "apps/web/public",
        "apps/web/tests/unit",
        "apps/web/tests/integration",
        "apps/web/tests/e2e",
    ];
    for d in &web_dirs {
        fs::create_dir_all(root.join(d))?;
    }
    // Components — 250 per component dir (8 dirs = 2000)
    let component_dirs = [
        "apps/web/src/components/ui",
        "apps/web/src/components/layout",
        "apps/web/src/components/forms",
        "apps/web/src/components/data",
        "apps/web/src/components/navigation",
        "apps/web/src/components/modals",
        "apps/web/src/components/charts",
        "apps/web/src/components/cards",
    ];
    for dir in &component_dirs {
        count += gen_tsx_files(root, dir, 250, &mut rng)?;
    }
    // Hooks, utils, context, pages, types, api
    count += gen_ts_files(root, "apps/web/src/hooks", 80, "hook", &mut rng)?;
    count += gen_ts_files(root, "apps/web/src/utils", 60, "util", &mut rng)?;
    count += gen_tsx_files(root, "apps/web/src/context", 20, &mut rng)?;
    count += gen_tsx_files(root, "apps/web/src/pages", 40, &mut rng)?;
    count += gen_ts_files(root, "apps/web/src/types", 30, "type", &mut rng)?;
    count += gen_ts_files(root, "apps/web/src/api", 25, "client", &mut rng)?;
    // Features
    for feat in ["auth", "dashboard", "settings", "profile", "notifications"] {
        count += gen_tsx_files(
            root,
            &format!("apps/web/src/features/{}", feat),
            30,
            &mut rng,
        )?;
    }
    // CSS
    count += gen_css_files(root, "apps/web/src/styles", 40, &mut rng)?;
    // Tests
    count += gen_ts_files(root, "apps/web/tests/unit", 200, "test", &mut rng)?;
    count += gen_ts_files(root, "apps/web/tests/integration", 80, "test", &mut rng)?;
    count += gen_ts_files(root, "apps/web/tests/e2e", 40, "spec", &mut rng)?;

    // ---- apps/api (backend) — ~3000 .py files ----
    let api_dirs = [
        "apps/api/src/routes",
        "apps/api/src/models",
        "apps/api/src/services",
        "apps/api/src/middleware",
        "apps/api/src/schemas",
        "apps/api/src/tasks",
        "apps/api/src/utils",
        "apps/api/migrations",
        "apps/api/tests/unit",
        "apps/api/tests/integration",
    ];
    for d in &api_dirs {
        fs::create_dir_all(root.join(d))?;
    }
    count += gen_py_files(root, "apps/api/src/routes", 200, &mut rng)?;
    count += gen_py_files(root, "apps/api/src/models", 150, &mut rng)?;
    count += gen_py_files(root, "apps/api/src/services", 200, &mut rng)?;
    count += gen_py_files(root, "apps/api/src/middleware", 50, &mut rng)?;
    count += gen_py_files(root, "apps/api/src/schemas", 150, &mut rng)?;
    count += gen_py_files(root, "apps/api/src/tasks", 80, &mut rng)?;
    count += gen_py_files(root, "apps/api/src/utils", 60, &mut rng)?;
    count += gen_sql_files(root, "apps/api/migrations", 100, &mut rng)?;
    count += gen_py_files(root, "apps/api/tests/unit", 300, &mut rng)?;
    count += gen_py_files(root, "apps/api/tests/integration", 100, &mut rng)?;

    // ---- apps/mobile — ~1500 .tsx files ----
    let mobile_dirs = [
        "apps/mobile/src/screens",
        "apps/mobile/src/components",
        "apps/mobile/src/navigation",
        "apps/mobile/src/hooks",
        "apps/mobile/src/services",
        "apps/mobile/src/utils",
    ];
    for d in &mobile_dirs {
        fs::create_dir_all(root.join(d))?;
    }
    count += gen_tsx_files(root, "apps/mobile/src/screens", 200, &mut rng)?;
    count += gen_tsx_files(root, "apps/mobile/src/components", 500, &mut rng)?;
    count += gen_tsx_files(root, "apps/mobile/src/navigation", 30, &mut rng)?;
    count += gen_ts_files(root, "apps/mobile/src/hooks", 50, "hook", &mut rng)?;
    count += gen_ts_files(root, "apps/mobile/src/services", 40, "service", &mut rng)?;
    count += gen_ts_files(root, "apps/mobile/src/utils", 30, "util", &mut rng)?;

    // ---- packages/ui — ~1500 shared UI components ----
    let ui_dirs = [
        "packages/ui/src/atoms",
        "packages/ui/src/molecules",
        "packages/ui/src/organisms",
        "packages/ui/src/templates",
        "packages/ui/src/tokens",
        "packages/ui/stories",
    ];
    for d in &ui_dirs {
        fs::create_dir_all(root.join(d))?;
    }
    count += gen_tsx_files(root, "packages/ui/src/atoms", 300, &mut rng)?;
    count += gen_tsx_files(root, "packages/ui/src/molecules", 300, &mut rng)?;
    count += gen_tsx_files(root, "packages/ui/src/organisms", 200, &mut rng)?;
    count += gen_tsx_files(root, "packages/ui/src/templates", 50, &mut rng)?;
    count += gen_ts_files(root, "packages/ui/src/tokens", 20, "token", &mut rng)?;
    count += gen_tsx_files(root, "packages/ui/stories", 200, &mut rng)?;

    // ---- packages/utils — ~500 .ts files ----
    let util_dirs = [
        "packages/utils/src/string",
        "packages/utils/src/date",
        "packages/utils/src/math",
        "packages/utils/src/array",
        "packages/utils/src/async",
        "packages/utils/src/validation",
    ];
    for d in &util_dirs {
        fs::create_dir_all(root.join(d))?;
    }
    for dir in &util_dirs {
        count += gen_ts_files(root, dir, 80, "util", &mut rng)?;
    }

    // ---- packages/config — ~200 config files ----
    fs::create_dir_all(root.join("packages/config"))?;
    count += gen_json_files(root, "packages/config", 100, &mut rng)?;
    count += gen_yaml_files(root, "packages/config", 50, &mut rng)?;
    count += gen_toml_files(root, "packages/config", 50, &mut rng)?;

    // ---- docs — ~500 .md files ----
    let doc_dirs = [
        "docs/architecture",
        "docs/guides",
        "docs/api-reference",
        "docs/tutorials",
        "docs/rfcs",
        "docs/adr",
    ];
    for d in &doc_dirs {
        fs::create_dir_all(root.join(d))?;
    }
    for dir in &doc_dirs {
        count += gen_md_files(root, dir, 80, &mut rng)?;
    }

    // ---- scripts — ~100 files ----
    fs::create_dir_all(root.join("scripts/ci"))?;
    fs::create_dir_all(root.join("scripts/dev"))?;
    fs::create_dir_all(root.join("scripts/deploy"))?;
    count += gen_sh_files(root, "scripts/ci", 30, &mut rng)?;
    count += gen_sh_files(root, "scripts/dev", 30, &mut rng)?;
    count += gen_sh_files(root, "scripts/deploy", 30, &mut rng)?;

    // ---- data — ~500 files (CSV, JSON) ----
    fs::create_dir_all(root.join("data/exports"))?;
    fs::create_dir_all(root.join("data/fixtures"))?;
    fs::create_dir_all(root.join("data/seeds"))?;
    count += gen_csv_files(root, "data/exports", 150, &mut rng)?;
    count += gen_json_files(root, "data/fixtures", 200, &mut rng)?;
    count += gen_json_files(root, "data/seeds", 100, &mut rng)?;

    // ---- assets — ~800 binary-ish files (images, fonts, etc) ----
    let asset_dirs = [
        "assets/images/icons",
        "assets/images/photos",
        "assets/images/illustrations",
        "assets/fonts",
        "assets/videos",
    ];
    for d in &asset_dirs {
        fs::create_dir_all(root.join(d))?;
    }
    count += gen_binary_files(
        root,
        "assets/images/icons",
        200,
        "svg",
        200..2_000,
        &mut rng,
    )?;
    count += gen_binary_files(
        root,
        "assets/images/photos",
        200,
        "jpg",
        10_000..200_000,
        &mut rng,
    )?;
    count += gen_binary_files(
        root,
        "assets/images/illustrations",
        100,
        "png",
        5_000..100_000,
        &mut rng,
    )?;
    count += gen_binary_files(root, "assets/fonts", 30, "woff2", 20_000..80_000, &mut rng)?;
    count += gen_binary_files(root, "assets/videos", 10, "mp4", 100_000..500_000, &mut rng)?;

    // ---- config (root) — project configs ----
    fs::create_dir_all(root.join("config/env"))?;
    let root_configs: &[(&str, &[u8])] = &[
        ("package.json", br#"{"name":"monorepo","version":"2.0.0","private":true,"workspaces":["apps/*","packages/*"]}"#),
        ("tsconfig.json", br#"{"compilerOptions":{"target":"ES2022","strict":true,"jsx":"react-jsx","paths":{"@/*":["./apps/web/src/*"]}}}"#),
        ("turbo.json", br#"{"$schema":"https://turbo.build/schema.json","pipeline":{"build":{"outputs":["dist/**"]},"dev":{"cache":false}}}"#),
        (".gitignore", b"node_modules/\ndist/\n.env\n.env.local\ncoverage/\n.turbo/\n"),
        (".eslintrc.json", br#"{"extends":["next/core-web-vitals","prettier"],"rules":{"no-unused-vars":"warn"}}"#),
        (".prettierrc", br#"{"semi":true,"singleQuote":true,"tabWidth":2,"trailingComma":"all"}"#),
        ("Dockerfile", b"FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci && npm run build\nEXPOSE 3000\nCMD [\"node\",\"dist/server.js\"]\n"),
        ("docker-compose.yml", b"services:\n  app:\n    build: .\n    ports: ['3000:3000']\n    depends_on: [db, redis]\n  db:\n    image: postgres:16\n  redis:\n    image: redis:7\n"),
        ("Makefile", b".PHONY: dev build test deploy\ndev:\n\tnpx turbo dev\nbuild:\n\tnpx turbo build\ntest:\n\tnpx turbo test\n"),
        ("README.md", b"# Monorepo\n\nFull-stack application with web, API, and mobile apps.\n\n## Quick Start\n\n```bash\nnpm install\nnpm run dev\n```\n"),
    ];
    for (name, content) in root_configs {
        fs::write(root.join(name), content)?;
        count += 1;
    }
    count += gen_env_files(root, "config/env", 20, &mut rng)?;

    Ok(count)
}

// =============================================================================
// File generators — each creates N files of a specific type
// =============================================================================

fn gen_tsx_files(root: &Path, dir: &str, n: usize, rng: &mut impl Rng) -> std::io::Result<usize> {
    let names = [
        "Button",
        "Card",
        "Modal",
        "Table",
        "Input",
        "Select",
        "Header",
        "Footer",
        "Nav",
        "Badge",
        "Alert",
        "Toast",
        "Tooltip",
        "Popover",
        "Tabs",
        "Accordion",
        "Menu",
        "Drawer",
        "Dialog",
        "Form",
        "List",
        "Grid",
        "Stack",
        "Container",
        "Section",
        "Panel",
        "Widget",
        "Item",
        "Row",
        "Cell",
    ];
    for i in 0..n {
        let base = names[i % names.len()];
        let suffix = if i >= names.len() {
            format!("{}", i)
        } else {
            String::new()
        };
        let size = rng.random_range(300..3000);
        let mut content = format!(
            "import React from 'react';\n\ninterface {base}{suffix}Props {{\n  className?: string;\n  children?: React.ReactNode;\n}}\n\nexport const {base}{suffix}: React.FC<{base}{suffix}Props> = ({{ className, children }}) => (\n  <div className={{className}}>{{children}}</div>\n);\n"
        ).into_bytes();
        pad_content(&mut content, size, rng);
        fs::write(root.join(format!("{dir}/{base}{suffix}.tsx")), &content)?;
    }
    Ok(n)
}

fn gen_ts_files(
    root: &Path,
    dir: &str,
    n: usize,
    kind: &str,
    rng: &mut impl Rng,
) -> std::io::Result<usize> {
    let names = [
        "auth", "api", "theme", "debounce", "storage", "fetch", "format", "validate", "logger",
        "cache", "event", "queue", "retry", "timer", "config", "state", "router", "i18n", "crypto",
        "sort",
    ];
    for i in 0..n {
        let base = names[i % names.len()];
        let suffix = if i >= names.len() {
            format!("{}", i)
        } else {
            String::new()
        };
        let size = rng.random_range(200..2000);
        let mut content = format!(
            "// {kind}: {base}{suffix}\nexport function {base}{suffix}() {{\n  return null;\n}}\n"
        )
        .into_bytes();
        pad_content(&mut content, size, rng);
        let ext = if kind == "test" || kind == "spec" {
            format!(".{kind}.ts")
        } else {
            ".ts".to_string()
        };
        fs::write(root.join(format!("{dir}/{base}{suffix}{ext}")), &content)?;
    }
    Ok(n)
}

fn gen_py_files(root: &Path, dir: &str, n: usize, rng: &mut impl Rng) -> std::io::Result<usize> {
    let names = [
        "routes",
        "models",
        "schemas",
        "middleware",
        "auth",
        "database",
        "utils",
        "config",
        "tasks",
        "events",
        "handlers",
        "serializers",
        "validators",
        "services",
        "cache",
        "workers",
        "celery",
        "signals",
        "permissions",
        "views",
    ];
    for i in 0..n {
        let base = names[i % names.len()];
        let suffix = if i >= names.len() {
            format!("_{}", i)
        } else {
            String::new()
        };
        let size = rng.random_range(300..3000);
        let cap = capitalize(base);
        let mut content = format!(
            "\"\"\"Module {base}{suffix}.\"\"\"\nfrom typing import Optional, Dict, Any\n\nclass {cap}{suffix}Service:\n    def __init__(self):\n        self._cache = {{}}\n\n    async def process(self, data: Dict[str, Any]) -> Dict[str, Any]:\n        return {{\"status\": \"ok\", \"data\": data}}\n"
        ).into_bytes();
        pad_content(&mut content, size, rng);
        fs::write(root.join(format!("{dir}/{base}{suffix}.py")), &content)?;
    }
    Ok(n)
}

fn gen_css_files(root: &Path, dir: &str, n: usize, rng: &mut impl Rng) -> std::io::Result<usize> {
    let names = [
        "globals",
        "reset",
        "tokens",
        "layout",
        "components",
        "utilities",
        "animations",
        "responsive",
        "theme-light",
        "theme-dark",
    ];
    for i in 0..n {
        let base = names[i % names.len()];
        let suffix = if i >= names.len() {
            format!("-{}", i)
        } else {
            String::new()
        };
        let size = rng.random_range(200..2000);
        let mut content = format!(
            "/* {base}{suffix} */\n:root {{\n  --color-primary: #3b82f6;\n  --radius: 8px;\n}}\n.{base} {{\n  display: flex;\n}}\n"
        ).into_bytes();
        pad_content(&mut content, size, rng);
        fs::write(root.join(format!("{dir}/{base}{suffix}.css")), &content)?;
    }
    Ok(n)
}

fn gen_sql_files(root: &Path, dir: &str, n: usize, _rng: &mut impl Rng) -> std::io::Result<usize> {
    let tables = [
        "users",
        "posts",
        "comments",
        "tags",
        "sessions",
        "audit_log",
        "teams",
        "roles",
        "permissions",
        "invites",
        "notifications",
        "webhooks",
        "api_keys",
        "rate_limits",
        "jobs",
    ];
    for i in 0..n {
        let table = tables[i % tables.len()];
        let num = format!("{:04}", i + 1);
        let content = format!(
            "-- Migration {num}: {table}\nCREATE TABLE IF NOT EXISTS {table} (\n    id SERIAL PRIMARY KEY,\n    created_at TIMESTAMPTZ DEFAULT NOW(),\n    updated_at TIMESTAMPTZ DEFAULT NOW()\n);\nCREATE INDEX idx_{table}_created ON {table}(created_at);\n"
        );
        fs::write(root.join(format!("{dir}/{num}_{table}.sql")), content)?;
    }
    Ok(n)
}

fn gen_md_files(root: &Path, dir: &str, n: usize, rng: &mut impl Rng) -> std::io::Result<usize> {
    let names = [
        "overview",
        "getting-started",
        "architecture",
        "deployment",
        "testing",
        "security",
        "performance",
        "monitoring",
        "contributing",
        "troubleshooting",
        "faq",
        "changelog",
        "migration",
        "api-design",
        "data-model",
    ];
    for i in 0..n {
        let base = names[i % names.len()];
        let suffix = if i >= names.len() {
            format!("-{}", i)
        } else {
            String::new()
        };
        let size = rng.random_range(500..5000);
        let cap = capitalize(base);
        let mut content = format!(
            "# {cap}{suffix}\n\n## Overview\n\nDocumentation for {base}{suffix}.\n\n## Details\n\n- Point one\n- Point two\n- Point three\n\n## Examples\n\n```typescript\nconst example = true;\n```\n"
        ).into_bytes();
        pad_content(&mut content, size, rng);
        fs::write(root.join(format!("{dir}/{base}{suffix}.md")), &content)?;
    }
    Ok(n)
}

fn gen_json_files(root: &Path, dir: &str, n: usize, rng: &mut impl Rng) -> std::io::Result<usize> {
    for i in 0..n {
        let size = rng.random_range(100..5000);
        // Generate a realistic-ish JSON blob
        let mut content = format!(
            "{{\n  \"id\": {i},\n  \"name\": \"item-{i}\",\n  \"active\": true,\n  \"tags\": [\"a\", \"b\"],\n  \"metadata\": {{}}\n}}\n"
        ).into_bytes();
        pad_content(&mut content, size, rng);
        fs::write(root.join(format!("{dir}/data-{i:04}.json")), &content)?;
    }
    Ok(n)
}

fn gen_yaml_files(root: &Path, dir: &str, n: usize, rng: &mut impl Rng) -> std::io::Result<usize> {
    for i in 0..n {
        let size = rng.random_range(100..2000);
        let mut content = format!(
            "# config-{i}\nname: service-{i}\nversion: 1.0.{i}\nenabled: true\nreplicas: 3\n"
        )
        .into_bytes();
        pad_content(&mut content, size, rng);
        fs::write(root.join(format!("{dir}/config-{i:03}.yaml")), &content)?;
    }
    Ok(n)
}

fn gen_toml_files(root: &Path, dir: &str, n: usize, rng: &mut impl Rng) -> std::io::Result<usize> {
    for i in 0..n {
        let size = rng.random_range(100..1500);
        let mut content = format!(
            "[package]\nname = \"pkg-{i}\"\nversion = \"0.{i}.0\"\n\n[dependencies]\nserde = \"1.0\"\n"
        ).into_bytes();
        pad_content(&mut content, size, rng);
        fs::write(root.join(format!("{dir}/pkg-{i:03}.toml")), &content)?;
    }
    Ok(n)
}

fn gen_sh_files(root: &Path, dir: &str, n: usize, rng: &mut impl Rng) -> std::io::Result<usize> {
    let names = [
        "build", "deploy", "test", "lint", "format", "setup", "migrate", "seed", "backup", "clean",
    ];
    for i in 0..n {
        let base = names[i % names.len()];
        let suffix = if i >= names.len() {
            format!("-{}", i)
        } else {
            String::new()
        };
        let size = rng.random_range(100..1000);
        let mut content = format!(
            "#!/bin/bash\nset -euo pipefail\n\n# {base}{suffix}\necho \"Running {base}{suffix}...\"\n"
        ).into_bytes();
        pad_content(&mut content, size, rng);
        fs::write(root.join(format!("{dir}/{base}{suffix}.sh")), &content)?;
    }
    Ok(n)
}

fn gen_csv_files(root: &Path, dir: &str, n: usize, rng: &mut impl Rng) -> std::io::Result<usize> {
    for i in 0..n {
        let rows = rng.random_range(50..500);
        let mut content = String::from("id,name,email,created_at,score\n");
        for r in 0..rows {
            content.push_str(&format!(
                "{r},user-{r},user{r}@example.com,2025-01-{:02},{}.\n",
                (r % 28) + 1,
                rng.random_range(0..100)
            ));
        }
        fs::write(root.join(format!("{dir}/export-{i:04}.csv")), content)?;
    }
    Ok(n)
}

fn gen_env_files(root: &Path, dir: &str, n: usize, _rng: &mut impl Rng) -> std::io::Result<usize> {
    let envs = [
        "development",
        "staging",
        "production",
        "test",
        "ci",
        "local",
        "preview",
    ];
    for i in 0..n {
        let env = envs[i % envs.len()];
        let suffix = if i >= envs.len() {
            format!(".{}", i)
        } else {
            String::new()
        };
        let content = format!(
            "# {env}{suffix} environment\nDATABASE_URL=postgresql://localhost:5432/app_{env}\nREDIS_URL=redis://localhost:6379/{i}\nAPI_KEY=key-{env}-{i:04}\nLOG_LEVEL=info\n"
        );
        fs::write(root.join(format!("{dir}/.env.{env}{suffix}")), content)?;
    }
    Ok(n)
}

fn gen_binary_files(
    root: &Path,
    dir: &str,
    n: usize,
    ext: &str,
    size_range: std::ops::Range<usize>,
    rng: &mut impl Rng,
) -> std::io::Result<usize> {
    for i in 0..n {
        let size = rng.random_range(size_range.clone());
        let mut data = vec![0u8; size];
        // Fill in chunks for speed
        for chunk in data.chunks_mut(256) {
            rng.fill(chunk);
        }
        // Add magic bytes for common formats
        match ext {
            "jpg" => {
                if data.len() >= 3 {
                    data[0] = 0xFF;
                    data[1] = 0xD8;
                    data[2] = 0xFF;
                }
            }
            "png" => {
                if data.len() >= 8 {
                    data[..8].copy_from_slice(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
                }
            }
            "svg" => {
                data = format!("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"{}\"/></svg>", i % 12 + 1).into_bytes();
            }
            _ => {}
        }
        fs::write(root.join(format!("{dir}/asset-{i:04}.{ext}")), &data)?;
    }
    Ok(n)
}

/// Pad content to target size with realistic filler (comments/whitespace).
fn pad_content(content: &mut Vec<u8>, target: usize, rng: &mut impl Rng) {
    while content.len() < target {
        let line = format!("// line-{}\n", rng.random_range(0u32..99999));
        content.extend_from_slice(line.as_bytes());
    }
    content.truncate(target);
}

// =============================================================================
// Churn
// =============================================================================

fn churn_source(source: &Path, add: usize, modify: usize, delete: usize) -> Result<ChurnResult> {
    let mut rng = rand::rng();
    let files = collect_files(source)?;
    let mut added = 0;
    let mut modified = 0;
    let mut deleted = 0;

    // Add files in existing directories
    for i in 0..add {
        if files.is_empty() {
            break;
        }
        let parent = files[rng.random_range(0..files.len())]
            .parent()
            .unwrap_or(source);
        let ts = chrono::Utc::now().format("%H%M%S");
        let name = format!("new-{i}-{ts}.ts");
        let content = format!("// churn addition {i}\nexport const v{i} = {i};\n");
        fs::write(parent.join(&name), content).map_err(AmberError::Io)?;
        added += 1;
    }

    // Modify random existing files
    let mod_count = modify.min(files.len());
    let mut indices: Vec<usize> = (0..files.len()).collect();
    for i in (1..indices.len()).rev() {
        indices.swap(i, rng.random_range(0..=i));
    }
    for &idx in indices.iter().take(mod_count) {
        if files[idx].is_file() {
            let mut f = fs::OpenOptions::new()
                .append(true)
                .open(&files[idx])
                .map_err(AmberError::Io)?;
            writeln!(f, "\n// modified {}", chrono::Utc::now().to_rfc3339())
                .map_err(AmberError::Io)?;
            modified += 1;
        }
    }

    // Delete random files (keep at least 100)
    let del_count = delete.min(files.len().saturating_sub(100));
    for &idx in indices.iter().skip(mod_count).take(del_count) {
        if files[idx].is_file() {
            fs::remove_file(&files[idx]).map_err(AmberError::Io)?;
            deleted += 1;
        }
    }

    Ok(ChurnResult {
        added,
        modified,
        deleted,
    })
}

fn collect_files(dir: &Path) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    walk(dir, &mut out)?;
    Ok(out)
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) -> Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(dir).map_err(AmberError::Io)? {
        let entry = entry.map_err(AmberError::Io)?;
        let p = entry.path();
        if p.file_name().map(|n| n == ".amber-meta").unwrap_or(false) {
            continue;
        }
        if p.is_dir() {
            walk(&p, out)?;
        } else {
            out.push(p);
        }
    }
    Ok(())
}

// =============================================================================
// Helpers
// =============================================================================

fn run_rsync(source: &Path, dest: &Path) -> Result<()> {
    fs::create_dir_all(dest).map_err(AmberError::Io)?;
    let src = format!("{}/", source.to_string_lossy());
    let dst = dest.to_string_lossy().to_string();
    let out = Command::new("rsync")
        .args(["-a", "--quiet", &src, &dst])
        .output()
        .map_err(|e| AmberError::Rsync(format!("rsync exec: {}", e)))?;
    if !out.status.success() {
        return Err(AmberError::Rsync(
            String::from_utf8_lossy(&out.stderr).to_string(),
        ));
    }
    Ok(())
}

fn dir_size(path: &Path) -> u64 {
    fs::read_dir(path)
        .map(|entries| {
            entries
                .flatten()
                .map(|e| {
                    let p = e.path();
                    if p.is_dir() {
                        dir_size(&p)
                    } else {
                        p.metadata().map(|m| m.len()).unwrap_or(0)
                    }
                })
                .sum()
        })
        .unwrap_or(0)
}

fn count_files(path: &Path) -> u64 {
    fs::read_dir(path)
        .map(|entries| {
            entries
                .flatten()
                .map(|e| {
                    let p = e.path();
                    if p.is_dir() {
                        count_files(&p)
                    } else {
                        1
                    }
                })
                .sum()
        })
        .unwrap_or(0)
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().to_string() + c.as_str(),
    }
}

fn bench(name: &str, n: usize, mut f: impl FnMut() -> Result<()>) -> Result<BenchmarkResult> {
    let mut times = Vec::with_capacity(n);
    for _ in 0..n {
        let t = Instant::now();
        f()?;
        times.push(t.elapsed().as_secs_f64() * 1000.0);
    }
    let total: f64 = times.iter().sum();
    Ok(BenchmarkResult {
        operation: name.to_string(),
        iterations: n,
        avg_ms: total / n as f64,
        min_ms: times.iter().cloned().fold(f64::INFINITY, f64::min),
        max_ms: times.iter().cloned().fold(f64::NEG_INFINITY, f64::max),
        total_ms: total,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_playground_root() {
        let root = playground_root();
        assert!(root.to_string_lossy().contains(".amber-dev"));
    }

    #[test]
    fn test_pad_content() {
        let mut rng = rand::rng();
        let mut buf = b"hello".to_vec();
        pad_content(&mut buf, 100, &mut rng);
        assert_eq!(buf.len(), 100);
    }
}
