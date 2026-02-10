use crate::error::Result;
use crate::services::file_service::FileEntry;
use crate::state::AppState;
use crate::types::snapshot::file_type;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified: u64,
}

impl From<FileEntry> for DirEntry {
    fn from(e: FileEntry) -> Self {
        Self {
            name: e.name,
            path: e.path,
            is_directory: e.is_dir,
            size: e.size,
            modified: e.modified,
        }
    }
}

#[tauri::command]
pub async fn read_dir(state: State<'_, AppState>, path: String) -> Result<Vec<DirEntry>> {
    let validated_path = state.validate_path(&path)?;
    let entries = state.file_service.scan_directory(&validated_path)?;
    Ok(entries.into_iter().map(DirEntry::from).collect())
}

#[tauri::command]
pub async fn read_file_preview(
    state: State<'_, AppState>,
    file_path: String,
    max_lines: Option<usize>,
) -> Result<String> {
    let validated_path = state.validate_path(&file_path)?;
    state
        .file_service
        .read_file_preview(&validated_path, max_lines.unwrap_or(100))
}

#[tauri::command]
pub async fn read_file_as_base64(state: State<'_, AppState>, file_path: String) -> Result<String> {
    let validated_path = state.validate_path(&file_path)?;
    state.file_service.read_file_base64(&validated_path)
}

#[tauri::command]
pub async fn open_path(state: State<'_, AppState>, path: String) -> Result<()> {
    let validated_path = state.validate_path(&path)?;
    state.file_service.open_path(&validated_path)
}

#[tauri::command]
pub async fn show_item_in_folder(state: State<'_, AppState>, path: String) -> Result<()> {
    let validated_path = state.validate_path(&path)?;
    state.file_service.show_in_folder(&validated_path)
}

#[tauri::command]
pub async fn get_disk_stats(state: State<'_, AppState>, path: String) -> Result<String> {
    use std::process::Command;

    let validated_path = state.validate_path(&path)?;
    let output = Command::new("df")
        .args(["-h", "--", &validated_path])
        .output()?;
    if !output.status.success() {
        return Err(crate::error::AmberError::Io(std::io::Error::other(
            String::from_utf8_lossy(&output.stderr).to_string(),
        )));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Get volume info for any path (returns stats of the containing filesystem)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeStats {
    pub total_bytes: u64,
    pub available_bytes: u64,
}

#[tauri::command]
pub async fn get_volume_info(state: State<'_, AppState>, path: String) -> Result<VolumeStats> {
    let validated_path = state.validate_path(&path)?;
    let (total_bytes, available_bytes) = parse_df_output(&validated_path)?;
    Ok(VolumeStats {
        total_bytes,
        available_bytes,
    })
}

// ===== TIM-47: Volume listing and search =====

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeInfo {
    pub name: String,
    pub path: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub is_external: bool,
}

/// List mounted volumes (external drives)
#[tauri::command]
pub async fn list_volumes() -> Result<Vec<VolumeInfo>> {
    use crate::utils::platform;
    use std::fs;

    let mut volumes = Vec::new();
    let system_names = platform::system_volume_names();

    for mount_root in platform::mount_root_paths() {
        if !mount_root.exists() {
            continue;
        }
        for entry in fs::read_dir(&mount_root)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            let path = entry.path();

            // Skip system volumes and hidden entries
            if system_names.contains(&name.as_str()) || name.starts_with('.') {
                continue;
            }

            if let Ok(stats) = get_volume_stats(&path) {
                volumes.push(VolumeInfo {
                    name: name.clone(),
                    path: path.to_string_lossy().to_string(),
                    total_bytes: stats.0,
                    free_bytes: stats.1,
                    is_external: true,
                });
            }
        }
    }

    Ok(volumes)
}

/// Get volume stats (total bytes, free bytes) by parsing df output
fn get_volume_stats(path: &std::path::Path) -> std::io::Result<(u64, u64)> {
    let (total, available) = parse_df_output(path.to_str().unwrap_or("/"))?;
    Ok((total, available))
}

/// Parse df -k output for a given path, returning (total_bytes, available_bytes)
fn parse_df_output(path: &str) -> std::io::Result<(u64, u64)> {
    use std::process::Command;

    let output = Command::new("df").args(["-k", "--", path]).output()?;

    if !output.status.success() {
        return Err(std::io::Error::other(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = stdout.lines().collect();

    if lines.len() < 2 {
        return Ok((0, 0));
    }

    let parts: Vec<&str> = lines[1].split_whitespace().collect();
    if parts.len() < 4 {
        return Ok((0, 0));
    }

    let total_kb: u64 = parts[1].parse().unwrap_or(0);
    let available_kb: u64 = parts[3].parse().unwrap_or(0);

    Ok((total_kb * 1024, available_kb * 1024))
}

/// Search files in a volume by pattern (fuzzy filename match)
#[tauri::command]
pub async fn search_volume(
    state: State<'_, AppState>,
    volume_path: String,
    pattern: String,
    limit: Option<usize>,
) -> Result<Vec<crate::types::snapshot::FileNode>> {
    use jwalk::WalkDir;
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Mutex;

    let validated_path = state.validate_path(&volume_path)?;
    let limit = limit.unwrap_or(50);
    let pattern_lower = pattern.to_lowercase();
    let count = AtomicUsize::new(0);
    let results = Mutex::new(Vec::new());

    // Use jwalk for fast parallel directory walking
    // Limit depth to 5 for performance
    let walker = WalkDir::new(&validated_path)
        .skip_hidden(true)
        .max_depth(5)
        .parallelism(jwalk::Parallelism::RayonNewPool(4));

    walker.into_iter().par_bridge().for_each(|entry| {
        if count.load(Ordering::Relaxed) >= limit {
            return;
        }

        if let Ok(entry) = entry {
            let name = entry.file_name().to_string_lossy().to_string();
            let name_lower = name.to_lowercase();

            // Fuzzy match: check if pattern chars appear in order
            if fuzzy_match(&pattern_lower, &name_lower) {
                if let Ok(metadata) = entry.metadata() {
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or(0);

                    let path_str = entry.path().to_string_lossy().to_string();
                    let node = crate::types::snapshot::FileNode {
                        id: path_str.clone(),
                        name,
                        node_type: if metadata.is_dir() {
                            file_type::DIR.to_string()
                        } else {
                            file_type::FILE.to_string()
                        },
                        size: metadata.len(),
                        modified,
                        children: None,
                        path: path_str,
                    };

                    let mut results_guard = results.lock().unwrap();
                    if results_guard.len() < limit {
                        results_guard.push(node);
                        count.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
        }
    });

    Ok(results.into_inner().unwrap())
}

/// Simple fuzzy matching: checks if all pattern chars appear in text in order
fn fuzzy_match(pattern: &str, text: &str) -> bool {
    if pattern.is_empty() {
        return true;
    }

    // First try substring match (faster)
    if text.contains(pattern) {
        return true;
    }

    // Then try fuzzy match (pattern chars in order)
    let mut pattern_chars = pattern.chars().peekable();
    for c in text.chars() {
        if pattern_chars.peek() == Some(&c) {
            pattern_chars.next();
            if pattern_chars.peek().is_none() {
                return true;
            }
        }
    }

    false
}

// ===== TIM-109: Mount detection =====

/// Mount status for a destination path
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MountStatus {
    pub path: String,
    pub mounted: bool,
    pub is_external: bool,
    pub volume_name: Option<String>,
}

/// Check if a single path is accessible (mounted/exists)
#[tauri::command]
pub async fn is_path_mounted(path: String) -> Result<MountStatus> {
    let path_obj = std::path::Path::new(&path);

    // Check if path exists and is accessible
    let mounted = path_obj.exists() && path_obj.is_dir();

    // Get volume info using shared helper
    let vol_info = crate::utils::get_volume_info(&path);

    Ok(MountStatus {
        path,
        mounted,
        is_external: vol_info.is_external,
        volume_name: vol_info.volume_name,
    })
}

/// Check mount status for multiple paths (batch operation)
#[tauri::command]
pub async fn check_destinations(paths: Vec<String>) -> Result<Vec<MountStatus>> {
    let mut results = Vec::with_capacity(paths.len());

    for path in paths {
        let path_obj = std::path::Path::new(&path);
        let mounted = path_obj.exists() && path_obj.is_dir();
        let vol_info = crate::utils::get_volume_info(&path);

        results.push(MountStatus {
            path,
            mounted,
            is_external: vol_info.is_external,
            volume_name: vol_info.volume_name,
        });
    }

    Ok(results)
}

// ===== TIM-118: Orphan backup detection =====

use crate::services::manifest_service;

/// Information about a discovered backup on a volume
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredBackup {
    /// Path to the backup directory (parent of .amber-meta)
    pub backup_path: String,
    /// Job ID from manifest
    pub job_id: String,
    /// Job name from manifest
    pub job_name: String,
    /// Source path that was backed up
    pub source_path: String,
    /// Machine ID that created this backup
    pub machine_id: String,
    /// Number of snapshots
    pub snapshot_count: usize,
    /// Whether there's a matching job in jobs.json
    pub has_matching_job: bool,
}

/// Scan a volume for Amber backup folders
/// Returns all backups found, marking which have matching jobs
#[tauri::command]
pub async fn scan_for_backups(
    volume_path: String,
    known_job_ids: Vec<String>,
) -> Result<Vec<DiscoveredBackup>> {
    use std::fs;

    let volume = std::path::Path::new(&volume_path);
    if !volume.exists() || !volume.is_dir() {
        return Ok(Vec::new());
    }

    let mut discovered = Vec::new();

    // Scan top-level directories for .amber-meta folders
    // We don't go deep - backups should be at the top level of their destination
    if let Ok(entries) = fs::read_dir(volume) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let meta_dir = path.join(manifest_service::AMBER_META_DIR);
            if meta_dir.exists() {
                // Found a backup! Try to read its manifest
                let backup_path = path.to_string_lossy().to_string();
                if let Ok(Some(manifest)) = manifest_service::read_manifest(&backup_path).await {
                    let has_matching_job = known_job_ids.contains(&manifest.job_id);
                    discovered.push(DiscoveredBackup {
                        backup_path,
                        job_id: manifest.job_id,
                        job_name: manifest.job_name,
                        source_path: manifest.source_path,
                        machine_id: manifest.machine_id,
                        snapshot_count: manifest.snapshots.len(),
                        has_matching_job,
                    });
                }
            }
        }
    }

    Ok(discovered)
}

/// Scan all mounted volumes for orphan backups
#[tauri::command]
pub async fn find_orphan_backups(known_job_ids: Vec<String>) -> Result<Vec<DiscoveredBackup>> {
    use crate::utils::platform;
    use std::fs;

    let mut all_orphans = Vec::new();
    let system_names = platform::system_volume_names();

    for mount_root in platform::mount_root_paths() {
        if !mount_root.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(&mount_root) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();

                if system_names.contains(&name.as_str()) || name.starts_with('.') {
                    continue;
                }

                let volume_path = entry.path().to_string_lossy().to_string();
                if let Ok(backups) = scan_for_backups(volume_path, known_job_ids.clone()).await {
                    for backup in backups {
                        if !backup.has_matching_job {
                            all_orphans.push(backup);
                        }
                    }
                }
            }
        }
    }

    Ok(all_orphans)
}

/// Import an orphan backup by creating a job from its manifest
#[tauri::command]
pub async fn import_backup_as_job(backup_path: String) -> Result<crate::types::job::SyncJob> {
    // Read the manifest
    let manifest = manifest_service::read_manifest(&backup_path)
        .await
        .map_err(|e| crate::error::AmberError::Filesystem(e.to_string()))?
        .ok_or_else(|| {
            crate::error::AmberError::NotFound(format!("No manifest found at {}", backup_path))
        })?;

    // Create a job from the manifest
    let job = crate::types::job::SyncJob {
        id: manifest.job_id,
        name: manifest.job_name,
        source_path: manifest.source_path,
        dest_path: backup_path,
        mode: crate::types::job::SyncMode::TimeMachine,
        status: crate::types::job::JobStatus::Idle,
        destination_type: Some(crate::types::job::DestinationType::Local),
        schedule_interval: None,
        schedule: None,
        config: crate::types::job::RsyncConfig::default(),
        ssh_config: None,
        cloud_config: None,
        last_run: None,
        snapshots: None,
    };

    Ok(job)
}
