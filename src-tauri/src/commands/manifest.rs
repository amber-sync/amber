use crate::services::manifest_service;
use crate::types::manifest::{BackupManifest, ManifestSnapshot, ManifestSnapshotStatus};
use crate::utils::validation::validate_job_id;

/// Get manifest from a backup destination
#[tauri::command]
pub async fn get_manifest(dest_path: String) -> Result<Option<BackupManifest>, String> {
    manifest_service::read_manifest(&dest_path)
        .await
        .map_err(|e| e.to_string())
}

/// Create or get existing manifest for a job
#[tauri::command]
pub async fn get_or_create_manifest(
    dest_path: String,
    job_id: String,
    job_name: String,
    source_path: String,
) -> Result<BackupManifest, String> {
    validate_job_id(&job_id).map_err(|e| e.to_string())?;
    manifest_service::get_or_create_manifest(&dest_path, &job_id, &job_name, &source_path)
        .await
        .map_err(|e| e.to_string())
}

/// Check if manifest exists at destination
#[tauri::command]
pub async fn manifest_exists(dest_path: String) -> bool {
    manifest_service::manifest_exists(&dest_path).await
}

/// Add a snapshot to an existing manifest
#[tauri::command]
pub async fn add_manifest_snapshot(
    dest_path: String,
    folder_name: String,
    file_count: u64,
    total_size: u64,
    status: String,
    duration_ms: Option<u64>,
) -> Result<BackupManifest, String> {
    let status = match status.as_str() {
        "Complete" => ManifestSnapshotStatus::Complete,
        "Partial" => ManifestSnapshotStatus::Partial,
        "Failed" => ManifestSnapshotStatus::Failed,
        _ => return Err("Invalid snapshot status".to_string()),
    };

    let snapshot = ManifestSnapshot::new(folder_name, file_count, total_size, status, duration_ms);

    manifest_service::add_snapshot_to_manifest(&dest_path, snapshot)
        .await
        .map_err(|e| e.to_string())
}

/// Remove a snapshot from manifest
#[tauri::command]
pub async fn remove_manifest_snapshot(
    dest_path: String,
    snapshot_id: String,
) -> Result<Option<ManifestSnapshot>, String> {
    manifest_service::remove_snapshot_from_manifest(&dest_path, &snapshot_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get the .amber-meta directory path for a destination
#[tauri::command]
pub fn get_amber_meta_path(dest_path: String) -> String {
    manifest_service::get_meta_dir(&dest_path)
        .to_string_lossy()
        .to_string()
}
