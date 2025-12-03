use crate::error::Result;
use crate::services::cache_service;
use crate::services::manifest_service;
use crate::services::store::Store;
use crate::types::job::SyncJob;
use crate::types::manifest::ManifestSnapshot;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

fn get_store() -> Store {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("amber");
    Store::new(&data_dir)
}

/// Snapshot data returned from manifest (converted to frontend format)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotInfo {
    pub id: String,
    pub timestamp: i64,
    pub size_bytes: u64,
    pub file_count: u64,
    pub changes_count: u64,
    pub status: String,
    pub duration: Option<u64>,
    pub path: Option<String>,
}

impl From<ManifestSnapshot> for SnapshotInfo {
    fn from(s: ManifestSnapshot) -> Self {
        Self {
            id: s.id,
            timestamp: s.timestamp,
            size_bytes: s.total_size,
            file_count: s.file_count,
            changes_count: 0, // Not tracked in manifest
            status: match s.status {
                crate::types::manifest::ManifestSnapshotStatus::Complete => "Complete".to_string(),
                crate::types::manifest::ManifestSnapshotStatus::Partial => "Partial".to_string(),
                crate::types::manifest::ManifestSnapshotStatus::Failed => "Failed".to_string(),
            },
            duration: s.duration_ms,
            path: Some(s.folder_name),
        }
    }
}

/// Job with mount status and snapshots from manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobWithStatus {
    /// The job configuration
    #[serde(flatten)]
    pub job: SyncJob,
    /// Whether the destination is currently mounted/accessible
    pub mounted: bool,
    /// Whether the destination is an external volume
    pub is_external: bool,
    /// Volume name if external
    pub volume_name: Option<String>,
    /// Snapshots loaded from manifest or cache
    pub snapshots: Vec<SnapshotInfo>,
    /// Source of snapshot data: "manifest" or "cache" or "none"
    pub snapshot_source: String,
    /// When the cache was last updated (unix ms), only set when source is "cache"
    pub cached_at: Option<i64>,
}

#[tauri::command]
pub async fn get_jobs() -> Result<Vec<SyncJob>> {
    let store = get_store();
    store.load_jobs()
}

/// Get jobs with mount status and snapshots from manifests
/// This is the preferred endpoint for the UI
#[tauri::command]
pub async fn get_jobs_with_status() -> Result<Vec<JobWithStatus>> {
    let store = get_store();
    let jobs = store.load_jobs()?;

    let mut results = Vec::with_capacity(jobs.len());

    for job in jobs {
        let dest_path = Path::new(&job.dest_path);
        let mounted = dest_path.exists() && dest_path.is_dir();

        // Get volume info using shared helper
        let vol_info = crate::utils::get_volume_info(&job.dest_path);

        // Load snapshots from manifest if mounted, otherwise from cache
        let (snapshots, snapshot_source, cached_at) = if mounted {
            match manifest_service::read_manifest(&job.dest_path).await {
                Ok(Some(manifest)) => {
                    // Update the local cache with fresh data
                    let manifest_snapshots = manifest.snapshots.clone();
                    if let Err(e) = cache_service::write_snapshot_cache(&job.id, manifest_snapshots).await {
                        log::warn!("Failed to update snapshot cache for job {}: {}", job.id, e);
                    }

                    let snaps: Vec<SnapshotInfo> = manifest
                        .snapshots
                        .into_iter()
                        .map(SnapshotInfo::from)
                        .collect();
                    (snaps, "manifest".to_string(), None)
                }
                Ok(None) => (Vec::new(), "none".to_string(), None),
                Err(_) => (Vec::new(), "none".to_string(), None),
            }
        } else {
            // Not mounted - try to load from cache
            match cache_service::read_snapshot_cache(&job.id).await {
                Ok(Some(cache)) => {
                    let snaps: Vec<SnapshotInfo> = cache
                        .snapshots
                        .into_iter()
                        .map(SnapshotInfo::from)
                        .collect();
                    (snaps, "cache".to_string(), Some(cache.cached_at))
                }
                Ok(None) => (Vec::new(), "none".to_string(), None),
                Err(_) => (Vec::new(), "none".to_string(), None),
            }
        };

        results.push(JobWithStatus {
            job,
            mounted,
            is_external: vol_info.is_external,
            volume_name: vol_info.volume_name,
            snapshots,
            snapshot_source,
            cached_at,
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn save_job(job: SyncJob) -> Result<()> {
    let store = get_store();
    store.save_job(job)
}

#[tauri::command]
pub async fn delete_job(job_id: String) -> Result<()> {
    let store = get_store();

    // Clear the snapshot cache for this job
    if let Err(e) = cache_service::delete_snapshot_cache(&job_id).await {
        log::warn!("Failed to delete snapshot cache for job {}: {}", job_id, e);
    }

    store.delete_job(&job_id)
}

/// Delete backup data from the destination path
/// This removes the entire backup directory including all snapshots
#[tauri::command]
pub async fn delete_job_data(dest_path: String) -> Result<()> {
    use tokio::fs;

    let path = Path::new(&dest_path);

    // Safety checks
    if !path.exists() {
        return Err(crate::error::AmberError::NotFound(format!(
            "Backup path does not exist: {}",
            dest_path
        )));
    }

    if !path.is_dir() {
        return Err(crate::error::AmberError::InvalidPath(format!(
            "Backup path is not a directory: {}",
            dest_path
        )));
    }

    // Only allow deleting paths on external volumes (not system drive)
    // This is a critical safety check to prevent accidental data loss
    let path_str = dest_path.trim_end_matches('/');

    // Must be under /Volumes/ but NOT on Macintosh HD (system drive)
    if !path_str.starts_with("/Volumes/") {
        return Err(crate::error::AmberError::InvalidPath(format!(
            "Can only delete backup data on external volumes: {}",
            dest_path
        )));
    }

    if path_str.starts_with("/Volumes/Macintosh HD") {
        return Err(crate::error::AmberError::InvalidPath(format!(
            "Cannot delete data on system volume: {}",
            dest_path
        )));
    }

    // Don't allow deleting the volume root itself
    let path_after_volumes = path_str.strip_prefix("/Volumes/").unwrap_or("");
    if !path_after_volumes.contains('/') {
        return Err(crate::error::AmberError::InvalidPath(format!(
            "Cannot delete entire volume: {}",
            dest_path
        )));
    }

    // Remove the directory and all contents
    fs::remove_dir_all(path).await.map_err(|e| {
        crate::error::AmberError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to delete backup data: {}", e),
        ))
    })?;

    log::info!("Deleted backup data at: {}", dest_path);
    Ok(())
}
