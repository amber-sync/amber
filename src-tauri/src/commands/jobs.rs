use crate::error::Result;
use crate::services::store::Store;
use crate::types::job::SyncJob;
use std::path::PathBuf;

fn get_store() -> Store {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("amber");
    Store::new(&data_dir)
}

#[tauri::command]
pub async fn get_jobs() -> Result<Vec<SyncJob>> {
    let store = get_store();
    store.load_jobs()
}

#[tauri::command]
pub async fn save_job(job: SyncJob) -> Result<()> {
    let store = get_store();
    store.save_job(job)
}

#[tauri::command]
pub async fn delete_job(job_id: String) -> Result<()> {
    let store = get_store();
    store.delete_job(&job_id)
}
