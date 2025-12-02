use crate::error::{AmberError, Result};
use crate::services::rclone_service::{RcloneRemote, RcloneService, RcloneStatus};
use crate::types::job::SyncJob;
use std::sync::OnceLock;

static RCLONE_SERVICE: OnceLock<RcloneService> = OnceLock::new();

fn get_rclone_service() -> &'static RcloneService {
    RCLONE_SERVICE.get_or_init(RcloneService::new)
}

/// Check if rclone is installed and get version info
#[tauri::command]
pub async fn check_rclone() -> Result<RcloneStatus> {
    let service = get_rclone_service();
    service.check_installation()
}

/// List all configured rclone remotes
#[tauri::command]
pub async fn list_rclone_remotes() -> Result<Vec<RcloneRemote>> {
    let service = get_rclone_service();
    service.list_remotes()
}

/// Run an rclone sync job for cloud backup
#[tauri::command]
pub async fn run_rclone(job: SyncJob) -> Result<()> {
    let cloud_config = job.cloud_config.as_ref().ok_or_else(|| {
        AmberError::Rclone("Job has no cloud configuration".to_string())
    })?;

    let service = get_rclone_service();
    let mut child = service.spawn_sync(
        &job.id,
        &job.source_path,
        &cloud_config.remote_name,
        cloud_config.remote_path.as_deref(),
        cloud_config.bandwidth.as_deref(),
        cloud_config.encrypt,
    )?;

    // Wait for completion
    let status = child.wait()?;

    // Mark completed
    service.mark_completed(&job.id);

    if status.success() {
        Ok(())
    } else {
        Err(AmberError::Rclone(format!(
            "rclone exited with code {:?}",
            status.code()
        )))
    }
}

/// Kill a running rclone sync job
#[tauri::command]
pub async fn kill_rclone(job_id: String) -> Result<()> {
    let service = get_rclone_service();
    service.kill_job(&job_id)
}
