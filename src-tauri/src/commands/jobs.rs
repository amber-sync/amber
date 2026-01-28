use crate::error::Result;
use crate::services::cache_service;
use crate::services::manifest_service;
use crate::state::AppState;
use crate::types::job::SyncJob;
use crate::types::manifest::ManifestSnapshot;
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;

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

impl SnapshotInfo {
    /// Create SnapshotInfo with a full path (dest_path + folder_name)
    pub fn from_manifest_with_path(s: ManifestSnapshot, full_path: String) -> Self {
        Self {
            id: s.id,
            timestamp: s.timestamp,
            size_bytes: s.total_size,
            file_count: s.file_count,
            changes_count: s.changes_count.unwrap_or(0),
            status: match s.status {
                crate::types::manifest::ManifestSnapshotStatus::Complete => "Complete".to_string(),
                crate::types::manifest::ManifestSnapshotStatus::Partial => "Partial".to_string(),
                crate::types::manifest::ManifestSnapshotStatus::Failed => "Failed".to_string(),
            },
            duration: s.duration_ms,
            path: Some(full_path),
        }
    }
}

impl From<ManifestSnapshot> for SnapshotInfo {
    fn from(s: ManifestSnapshot) -> Self {
        Self {
            id: s.id,
            timestamp: s.timestamp,
            size_bytes: s.total_size,
            file_count: s.file_count,
            changes_count: s.changes_count.unwrap_or(0),
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
pub async fn get_jobs(state: State<'_, AppState>) -> Result<Vec<SyncJob>> {
    state.store.load_jobs()
}

/// Get jobs with mount status and snapshots from manifests
/// This is the preferred endpoint for the UI
#[tauri::command]
pub async fn get_jobs_with_status(state: State<'_, AppState>) -> Result<Vec<JobWithStatus>> {
    let jobs = state.store.load_jobs()?;

    // Pre-compute mount status and volume info for all jobs
    let job_info: Vec<_> = jobs
        .iter()
        .map(|job| {
            let dest_path = Path::new(&job.dest_path);
            let mounted = dest_path.exists() && dest_path.is_dir();
            let vol_info = crate::utils::get_volume_info(&job.dest_path);
            (mounted, vol_info)
        })
        .collect();

    // Create futures for parallel manifest/cache loading
    let snapshot_futures: Vec<_> = jobs
        .iter()
        .zip(&job_info)
        .map(|(job, (mounted, _))| {
            let job_id = job.id.clone();
            let dest_path = job.dest_path.clone();
            let mounted = *mounted;

            async move {
                if mounted {
                    // Try to load from manifest
                    match manifest_service::read_manifest(&dest_path).await {
                        Ok(Some(manifest)) => {
                            // Update the local cache with fresh data
                            let manifest_snapshots = manifest.snapshots.clone();
                            if let Err(e) =
                                cache_service::write_snapshot_cache(&job_id, manifest_snapshots)
                                    .await
                            {
                                log::warn!(
                                    "Failed to update snapshot cache for job {}: {}",
                                    job_id,
                                    e
                                );
                            }

                            // Build full paths for snapshots using dest_path + folder_name
                            let snaps: Vec<SnapshotInfo> = manifest
                                .snapshots
                                .into_iter()
                                .map(|s| {
                                    let full_path = Path::new(&dest_path)
                                        .join(&s.folder_name)
                                        .to_string_lossy()
                                        .to_string();
                                    SnapshotInfo::from_manifest_with_path(s, full_path)
                                })
                                .collect();
                            (snaps, "manifest".to_string(), None)
                        }
                        Ok(None) => (Vec::new(), "none".to_string(), None),
                        Err(e) => {
                            log::warn!("Failed to read manifest for job {}: {}", job_id, e);
                            (Vec::new(), "none".to_string(), None)
                        }
                    }
                } else {
                    // Not mounted - try to load from cache
                    match cache_service::read_snapshot_cache(&job_id).await {
                        Ok(Some(cache)) => {
                            // Build full paths for cached snapshots using dest_path + folder_name
                            let snaps: Vec<SnapshotInfo> = cache
                                .snapshots
                                .into_iter()
                                .map(|s| {
                                    let full_path = Path::new(&dest_path)
                                        .join(&s.folder_name)
                                        .to_string_lossy()
                                        .to_string();
                                    SnapshotInfo::from_manifest_with_path(s, full_path)
                                })
                                .collect();
                            (snaps, "cache".to_string(), Some(cache.cached_at))
                        }
                        Ok(None) => (Vec::new(), "none".to_string(), None),
                        Err(e) => {
                            log::warn!("Failed to read snapshot cache for job {}: {}", job_id, e);
                            (Vec::new(), "none".to_string(), None)
                        }
                    }
                }
            }
        })
        .collect();

    // Execute all snapshot loading operations in parallel
    let snapshot_results = join_all(snapshot_futures).await;

    // Build final results by combining jobs with their snapshot data
    let results: Vec<JobWithStatus> = jobs
        .into_iter()
        .zip(job_info)
        .zip(snapshot_results)
        .map(
            |((job, (mounted, vol_info)), (snapshots, snapshot_source, cached_at))| JobWithStatus {
                job,
                mounted,
                is_external: vol_info.is_external,
                volume_name: vol_info.volume_name,
                snapshots,
                snapshot_source,
                cached_at,
            },
        )
        .collect();

    Ok(results)
}

#[tauri::command]
pub async fn save_job(state: State<'_, AppState>, job: SyncJob) -> Result<()> {
    // Save to local store first
    state.store.save_job(job.clone())?;

    // TIM-128: Also write job config to destination's .amber-meta/job.json
    // This enables backup drive portability
    if let Err(e) = state.store.write_job_to_destination(&job) {
        log::warn!("Failed to write job config to destination: {}", e);
        // Don't fail the overall save - destination might not be mounted
    }

    // Update path validator with new job roots for security
    if let Err(e) = state.update_job_roots() {
        log::warn!("Failed to update path validator: {}", e);
        // Don't fail the overall save - path validation will use previous roots
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_job(state: State<'_, AppState>, job_id: String) -> Result<()> {
    // Clear the snapshot cache for this job
    if let Err(e) = cache_service::delete_snapshot_cache(&job_id).await {
        log::warn!("Failed to delete snapshot cache for job {}: {}", job_id, e);
    }

    state.store.delete_job(&job_id)?;

    if let Err(e) = state.update_job_roots() {
        log::warn!("Failed to update path validator after delete: {}", e);
    }

    Ok(())
}

/// Delete backup data from the destination path
/// This removes the entire backup directory including all snapshots
#[tauri::command]
pub async fn delete_job_data(job_id: String, dest_path: String) -> Result<()> {
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

    // Security hardening: Canonicalize path to resolve symlinks and relative paths
    // This prevents attacks like /Volumes/Drive/../../system or symlink-based traversal
    let canonical = std::fs::canonicalize(path).map_err(|e| {
        crate::error::AmberError::InvalidPath(format!(
            "Failed to resolve path {}: {}",
            dest_path, e
        ))
    })?;

    let canonical_str = canonical.to_string_lossy();

    // Require a valid manifest marker to prevent deleting arbitrary folders
    let manifest = manifest_service::read_manifest(canonical_str.as_ref())
        .await
        .map_err(|e| crate::error::AmberError::Filesystem(e.to_string()))?;
    if manifest.is_none() {
        return Err(crate::error::AmberError::NotFound(format!(
            "No Amber manifest found at: {}",
            canonical_str
        )));
    }
    let manifest = manifest.unwrap();
    if manifest.job_id != job_id {
        return Err(crate::error::AmberError::PermissionDenied(format!(
            "Manifest job id does not match requested job id: {}",
            manifest.job_id
        )));
    }

    // Only allow deleting paths on external volumes (not system drive)
    // This is a critical safety check to prevent accidental data loss

    // Must be under /Volumes/ but NOT on Macintosh HD (system drive)
    if !canonical_str.starts_with("/Volumes/") {
        return Err(crate::error::AmberError::InvalidPath(format!(
            "Can only delete backup data on external volumes: {}",
            dest_path
        )));
    }

    if canonical_str.starts_with("/Volumes/Macintosh HD") {
        return Err(crate::error::AmberError::InvalidPath(format!(
            "Cannot delete data on system volume: {}",
            dest_path
        )));
    }

    // Security: Check path component depth to prevent deleting entire volumes
    // Must have at least: / + Volumes + DriveName + BackupDir
    // This prevents attacks like /Volumes/Drive/. or /Volumes/Drive/..
    let components: Vec<_> = canonical.components().collect();
    if components.len() < 4 {
        return Err(crate::error::AmberError::InvalidPath(format!(
            "Cannot delete entire volume or root directory: {}",
            dest_path
        )));
    }

    // Additional check: ensure we're not at the volume root
    // by verifying there's at least one directory after /Volumes/DriveName/
    let path_after_volumes = canonical_str.strip_prefix("/Volumes/").unwrap_or("");
    if !path_after_volumes.contains('/') {
        return Err(crate::error::AmberError::InvalidPath(format!(
            "Cannot delete entire volume: {}",
            dest_path
        )));
    }

    // Remove the directory and all contents
    fs::remove_dir_all(&canonical).await.map_err(|e| {
        crate::error::AmberError::Io(std::io::Error::other(format!(
            "Failed to delete backup data: {}",
            e
        )))
    })?;

    log::info!("Deleted backup data at: {}", canonical_str);
    Ok(())
}
