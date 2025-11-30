# Amber: Tauri Migration & UI Polish - Complete Ticket System

This document contains all tickets for migrating Amber from Electron to Tauri and implementing UI polish features. Tickets are organized by priority and phase.

---

## Epic: Tauri Migration (HIGH PRIORITY)

### Phase 1: Foundation & Project Setup

---

#### TIM-100: Initialize Tauri project alongside Electron

**Priority**: Urgent
**Type**: Feature
**Estimate**: 4 hours

**Description**:
Set up Tauri alongside the existing Electron codebase to enable incremental migration without breaking the current app.

**Acceptance Criteria**:
- [ ] Tauri CLI installed and configured
- [ ] `src-tauri/` directory created with proper structure
- [ ] `tauri.conf.json` configured for Amber (app name, identifier, window settings)
- [ ] Vite config updated to support both Electron and Tauri builds
- [ ] `npm run tauri:dev` command works and opens empty Tauri window
- [ ] Existing `npm run electron:dev` still works unchanged
- [ ] Both can coexist without conflicts

**Implementation Steps**:
1. Install Tauri CLI: `npm install -D @tauri-apps/cli @tauri-apps/api`
2. Run `npx tauri init` to scaffold `src-tauri/`
3. Configure `tauri.conf.json`:
   - Set `productName: "Amber"`
   - Set `identifier: "com.amber.app"`
   - Set window dimensions: 1200x800
   - Set `titleBarStyle: "hiddenInset"` for macOS
4. Add scripts to `package.json`:
   - `"tauri:dev": "tauri dev"`
   - `"tauri:build": "tauri build"`
5. Update `vite.config.mts` to work with Tauri's dev server expectations
6. Document how to switch between Electron and Tauri during migration

**Test Plan**:
- [ ] Run `npm run tauri:dev` - window opens with React app
- [ ] Run `npm run electron:dev` - existing app works unchanged
- [ ] Build both: `npm run tauri:build` and `npm run electron:build`

---

#### TIM-101: Set up Rust backend structure in src-tauri

**Priority**: Urgent
**Type**: Feature
**Estimate**: 3 hours

**Description**:
Create the Rust module structure that will house all backend services migrated from Electron.

**Acceptance Criteria**:
- [ ] Rust modules created for each service area
- [ ] Cargo.toml with required dependencies
- [ ] Basic error handling types defined
- [ ] Logging configured (tracing crate)
- [ ] Compiles without errors

**Implementation Steps**:
1. Create module structure in `src-tauri/src/`:
   ```
   src-tauri/src/
   ├── main.rs
   ├── lib.rs
   ├── commands/
   │   ├── mod.rs
   │   ├── jobs.rs
   │   ├── rsync.rs
   │   ├── snapshots.rs
   │   ├── filesystem.rs
   │   └── preferences.rs
   ├── services/
   │   ├── mod.rs
   │   ├── rsync_service.rs
   │   ├── snapshot_service.rs
   │   ├── file_service.rs
   │   ├── job_scheduler.rs
   │   ├── volume_watcher.rs
   │   └── keychain_service.rs
   ├── types/
   │   ├── mod.rs
   │   ├── job.rs
   │   ├── snapshot.rs
   │   └── preferences.rs
   └── error.rs
   ```

2. Add dependencies to `Cargo.toml`:
   ```toml
   [dependencies]
   tauri = { version = "2", features = ["tray-icon", "notification"] }
   serde = { version = "1", features = ["derive"] }
   serde_json = "1"
   tokio = { version = "1", features = ["full"] }
   tracing = "0.1"
   tracing-subscriber = "0.3"
   thiserror = "1"
   chrono = { version = "0.4", features = ["serde"] }
   ```

3. Define error types in `error.rs`:
   ```rust
   #[derive(Debug, thiserror::Error)]
   pub enum AmberError {
       #[error("IO error: {0}")]
       Io(#[from] std::io::Error),
       #[error("Rsync error: {0}")]
       Rsync(String),
       // ... etc
   }
   ```

**Test Plan**:
- [ ] `cargo build` succeeds in `src-tauri/`
- [ ] `cargo test` passes (even if no tests yet)
- [ ] Tauri app still launches after changes

---

#### TIM-102: Create Tauri command stubs for all IPC handlers

**Priority**: High
**Type**: Feature
**Estimate**: 4 hours

**Description**:
Create Tauri command function stubs that mirror every `ipcMain.handle` and `ipcMain.on` in the Electron codebase. This establishes the API contract before implementing logic.

**Acceptance Criteria**:
- [ ] Every Electron IPC handler has a corresponding Tauri command
- [ ] Commands return proper Result types
- [ ] Commands are registered in main.rs
- [ ] TypeScript types generated for commands

**Current IPC Handlers to Port** (from preload.ts analysis):
```
Jobs:
- jobs:get → get_jobs
- jobs:save → save_job
- jobs:delete → delete_job

Rsync:
- run-rsync → run_rsync (event-based)
- kill-rsync → kill_rsync

Filesystem:
- read-dir → read_dir
- select-directory → select_directory
- read-file-preview → read_file_preview
- read-file-as-base64 → read_file_as_base64
- open-path → open_path
- show-item-in-folder → show_item_in_folder
- get-disk-stats → get_disk_stats

Snapshots:
- snapshot:list → list_snapshots
- snapshot:getTree → get_snapshot_tree
- snapshot:restore → restore_files
- snapshot:restoreFull → restore_snapshot

Preferences:
- prefs:get → get_preferences
- prefs:set → set_preferences

System:
- test-notification → test_notification
- create-sandbox-dirs → create_sandbox_dirs
- is-dev → is_dev
- app:getDesktopPath → get_desktop_path

Rclone:
- rclone:checkInstalled → rclone_check_installed
- rclone:listRemotes → rclone_list_remotes
- rclone:launchConfig → rclone_launch_config
- rclone:createRemote → rclone_create_remote

Sidecar:
- fs:scan → scan_directory (streaming)
- fs:search → search_directory (streaming)
```

**Implementation Steps**:
1. Create stub commands in `commands/*.rs` files
2. Register all commands in `main.rs`:
   ```rust
   tauri::Builder::default()
       .invoke_handler(tauri::generate_handler![
           commands::jobs::get_jobs,
           commands::jobs::save_job,
           // ... etc
       ])
   ```
3. Run `npx tauri generate` to create TypeScript bindings

**Test Plan**:
- [ ] All commands compile
- [ ] Commands return placeholder responses
- [ ] TypeScript bindings generated without errors

---

#### TIM-103: Create frontend API abstraction layer

**Priority**: High
**Type**: Feature
**Estimate**: 3 hours

**Description**:
Create an abstraction layer in the React frontend that can switch between Electron IPC and Tauri commands. This enables gradual migration without changing component code.

**Acceptance Criteria**:
- [ ] `src/api/index.ts` exports unified API
- [ ] API auto-detects Electron vs Tauri runtime
- [ ] All components use new API instead of direct `window.electronAPI`
- [ ] Type safety maintained

**Implementation Steps**:
1. Create `src/api/types.ts` with shared types
2. Create `src/api/electron.ts` - wraps `window.electronAPI`
3. Create `src/api/tauri.ts` - wraps `@tauri-apps/api`
4. Create `src/api/index.ts`:
   ```typescript
   const isTauri = '__TAURI__' in window;

   export const api = isTauri
     ? await import('./tauri').then(m => m.tauriApi)
     : await import('./electron').then(m => m.electronApi);
   ```
5. Update all components to import from `@/api` instead of using `window.electronAPI`

**Test Plan**:
- [ ] App works identically in Electron mode
- [ ] TypeScript compiles without errors
- [ ] No runtime errors when switching modes

---

### Phase 2: Backend Services Migration

---

#### TIM-110: Port FileService to Rust (integrate amber-sidecar)

**Priority**: Urgent
**Type**: Feature
**Estimate**: 6 hours

**Description**:
Migrate FileService from TypeScript to Rust, integrating the existing `amber-sidecar` functionality directly into the Tauri backend. This eliminates the need for a separate sidecar process.

**Current Implementation** (electron/FileService.ts):
- Spawns `amber-sidecar` binary for fast directory scanning
- Supports `scan` and `search` operations
- Streams results via stdout parsing

**Target Implementation**:
- Native Rust implementation in `services/file_service.rs`
- Use `walkdir` or `jwalk` crate for parallel directory traversal
- Stream results to frontend via Tauri events

**Acceptance Criteria**:
- [ ] `scan_directory` command works
- [ ] `search_directory` command works
- [ ] Performance matches or exceeds sidecar (65k+ files/sec)
- [ ] Results stream to frontend in real-time
- [ ] Handles permission errors gracefully

**Dependencies**:
```toml
walkdir = "2"
jwalk = "0.8"  # For parallel walking
rayon = "1"    # For parallelism
```

**Implementation Steps**:
1. Port `amber-sidecar/src/main.rs` logic to `services/file_service.rs`
2. Create Tauri commands with event streaming:
   ```rust
   #[tauri::command]
   async fn scan_directory(
       window: tauri::Window,
       path: String,
   ) -> Result<(), AmberError> {
       for entry in WalkDir::new(&path).into_iter() {
           window.emit("fs:entry", &entry)?;
       }
       Ok(())
   }
   ```
3. Update frontend to listen for `fs:entry` events
4. Benchmark against Node.js fallback

**Test Plan**:
- [ ] Scan `/tmp/amber-sandbox/source` with 10k files < 200ms
- [ ] Search finds files matching query
- [ ] Large directories (100k+ files) don't freeze UI
- [ ] Permission denied errors handled gracefully

**Benchmark Requirements**:
```
Directory: /tmp/amber-sandbox/source (10,000 files)
Target: < 200ms total scan time
Target: > 50,000 files/second throughput
```

---

#### TIM-111: Port RsyncService to Rust

**Priority**: Urgent
**Type**: Feature
**Estimate**: 8 hours

**Description**:
Migrate the core RsyncService from TypeScript to Rust. This is the heart of the backup functionality.

**Current Implementation** (electron/rsync-service.ts):
- Builds rsync command arguments based on SyncMode
- Spawns rsync process
- Parses stdout for progress updates
- Handles TIME_MACHINE mode with `--link-dest`
- Calculates statistics from rsync output

**Acceptance Criteria**:
- [ ] All sync modes work: MIRROR, ARCHIVE, TIME_MACHINE
- [ ] Progress events stream to frontend
- [ ] Statistics calculated correctly
- [ ] Job cancellation works (kill rsync process)
- [ ] SSH remote destinations work
- [ ] Hard-link verification works

**Implementation Steps**:
1. Create `services/rsync_service.rs`
2. Port rsync argument building logic:
   ```rust
   fn build_rsync_args(job: &SyncJob) -> Vec<String> {
       let mut args = vec![
           "-avh".to_string(),
           "--progress".to_string(),
           "--stats".to_string(),
       ];

       match job.mode {
           SyncMode::Mirror => args.push("--delete".to_string()),
           SyncMode::TimeMachine => {
               if let Some(link_dest) = &job.last_snapshot {
                   args.push(format!("--link-dest={}", link_dest));
               }
           }
           _ => {}
       }

       args
   }
   ```
3. Implement progress parsing with regex
4. Use `tokio::process::Command` for async spawning
5. Store running processes for cancellation
6. Emit progress events to frontend

**Test Plan**:
- [ ] MIRROR mode: files deleted from dest when removed from source
- [ ] ARCHIVE mode: files never deleted from dest
- [ ] TIME_MACHINE mode: hard links created for unchanged files
- [ ] Progress updates appear in UI during backup
- [ ] Cancel button stops backup immediately
- [ ] SSH backup to remote server works

**Regression Tests**:
Run existing `tests/rsync-comprehensive.test.js` against Tauri backend

---

#### TIM-112: Port SnapshotService to Rust

**Priority**: High
**Type**: Feature
**Estimate**: 5 hours

**Description**:
Migrate SnapshotService to Rust for listing, browsing, and restoring backup snapshots.

**Current Implementation** (electron/SnapshotService.ts):
- Lists snapshots by reading timestamped directories
- Builds file tree for snapshot browser
- Verifies hard-link integrity
- Handles restore operations

**Acceptance Criteria**:
- [ ] `list_snapshots` returns all snapshots for a job
- [ ] `get_snapshot_tree` returns browseable file tree
- [ ] Hard-link detection works (reports space savings)
- [ ] Restore operations work correctly

**Implementation Steps**:
1. Create `services/snapshot_service.rs`
2. Implement snapshot discovery:
   ```rust
   fn list_snapshots(dest_path: &Path) -> Result<Vec<Snapshot>> {
       let mut snapshots = Vec::new();
       for entry in fs::read_dir(dest_path)? {
           if let Some(ts) = parse_timestamp(&entry.file_name()) {
               snapshots.push(Snapshot { timestamp: ts, path: entry.path() });
           }
       }
       snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
       Ok(snapshots)
   }
   ```
3. Implement file tree building with inode tracking for hard-links
4. Port restore logic (rsync from snapshot to target)

**Test Plan**:
- [ ] Snapshots listed in reverse chronological order
- [ ] File tree shows correct sizes and modification times
- [ ] Hard-linked files correctly identified
- [ ] Restore places files in correct location

---

#### TIM-113: Port JobScheduler to Rust

**Priority**: High
**Type**: Feature
**Estimate**: 4 hours

**Description**:
Migrate job scheduling from node-schedule to Rust using tokio-cron-scheduler.

**Current Implementation** (electron/JobScheduler.ts):
- Uses node-schedule for cron-based scheduling
- Supports hourly, daily, weekly schedules
- Integrates with VolumeWatcher for "on volume connect" triggers

**Acceptance Criteria**:
- [ ] Cron schedules work (hourly, daily, weekly)
- [ ] Jobs run at correct times
- [ ] Schedule survives app restart
- [ ] Manual trigger still works

**Dependencies**:
```toml
tokio-cron-scheduler = "0.9"
```

**Implementation Steps**:
1. Create `services/job_scheduler.rs`
2. Implement scheduler with tokio-cron-scheduler:
   ```rust
   use tokio_cron_scheduler::{Job, JobScheduler};

   async fn schedule_job(job: &SyncJob) -> Result<()> {
       let sched = JobScheduler::new().await?;
       let cron = match job.schedule {
           Schedule::Hourly => "0 0 * * * *",
           Schedule::Daily => "0 0 0 * * *",
           Schedule::Weekly => "0 0 0 * * 0",
       };
       sched.add(Job::new_async(cron, |_, _| {
           // Trigger backup
       })?).await?;
       Ok(())
   }
   ```
3. Persist schedules and restore on startup

**Test Plan**:
- [ ] Schedule a job for 1 minute from now, verify it runs
- [ ] Restart app, verify schedule persisted
- [ ] Disable schedule, verify job doesn't run

---

#### TIM-114: Port VolumeWatcher to Rust

**Priority**: Medium
**Type**: Feature
**Estimate**: 4 hours

**Description**:
Migrate volume/disk monitoring from chokidar to native Rust file system events.

**Current Implementation** (electron/VolumeWatcher.ts):
- Watches `/Volumes` on macOS for mount/unmount events
- Emits events when backup destination becomes available
- Triggers scheduled backups on volume connect

**Acceptance Criteria**:
- [ ] Detects volume mount events on macOS
- [ ] Detects volume unmount events
- [ ] Triggers callback when watched volume connects
- [ ] Low CPU usage when idle

**Dependencies**:
```toml
notify = "6"  # Cross-platform file system notifications
```

**Implementation Steps**:
1. Create `services/volume_watcher.rs`
2. Use `notify` crate to watch `/Volumes`:
   ```rust
   use notify::{Watcher, RecursiveMode, watcher};

   fn start_watching() -> Result<()> {
       let (tx, rx) = channel();
       let mut watcher = watcher(tx, Duration::from_secs(2))?;
       watcher.watch("/Volumes", RecursiveMode::NonRecursive)?;

       for event in rx {
           match event {
               DebouncedEvent::Create(path) => emit_volume_mounted(&path),
               DebouncedEvent::Remove(path) => emit_volume_unmounted(&path),
               _ => {}
           }
       }
       Ok(())
   }
   ```

**Test Plan**:
- [ ] Mount USB drive → event emitted
- [ ] Unmount USB drive → event emitted
- [ ] CPU usage < 1% when idle

---

#### TIM-115: Port KeychainService to Rust

**Priority**: Medium
**Type**: Feature
**Estimate**: 3 hours

**Description**:
Migrate secure credential storage from keytar to native Rust keychain access.

**Current Implementation** (electron/KeychainService.ts):
- Uses keytar for cross-platform keychain access
- Stores SSH passphrases and cloud credentials
- Retrieves credentials during backup operations

**Acceptance Criteria**:
- [ ] Store credentials in macOS Keychain
- [ ] Retrieve credentials by service/account
- [ ] Delete credentials
- [ ] Proper error handling for access denied

**Dependencies**:
```toml
keyring = "2"  # Cross-platform keychain access
```

**Implementation Steps**:
1. Create `services/keychain_service.rs`
2. Implement using `keyring` crate:
   ```rust
   use keyring::Entry;

   pub fn store_credential(service: &str, account: &str, password: &str) -> Result<()> {
       let entry = Entry::new(service, account)?;
       entry.set_password(password)?;
       Ok(())
   }

   pub fn get_credential(service: &str, account: &str) -> Result<String> {
       let entry = Entry::new(service, account)?;
       Ok(entry.get_password()?)
   }
   ```

**Test Plan**:
- [ ] Store a test credential
- [ ] Retrieve the credential
- [ ] Delete the credential
- [ ] Verify credential appears in Keychain Access.app

---

#### TIM-116: Port store.ts and preferences.ts to Rust

**Priority**: High
**Type**: Feature
**Estimate**: 3 hours

**Description**:
Migrate JSON file persistence for jobs and preferences to Rust.

**Current Implementation**:
- `store.ts`: Saves/loads jobs to `~/.amber/jobs.json`
- `preferences.ts`: Saves/loads preferences to `~/.amber/preferences.json`

**Acceptance Criteria**:
- [ ] Jobs persist across app restarts
- [ ] Preferences persist across app restarts
- [ ] Data directory created if not exists
- [ ] Handles corrupt JSON gracefully

**Implementation Steps**:
1. Create `services/store.rs`
2. Use Tauri's app data directory:
   ```rust
   use tauri::api::path::app_data_dir;

   fn get_jobs_path(app: &AppHandle) -> PathBuf {
       app_data_dir(&app.config()).unwrap().join("jobs.json")
   }
   ```
3. Implement load/save with serde_json
4. Add migration from Electron data location

**Test Plan**:
- [ ] Create job, restart app, job still exists
- [ ] Change preference, restart app, preference persisted
- [ ] Delete jobs.json, app starts without crash

---

### Phase 3: IPC & Frontend Integration

---

#### TIM-120: Update frontend API layer for Tauri commands

**Priority**: High
**Type**: Feature
**Estimate**: 4 hours

**Description**:
Complete the frontend API abstraction to call Tauri commands instead of Electron IPC.

**Acceptance Criteria**:
- [ ] All API methods work with Tauri backend
- [ ] Event subscriptions work (rsync progress, volume events)
- [ ] Error handling consistent
- [ ] TypeScript types match Rust types

**Implementation Steps**:
1. Update `src/api/tauri.ts` with real implementations:
   ```typescript
   import { invoke } from '@tauri-apps/api/core';
   import { listen } from '@tauri-apps/api/event';

   export const tauriApi = {
     getJobs: () => invoke<SyncJob[]>('get_jobs'),
     saveJob: (job: SyncJob) => invoke('save_job', { job }),
     runRsync: async (job: SyncJob, onProgress: ProgressCallback) => {
       const unlisten = await listen('rsync:progress', (e) => onProgress(e.payload));
       await invoke('run_rsync', { job });
       unlisten();
     },
     // ... etc
   };
   ```
2. Test each API method individually
3. Update components that use event subscriptions

**Test Plan**:
- [ ] Dashboard loads jobs from Tauri backend
- [ ] Creating a job persists it
- [ ] Running a backup shows progress
- [ ] All views functional

---

#### TIM-121: Implement Tauri event streaming for rsync progress

**Priority**: High
**Type**: Feature
**Estimate**: 3 hours

**Description**:
Implement real-time progress streaming from Rust rsync execution to React frontend.

**Acceptance Criteria**:
- [ ] Progress percentage updates in real-time
- [ ] Transfer speed displayed
- [ ] ETA displayed
- [ ] Current file shown
- [ ] Terminal log updated with rsync output

**Implementation Steps**:
1. Emit events from Rust:
   ```rust
   #[derive(Serialize, Clone)]
   struct RsyncProgress {
       job_id: String,
       percentage: u8,
       transferred: String,
       speed: String,
       eta: String,
       current_file: Option<String>,
   }

   window.emit("rsync:progress", &progress)?;
   ```
2. Listen in frontend:
   ```typescript
   const unlisten = await listen<RsyncProgress>('rsync:progress', (event) => {
     setProgress(event.payload);
   });
   ```

**Test Plan**:
- [ ] Progress bar updates smoothly during backup
- [ ] Speed and ETA are reasonable values
- [ ] Terminal shows rsync output lines

---

#### TIM-122: Implement system tray with Tauri

**Priority**: Medium
**Type**: Feature
**Estimate**: 4 hours

**Description**:
Port the system tray functionality from Electron to Tauri.

**Current Features**:
- Tray icon with context menu
- List of jobs with "Run" actions
- "Open Dashboard" option
- Animated icon during backup
- "Quit Amber" option

**Acceptance Criteria**:
- [ ] Tray icon appears in menu bar
- [ ] Context menu shows all jobs
- [ ] Running a job from tray works
- [ ] Animation during backup
- [ ] App hides to tray when "Run in Background" enabled

**Implementation Steps**:
1. Enable tray feature in Cargo.toml
2. Configure in `tauri.conf.json`:
   ```json
   "trayIcon": {
     "iconPath": "icons/tray.png",
     "iconAsTemplate": true
   }
   ```
3. Build menu in Rust:
   ```rust
   let tray_menu = SystemTrayMenu::new()
       .add_item(CustomMenuItem::new("dashboard", "Open Dashboard"))
       .add_native_item(SystemTrayMenuItem::Separator)
       .add_item(CustomMenuItem::new("quit", "Quit Amber"));
   ```

**Test Plan**:
- [ ] Tray icon visible
- [ ] Menu items work
- [ ] Animation toggles during backup
- [ ] Closing window hides to tray (when enabled)

---

#### TIM-123: Implement native notifications with Tauri

**Priority**: Low
**Type**: Feature
**Estimate**: 2 hours

**Description**:
Port backup completion notifications to Tauri's notification API.

**Acceptance Criteria**:
- [ ] Notification shown on backup complete
- [ ] Notification shown on backup failure
- [ ] Respects user preference for notifications
- [ ] Notification permission requested properly

**Implementation Steps**:
1. Enable notification feature in Cargo.toml
2. Use Tauri notification API:
   ```rust
   use tauri::api::notification::Notification;

   Notification::new(&app.config().identifier)
       .title("Backup Complete")
       .body(&format!("{}: Success", job.name))
       .show()?;
   ```

**Test Plan**:
- [ ] Complete a backup → notification appears
- [ ] Fail a backup → error notification appears
- [ ] Disable notifications → no notification

---

### Phase 4: Testing, Benchmarks & Finalization

---

#### TIM-130: Create Tauri-specific test suite

**Priority**: High
**Type**: Test
**Estimate**: 6 hours

**Description**:
Create comprehensive tests for the Tauri backend to ensure parity with Electron implementation.

**Acceptance Criteria**:
- [ ] Unit tests for all Rust services
- [ ] Integration tests for IPC commands
- [ ] E2E tests for critical workflows
- [ ] CI pipeline runs tests

**Test Categories**:

1. **Unit Tests** (Rust):
   - RsyncService argument building
   - Progress parsing
   - Snapshot listing
   - File tree building

2. **Integration Tests**:
   - Command invocation
   - Event streaming
   - File operations

3. **E2E Tests**:
   - Create job → run backup → verify files
   - Restore from snapshot
   - Schedule job → wait → verify ran

**Implementation Steps**:
1. Add test files in `src-tauri/src/services/*.rs`
2. Create integration test directory `src-tauri/tests/`
3. Add `cargo test` to CI pipeline

**Test Plan**:
- [ ] `cargo test` passes with >80% coverage
- [ ] All existing Mocha tests pass against Tauri backend

---

#### TIM-131: Benchmark Tauri vs Electron performance

**Priority**: High
**Type**: Test
**Estimate**: 4 hours

**Description**:
Create comprehensive benchmarks comparing Tauri and Electron versions.

**Metrics to Measure**:

| Metric | Electron Baseline | Tauri Target |
|--------|------------------|--------------|
| App startup time | TBD | < 500ms |
| Memory usage (idle) | TBD | < 100MB |
| Memory usage (backup running) | TBD | < 200MB |
| Directory scan (10k files) | TBD | < 200ms |
| DMG size | ~150MB | < 20MB |
| First paint | TBD | < 300ms |

**Acceptance Criteria**:
- [ ] Benchmark script created
- [ ] Results documented
- [ ] Tauri meets or exceeds all targets
- [ ] Results added to PERFORMANCE.md

**Implementation Steps**:
1. Create `scripts/benchmark.sh`:
   ```bash
   # Startup time
   time open -W /Applications/Amber.app

   # Memory usage
   ps aux | grep Amber

   # Directory scan
   node -e "console.time('scan'); await api.readDir('/tmp/test'); console.timeEnd('scan')"
   ```
2. Run benchmarks on both Electron and Tauri builds
3. Document results in PERFORMANCE.md

**Test Plan**:
- [ ] Benchmarks run without errors
- [ ] Results reproducible
- [ ] Tauri shows improvement in all metrics

---

#### TIM-132: Migration testing - verify feature parity

**Priority**: Urgent
**Type**: Test
**Estimate**: 6 hours

**Description**:
Comprehensive testing to verify the Tauri version has 100% feature parity with Electron.

**Feature Checklist**:

**Dashboard**:
- [ ] Jobs list displays correctly
- [ ] Job status indicators work
- [ ] Quick actions (run, edit, delete) work
- [ ] Storage timeline renders

**Job Editor**:
- [ ] Create new job
- [ ] Edit existing job
- [ ] Source/destination selection dialogs
- [ ] Sync mode selection
- [ ] Schedule configuration
- [ ] Exclusion patterns
- [ ] SSH configuration

**Job Detail**:
- [ ] Run backup manually
- [ ] Cancel running backup
- [ ] View rsync log output
- [ ] Progress bar updates
- [ ] Statistics display after completion

**Snapshot Browser**:
- [ ] List snapshots
- [ ] Browse snapshot file tree
- [ ] Preview files (text, images)
- [ ] Restore single file
- [ ] Restore full snapshot

**Settings**:
- [ ] Theme switching (light/dark/system)
- [ ] Accent color selection
- [ ] Run in background toggle
- [ ] Start on boot toggle
- [ ] Notifications toggle
- [ ] Test notification

**System Integration**:
- [ ] System tray
- [ ] Notifications
- [ ] Open in Finder
- [ ] Volume detection

**Test Plan**:
- [ ] Manual QA pass through all features
- [ ] Create test cases for each feature
- [ ] Document any regressions

---

#### TIM-133: Remove Electron dependencies and finalize

**Priority**: Medium
**Type**: Chore
**Estimate**: 3 hours

**Description**:
Once Tauri migration is complete and verified, remove all Electron-related code and dependencies.

**Acceptance Criteria**:
- [ ] `electron/` directory removed
- [ ] Electron dependencies removed from package.json
- [ ] electron-builder config removed
- [ ] Build scripts updated
- [ ] Documentation updated
- [ ] CI/CD updated for Tauri builds

**Implementation Steps**:
1. Remove `electron/` directory
2. Remove from package.json:
   - electron
   - electron-builder
   - electron-log
   - keytar
   - chokidar
   - node-schedule
3. Update package.json scripts
4. Update CLAUDE.md
5. Update README.md
6. Update GitHub Actions workflow

**Test Plan**:
- [ ] `npm install` succeeds without Electron
- [ ] `npm run tauri:build` produces working DMG
- [ ] CI builds pass

---

#### TIM-134: Add SQLite metadata indexing for fast browsing

**Priority**: High
**Type**: Feature
**Estimate**: 8 hours

**Description**:
Implement SQLite-based metadata indexing for fast snapshot browsing, as discussed in the ChatGPT conversation. This is critical for browsing large backups (full system backups with millions of files).

**Acceptance Criteria**:
- [ ] SQLite database created per backup destination
- [ ] Metadata indexed after each backup
- [ ] Browsing uses index instead of filesystem
- [ ] Search across snapshots is fast
- [ ] Diff between snapshots computed from index

**Database Schema**:
```sql
CREATE TABLE snapshots (
    id INTEGER PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    root_path TEXT NOT NULL,
    file_count INTEGER,
    total_size INTEGER
);

CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    snapshot_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER,
    mtime INTEGER,
    inode INTEGER,
    is_dir BOOLEAN,
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
);

CREATE INDEX idx_files_path ON files(snapshot_id, path);
CREATE INDEX idx_files_name ON files(snapshot_id, name);
CREATE INDEX idx_files_inode ON files(snapshot_id, inode);
```

**Implementation Steps**:
1. Add `rusqlite` dependency
2. Create `services/metadata_index.rs`
3. Index snapshots after backup completes
4. Query index for file listing instead of fs::read_dir
5. Implement diff query between snapshots
6. Add migration for existing backups

**Performance Targets**:
- List 10,000 files: < 50ms
- Search by name: < 100ms
- Diff between snapshots: < 500ms

**Test Plan**:
- [ ] Create backup of 100k files
- [ ] Browse snapshot → response < 100ms
- [ ] Search files → response < 200ms
- [ ] Show diff between snapshots → response < 1s

---

## Epic: UI Polish (MEDIUM PRIORITY)

### Design System

---

#### TIM-200: Establish design system foundation

**Priority**: High
**Type**: Design
**Estimate**: 6 hours

**Description**:
Create a comprehensive design system document and implement foundational design tokens for Amber.

**Deliverables**:
- [ ] Design tokens (colors, spacing, typography)
- [ ] Component inventory
- [ ] Animation guidelines
- [ ] Updated Tailwind config

**Design Tokens**:

**Spacing Scale** (8px base):
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;
--space-8: 64px;
```

**Color Palette** (extend current):
```css
/* Semantic colors */
--color-success: #10B981;
--color-warning: #F59E0B;
--color-error: #EF4444;
--color-info: #3B82F6;

/* Surface colors */
--color-surface-1: /* lightest */
--color-surface-2: /* cards */
--color-surface-3: /* elevated */
```

**Border Radius**:
```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;
```

**Implementation Steps**:
1. Create `src/styles/tokens.css` with CSS variables
2. Update `tailwind.config.js` to use tokens
3. Document tokens in `docs/design-system.md`
4. Audit existing components for consistency

**Test Plan**:
- [ ] All components use design tokens
- [ ] No hardcoded colors/spacing
- [ ] Dark/light themes work correctly

---

#### TIM-201: Implement typography system

**Priority**: High
**Type**: Design
**Estimate**: 4 hours

**Description**:
Establish a consistent typography system inspired by modern apps like Warp, Linear, and Raycast.

**Typography Scale**:
```css
/* Font Family */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', monospace;

/* Font Sizes */
--text-xs: 11px;
--text-sm: 13px;
--text-base: 14px;
--text-lg: 16px;
--text-xl: 18px;
--text-2xl: 24px;
--text-3xl: 30px;

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

**Acceptance Criteria**:
- [ ] Inter font loaded (or system font fallback)
- [ ] JetBrains Mono for code/terminal
- [ ] Consistent text sizes across app
- [ ] Proper line heights for readability

**Implementation Steps**:
1. Add Inter and JetBrains Mono to project
2. Update `index.css` with font declarations
3. Create typography utility classes
4. Update all text elements to use system

**Test Plan**:
- [ ] Fonts load correctly
- [ ] No FOUT (flash of unstyled text)
- [ ] Terminal uses monospace font
- [ ] Text readable at all sizes

---

#### TIM-202: Implement animation system

**Priority**: Medium
**Type**: Design
**Estimate**: 4 hours

**Description**:
Create consistent, performant animations throughout the app using GPU-accelerated CSS.

**Animation Guidelines**:

**Timing**:
```css
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;
--duration-slower: 500ms;
```

**Easing**:
```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

**Rules**:
- Only animate `transform` and `opacity` (GPU-accelerated)
- Use `will-change` sparingly
- Reduce motion for accessibility
- No animations > 500ms

**Implementation Steps**:
1. Create animation utility classes in Tailwind
2. Add `prefers-reduced-motion` support
3. Audit and update existing animations
4. Create reusable animation components

**Test Plan**:
- [ ] Animations smooth at 60fps
- [ ] No layout thrashing
- [ ] Respects reduced motion preference
- [ ] Consistent across all interactions

---

### Component Polish

---

#### TIM-210: Implement Command Palette

**Priority**: High
**Type**: Feature
**Estimate**: 8 hours

**Description**:
Add a Raycast/Spotlight-style command palette for keyboard-first navigation and quick actions.

**Features**:
- [ ] Open with `⌘K`
- [ ] Fuzzy search across commands
- [ ] Recent commands
- [ ] Categorized results (Jobs, Actions, Navigation)
- [ ] Keyboard navigation

**Commands to Include**:
```
Jobs:
- Run [job name]
- Edit [job name]
- Delete [job name]
- Create new job

Navigation:
- Go to Dashboard
- Go to Settings
- Go to History

Actions:
- Toggle theme
- Open logs folder
- Check for updates
```

**Implementation Steps**:
1. Create `src/components/CommandPalette.tsx`
2. Implement fuzzy search (use `fuse.js` or similar)
3. Add keyboard event listener for `⌘K`
4. Create command registry
5. Style with design system tokens

**Test Plan**:
- [ ] `⌘K` opens palette
- [ ] Escape closes palette
- [ ] Arrow keys navigate results
- [ ] Enter executes command
- [ ] Fuzzy search finds partial matches

---

#### TIM-211: Virtualize file browser for large directories

**Priority**: High
**Type**: Performance
**Estimate**: 6 hours

**Description**:
Implement virtualized scrolling in FileBrowser to handle directories with 100k+ files without performance degradation.

**Current Problem**:
- FileBrowser renders all items in DOM
- Large directories cause UI freeze
- Memory usage grows with file count

**Solution**:
Use `@tanstack/react-virtual` or `react-window` for virtualized rendering.

**Acceptance Criteria**:
- [ ] 100k files renders smoothly
- [ ] Scroll performance 60fps
- [ ] Memory usage constant regardless of file count
- [ ] Expand/collapse works correctly
- [ ] Selection state preserved

**Implementation Steps**:
1. Install `@tanstack/react-virtual`
2. Refactor FileBrowser to use virtual list
3. Implement variable row heights for tree structure
4. Handle expand/collapse with virtualization
5. Maintain scroll position on re-render

**Test Plan**:
- [ ] Load directory with 100k files
- [ ] Scroll is smooth (measure with DevTools)
- [ ] Expand nested folder works
- [ ] Search filters work with virtualization

---

#### TIM-212: Polish Dashboard cards

**Priority**: Medium
**Type**: Design
**Estimate**: 4 hours

**Description**:
Redesign Dashboard job cards for a more polished, modern look.

**Current Issues**:
- Cards look flat
- Status indicators not prominent enough
- No visual hierarchy

**Design Improvements**:
- Subtle shadows for depth
- Status indicator as colored sidebar or badge
- Better typography hierarchy
- Hover state with elevation
- Action buttons appear on hover

**Implementation Steps**:
1. Update JobCard component styles
2. Add hover interactions
3. Improve status indicator visibility
4. Add micro-animations
5. Ensure dark mode looks good

**Test Plan**:
- [ ] Cards visually distinct
- [ ] Hover states feel responsive
- [ ] Status clear at a glance
- [ ] Works in light and dark mode

---

#### TIM-213: Polish Terminal component

**Priority**: Medium
**Type**: Design
**Estimate**: 3 hours

**Description**:
Make the rsync output terminal look more professional and Warp-like.

**Improvements**:
- [ ] Better syntax highlighting
- [ ] Timestamps on each line
- [ ] Collapsible verbose output
- [ ] Progress bar integrated
- [ ] Copy output button
- [ ] Search within output

**Implementation Steps**:
1. Add line timestamps
2. Implement output collapsing for verbose sections
3. Add search functionality
4. Style scrollbar
5. Add copy button

**Test Plan**:
- [ ] Output readable and styled
- [ ] Search finds text
- [ ] Copy works
- [ ] Performance good with 10k+ lines

---

#### TIM-214: Improve Settings page layout

**Priority**: Low
**Type**: Design
**Estimate**: 3 hours

**Description**:
Reorganize Settings page with better visual grouping and more polished controls.

**Improvements**:
- [ ] Group related settings
- [ ] Add section headers
- [ ] Polish toggle switches
- [ ] Add setting descriptions
- [ ] Improve theme preview

**Implementation Steps**:
1. Group settings into sections (Appearance, Behavior, Advanced)
2. Add descriptive text for each setting
3. Style toggle switches consistently
4. Add theme/accent preview

**Test Plan**:
- [ ] All settings accessible
- [ ] Grouping logical
- [ ] Settings persist correctly

---

### Advanced UI Features

---

#### TIM-220: Add keyboard shortcuts throughout app

**Priority**: Medium
**Type**: Feature
**Estimate**: 4 hours

**Description**:
Implement comprehensive keyboard shortcuts for power users.

**Shortcuts**:
```
Global:
⌘K - Command palette
⌘, - Settings
⌘1-5 - Switch views
⌘N - New job
⌘R - Run selected job

File Browser:
↑/↓ - Navigate
Enter - Open/expand
Space - Preview
⌘C - Copy path
⌘⇧C - Copy file

Terminal:
⌘F - Search
⌘C - Copy selection
```

**Implementation Steps**:
1. Create `src/hooks/useKeyboardShortcuts.ts`
2. Register global shortcuts
3. Add context-specific shortcuts
4. Show shortcuts in tooltips
5. Add shortcuts help panel

**Test Plan**:
- [ ] All shortcuts work
- [ ] No conflicts between shortcuts
- [ ] Shortcuts shown in UI

---

#### TIM-221: Add drag-and-drop for job source/destination

**Priority**: Low
**Type**: Feature
**Estimate**: 4 hours

**Description**:
Allow users to drag folders from Finder into job editor to set source/destination paths.

**Acceptance Criteria**:
- [ ] Drag folder onto source field sets path
- [ ] Drag folder onto destination field sets path
- [ ] Visual feedback during drag
- [ ] Works with Finder and other file managers

**Implementation Steps**:
1. Add drag event handlers to path inputs
2. Parse dropped file paths
3. Add visual drop zone indicator
4. Validate dropped paths are directories

**Test Plan**:
- [ ] Drag folder from Finder → path set correctly
- [ ] Drop zone highlights on dragover
- [ ] Invalid drops rejected gracefully

---

#### TIM-222: Add onboarding flow for new users

**Priority**: Low
**Type**: Feature
**Estimate**: 6 hours

**Description**:
Create a first-run experience that guides new users through creating their first backup job.

**Flow**:
1. Welcome screen with app overview
2. Create first job wizard
3. Explain sync modes
4. Recommend settings
5. First backup prompt

**Acceptance Criteria**:
- [ ] Shown only on first launch
- [ ] Can be skipped
- [ ] Can be replayed from Settings
- [ ] Guides to successful first backup

**Implementation Steps**:
1. Create `src/components/Onboarding.tsx`
2. Add first-launch detection
3. Implement step-by-step wizard
4. Store completion status in preferences

**Test Plan**:
- [ ] Fresh install shows onboarding
- [ ] Skip works correctly
- [ ] Re-run from settings works
- [ ] First backup created successfully

---

## Summary

### Ticket Count by Priority

| Priority | Count |
|----------|-------|
| Urgent | 5 |
| High | 14 |
| Medium | 7 |
| Low | 4 |
| **Total** | **30** |

### Estimated Total Effort

| Phase | Hours |
|-------|-------|
| Phase 1: Foundation | 14 |
| Phase 2: Backend Migration | 37 |
| Phase 3: Frontend Integration | 13 |
| Phase 4: Testing & Finalization | 27 |
| UI Polish | 46 |
| **Total** | **137 hours** |

### Recommended Execution Order

1. TIM-100, TIM-101, TIM-102, TIM-103 (Foundation)
2. TIM-110, TIM-111 (Core services - FileService, RsyncService)
3. TIM-112, TIM-116 (SnapshotService, persistence)
4. TIM-120, TIM-121 (Frontend integration)
5. TIM-130, TIM-131, TIM-132 (Testing)
6. TIM-113, TIM-114, TIM-115 (Supporting services)
7. TIM-122, TIM-123 (System integration)
8. TIM-134 (SQLite indexing)
9. TIM-133 (Cleanup)
10. UI Polish tickets as time permits
