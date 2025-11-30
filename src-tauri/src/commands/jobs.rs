use crate::error::Result;
use crate::types::job::SyncJob;

#[tauri::command]
pub async fn get_jobs() -> Result<Vec<SyncJob>> {
    // TODO: Implement job retrieval
    Ok(vec![])
}

#[tauri::command]
pub async fn save_job(_job: SyncJob) -> Result<()> {
    // TODO: Implement job saving
    Ok(())
}

#[tauri::command]
pub async fn delete_job(_job_id: String) -> Result<()> {
    // TODO: Implement job deletion
    Ok(())
}
