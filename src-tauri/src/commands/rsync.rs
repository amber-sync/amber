use crate::error::Result;
use crate::services::rsync_service::RsyncService;
use crate::types::job::SyncJob;
use std::sync::OnceLock;

static RSYNC_SERVICE: OnceLock<RsyncService> = OnceLock::new();

fn get_rsync_service() -> &'static RsyncService {
    RSYNC_SERVICE.get_or_init(RsyncService::new)
}

#[tauri::command]
pub async fn run_rsync(job: SyncJob) -> Result<()> {
    let service = get_rsync_service();
    let mut child = service.spawn_rsync(&job)?;

    // Wait for completion
    let status = child.wait()?;

    // Mark completed
    service.mark_completed(&job.id);

    if status.success() {
        Ok(())
    } else {
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
