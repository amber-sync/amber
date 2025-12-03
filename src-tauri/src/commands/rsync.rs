use crate::error::Result;
use crate::services::manifest_service;
use crate::services::rsync_service::RsyncService;
use crate::types::job::{SyncJob, SyncMode};
use crate::types::manifest::{ManifestSnapshot, ManifestSnapshotStatus};
use std::sync::OnceLock;
use walkdir::WalkDir;

static RSYNC_SERVICE: OnceLock<RsyncService> = OnceLock::new();

fn get_rsync_service() -> &'static RsyncService {
    RSYNC_SERVICE.get_or_init(RsyncService::new)
}

/// Calculate file count and total size for a directory
fn calculate_snapshot_stats(path: &std::path::Path) -> (u64, u64) {
    let mut file_count = 0u64;
    let mut total_size = 0u64;

    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            file_count += 1;
            if let Ok(metadata) = entry.metadata() {
                total_size += metadata.len();
            }
        }
    }

    (file_count, total_size)
}

#[tauri::command]
pub async fn run_rsync(job: SyncJob) -> Result<()> {
    let service = get_rsync_service();
    let mut child = service.spawn_rsync(&job)?;

    // Get backup info before waiting
    let backup_info = service.get_backup_info(&job.id);

    // Wait for completion
    let status = child.wait()?;

    // Mark completed
    service.mark_completed(&job.id);

    if status.success() {
        // Write manifest for Time Machine mode backups
        if job.mode == SyncMode::TimeMachine {
            if let Some(info) = backup_info {
                let end_time = chrono::Utc::now().timestamp_millis();
                let duration_ms = (end_time - info.start_time) as u64;

                // Calculate snapshot stats
                let (file_count, total_size) = calculate_snapshot_stats(&info.snapshot_path);

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
                if let Err(e) = service.update_latest_symlink(
                    info.target_base.to_str().unwrap_or(""),
                    &info.folder_name,
                ) {
                    log::warn!("Failed to update latest symlink: {}", e);
                }
            }
        }

        // Clean up backup info
        service.clear_backup_info(&job.id);

        Ok(())
    } else {
        // Clean up backup info even on failure
        service.clear_backup_info(&job.id);

        Err(crate::error::AmberError::Rsync(format!(
            "rsync exited with code {:?}",
            status.code()
        )))
    }
}

#[tauri::command]
pub async fn kill_rsync(job_id: String) -> Result<()> {
    let service = get_rsync_service();
    service.kill_job(&job_id)
}
