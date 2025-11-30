use crate::error::Result;
use crate::types::job::SyncJob;

#[tauri::command]
pub async fn run_rsync(_job: SyncJob) -> Result<()> {
    // TODO: Implement rsync execution
    Ok(())
}

#[tauri::command]
pub async fn kill_rsync(_job_id: String) -> Result<()> {
    // TODO: Implement rsync cancellation
    Ok(())
}
