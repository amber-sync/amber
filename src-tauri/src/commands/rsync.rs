#![allow(clippy::lines_filter_map_ok)]

use crate::error::Result;
use crate::services::index_service::IndexService;
use crate::services::manifest_service;
use crate::services::rsync_service::RsyncService;
use crate::types::job::{SyncJob, SyncMode};
use crate::types::manifest::{ManifestSnapshot, ManifestSnapshotStatus};
use regex::Regex;
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::sync::OnceLock;
use tauri::Emitter;
use tokio::time::{timeout, Duration};
use walkdir::WalkDir;

static RSYNC_SERVICE: OnceLock<RsyncService> = OnceLock::new();

fn get_rsync_service() -> &'static RsyncService {
    RSYNC_SERVICE.get_or_init(RsyncService::new)
}

// Event payloads for frontend
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RsyncLogPayload {
    job_id: String,
    message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RsyncProgressPayload {
    job_id: String,
    transferred: String,
    percentage: u8,
    speed: String,
    eta: String,
    current_file: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RsyncCompletePayload {
    job_id: String,
    success: bool,
    error: Option<String>,
}

/// Parse rsync progress line like:
/// "         16,384 100%    4.00MB/s    0:00:00 (xfr#2, to-chk=5/10)"
fn parse_rsync_progress(line: &str) -> Option<(String, u8, String, String)> {
    // Match pattern: bytes percentage speed eta
    let re = Regex::new(r"^\s*([\d,]+)\s+(\d+)%\s+([\d.]+[KMG]?B/s)\s+(\d+:\d+:\d+)").ok()?;
    let caps = re.captures(line)?;

    let transferred = caps.get(1)?.as_str().to_string();
    let percentage: u8 = caps.get(2)?.as_str().parse().ok()?;
    let speed = caps.get(3)?.as_str().to_string();
    let eta = caps.get(4)?.as_str().to_string();

    Some((transferred, percentage, speed, eta))
}

/// Calculate file count and total size for a directory
async fn calculate_snapshot_stats(path: std::path::PathBuf) -> (u64, u64) {
    tokio::task::spawn_blocking(move || {
        let mut file_count = 0u64;
        let mut total_size = 0u64;

        for entry in WalkDir::new(&path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                file_count += 1;
                if let Ok(metadata) = entry.metadata() {
                    total_size += metadata.len();
                }
            }
        }

        (file_count, total_size)
    })
    .await
    .unwrap_or((0, 0))
}

/// Spawn the rsync process and emit initial log messages
fn spawn_rsync_process(
    service: &RsyncService,
    job: &SyncJob,
    app: &tauri::AppHandle,
) -> Result<std::process::Child> {
    log::info!(
        "[run_rsync] Command invoked for job '{}' (id: {})",
        job.name,
        job.id
    );
    log::info!(
        "[run_rsync] source: '{}', dest: '{}', mode: {:?}",
        job.source_path,
        job.dest_path,
        job.mode
    );

    // Emit initial log message so UI shows something immediately
    let _ = app.emit(
        "rsync-log",
        RsyncLogPayload {
            job_id: job.id.clone(),
            message: format!("Starting rsync: {} → {}", job.source_path, job.dest_path),
        },
    );

    let child = service.spawn_rsync(job)?;

    // Emit the actual command being run
    let _ = app.emit(
        "rsync-log",
        RsyncLogPayload {
            job_id: job.id.clone(),
            message: format!("rsync process started with PID: {}", child.id()),
        },
    );

    Ok(child)
}

/// Set up output stream handlers for stdout and stderr
fn setup_output_streams(
    child: &mut std::process::Child,
    job: &SyncJob,
    app: &tauri::AppHandle,
) -> (
    Option<std::thread::JoinHandle<()>>,
    Option<std::thread::JoinHandle<()>>,
) {
    // Take stdout for streaming (must be done before wait)
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let job_id = job.id.clone();
    let app_handle = app.clone();

    // Spawn thread to read stdout and emit events
    let stdout_handle = stdout.map(|stdout| {
        let job_id = job_id.clone();
        let app = app_handle.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            let mut current_file: Option<String> = None;

            for line in reader.lines().flatten() {
                // Skip empty lines
                if line.trim().is_empty() {
                    continue;
                }

                // Try to parse as progress line
                if let Some((transferred, percentage, speed, eta)) = parse_rsync_progress(&line) {
                    let _ = app.emit(
                        "rsync-progress",
                        RsyncProgressPayload {
                            job_id: job_id.clone(),
                            transferred,
                            percentage,
                            speed,
                            eta,
                            current_file: current_file.clone(),
                        },
                    );
                } else {
                    // Non-progress line (file name or info)
                    // Update current file if it looks like a filename
                    if !line.starts_with("sending")
                        && !line.starts_with("receiving")
                        && !line.starts_with("total")
                        && !line.contains("files to consider")
                    {
                        current_file = Some(line.clone());
                    }

                    // Emit as log
                    let _ = app.emit(
                        "rsync-log",
                        RsyncLogPayload {
                            job_id: job_id.clone(),
                            message: line,
                        },
                    );
                }
            }
        })
    });

    // Spawn thread to read stderr
    let stderr_handle = stderr.map(|stderr| {
        let job_id = job_id.clone();
        let app = app_handle.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                if !line.trim().is_empty() {
                    let _ = app.emit(
                        "rsync-log",
                        RsyncLogPayload {
                            job_id: job_id.clone(),
                            message: format!("[stderr] {}", line),
                        },
                    );
                }
            }
        })
    });

    (stdout_handle, stderr_handle)
}

/// Wait for child threads to complete
fn wait_for_threads(
    stdout_handle: Option<std::thread::JoinHandle<()>>,
    stderr_handle: Option<std::thread::JoinHandle<()>>,
) {
    if let Some(h) = stdout_handle {
        let _ = h.join();
    }
    if let Some(h) = stderr_handle {
        let _ = h.join();
    }
}

/// Handle successful backup completion (manifest, indexing, symlinks)
async fn handle_backup_success(
    service: &RsyncService,
    job: &SyncJob,
    backup_info: Option<crate::services::rsync_service::BackupInfo>,
    app: &tauri::AppHandle,
) -> Result<()> {
    // Write manifest for Time Machine mode backups
    if job.mode == SyncMode::TimeMachine {
        if let Some(info) = backup_info {
            let end_time = chrono::Utc::now().timestamp_millis();
            let duration_ms = (end_time - info.start_time) as u64;

            // Calculate snapshot stats
            let (file_count, total_size) =
                calculate_snapshot_stats(info.snapshot_path.clone()).await;

            // Create snapshot entry
            let snapshot = ManifestSnapshot::new(
                info.folder_name.clone(),
                file_count,
                total_size,
                ManifestSnapshotStatus::Complete,
                Some(duration_ms),
            );

            // Get or create manifest and add snapshot
            let dest_path = job.dest_path.clone();
            match manifest_service::get_or_create_manifest(
                &dest_path,
                &job.id,
                &job.name,
                &job.source_path,
            )
            .await
            {
                Ok(_) => {
                    if let Err(e) =
                        manifest_service::add_snapshot_to_manifest(&dest_path, snapshot).await
                    {
                        log::warn!("Failed to add snapshot to manifest: {}", e);
                    }
                }
                Err(e) => {
                    log::warn!("Failed to create manifest: {}", e);
                }
            }

            // Update latest symlink
            if let Err(e) = service
                .update_latest_symlink(info.target_base.to_str().unwrap_or(""), &info.folder_name)
            {
                log::warn!("Failed to update latest symlink: {}", e);
            }

            // TIM-127: Index snapshot on destination drive
            // Store index at <dest>/.amber-meta/index.db for portability
            let snapshot_path_str = info.snapshot_path.to_string_lossy().to_string();
            let timestamp = chrono::Utc::now().timestamp_millis();

            log::info!("Indexing snapshot on destination: {}", dest_path);
            match IndexService::for_destination(&dest_path) {
                Ok(index) => {
                    if let Err(e) = index.index_snapshot(&job.id, timestamp, &snapshot_path_str) {
                        log::warn!("Failed to index snapshot on destination: {}", e);
                    } else {
                        log::info!("Snapshot indexed successfully on destination");
                    }
                }
                Err(e) => {
                    log::warn!("Failed to open destination index: {}", e);
                }
            }
        }
    }

    // Clean up backup info
    service.clear_backup_info(&job.id);

    // Emit success event
    let _ = app.emit(
        "rsync-complete",
        RsyncCompletePayload {
            job_id: job.id.clone(),
            success: true,
            error: None,
        },
    );

    Ok(())
}

/// Handle backup failure
fn handle_backup_failure(
    service: &RsyncService,
    job: &SyncJob,
    status: std::process::ExitStatus,
    app: &tauri::AppHandle,
) -> Result<()> {
    // Clean up backup info even on failure
    service.clear_backup_info(&job.id);

    let error_msg = format!("rsync exited with code {:?}", status.code());

    // Emit failure event
    let _ = app.emit(
        "rsync-complete",
        RsyncCompletePayload {
            job_id: job.id.clone(),
            success: false,
            error: Some(error_msg.clone()),
        },
    );

    Err(crate::error::AmberError::Rsync(error_msg))
}

#[tauri::command]
pub async fn run_rsync(app: tauri::AppHandle, job: SyncJob) -> Result<()> {
    let service = get_rsync_service();

    // Spawn rsync process
    let mut child = spawn_rsync_process(service, &job, &app)?;

    // Get backup info before waiting
    let backup_info = service.get_backup_info(&job.id);

    // Set up output stream handlers
    let (stdout_handle, stderr_handle) = setup_output_streams(&mut child, &job, &app);

    // Wait for completion with timeout enforcement
    let timeout_duration = Duration::from_secs(job.config.timeout_seconds);
    let wait_result = timeout(timeout_duration, async {
        // Convert blocking wait to async
        tokio::task::spawn_blocking(move || child.wait()).await
    })
    .await;

    // Handle timeout and process result
    let status = match wait_result {
        Ok(Ok(Ok(status))) => {
            // Normal completion
            status
        }
        Ok(Ok(Err(e))) => {
            // Process wait error
            wait_for_threads(stdout_handle, stderr_handle);
            service.mark_completed(&job.id);
            service.clear_backup_info(&job.id);

            let error_msg = format!("Failed to wait for rsync process: {}", e);
            let _ = app.emit(
                "rsync-complete",
                RsyncCompletePayload {
                    job_id: job.id.clone(),
                    success: false,
                    error: Some(error_msg.clone()),
                },
            );

            return Err(crate::error::AmberError::Rsync(error_msg));
        }
        Ok(Err(e)) => {
            // Task join error (shouldn't happen)
            wait_for_threads(stdout_handle, stderr_handle);
            service.mark_completed(&job.id);
            service.clear_backup_info(&job.id);

            let error_msg = format!("Task error while waiting for rsync: {}", e);
            let _ = app.emit(
                "rsync-complete",
                RsyncCompletePayload {
                    job_id: job.id.clone(),
                    success: false,
                    error: Some(error_msg.clone()),
                },
            );

            return Err(crate::error::AmberError::Rsync(error_msg));
        }
        Err(_) => {
            // Timeout expired - kill the process
            log::warn!(
                "[run_rsync] Backup timed out after {} seconds for job '{}' (id: {})",
                job.config.timeout_seconds,
                job.name,
                job.id
            );

            // Attempt to kill the rsync process
            if let Err(e) = service.kill_job(&job.id) {
                log::error!("Failed to kill timed-out rsync process: {}", e);
            }

            // Wait for reader threads to finish processing output
            wait_for_threads(stdout_handle, stderr_handle);

            service.mark_completed(&job.id);
            service.clear_backup_info(&job.id);

            let error_msg = format!(
                "Backup timed out after {} seconds",
                job.config.timeout_seconds
            );

            let _ = app.emit(
                "rsync-complete",
                RsyncCompletePayload {
                    job_id: job.id.clone(),
                    success: false,
                    error: Some(error_msg.clone()),
                },
            );

            return Err(crate::error::AmberError::Rsync(error_msg));
        }
    };

    // Wait for reader threads
    wait_for_threads(stdout_handle, stderr_handle);

    // Mark completed
    service.mark_completed(&job.id);

    // TODO: Implement stall timeout detection
    // The stall_timeout_seconds config field should detect when no progress is made
    // for a certain duration. This requires tracking the last progress event timestamp
    // and comparing it against the stall timeout. Implementation would involve:
    // 1. Shared atomic timestamp updated by the stdout reader thread on progress events
    // 2. Periodic check in a separate task to compare current time vs last progress
    // 3. Kill process if (current_time - last_progress) > stall_timeout_seconds

    // Handle success or failure
    if status.success() {
        handle_backup_success(service, &job, backup_info, &app).await
    } else {
        handle_backup_failure(service, &job, status, &app)
    }
}

#[tauri::command]
pub async fn kill_rsync(job_id: String) -> Result<()> {
    let service = get_rsync_service();
    service.kill_job(&job_id)
}
