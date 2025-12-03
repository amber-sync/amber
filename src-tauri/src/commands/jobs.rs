use crate::error::Result;
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
    /// Snapshots loaded from manifest (when mounted)
    pub snapshots: Vec<SnapshotInfo>,
    /// Source of snapshot data: "manifest" or "cache" or "none"
    pub snapshot_source: String,
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

        // Check if external volume
        let is_external = job.dest_path.starts_with("/Volumes/")
            && !job.dest_path.starts_with("/Volumes/Macintosh HD");

        let volume_name = if is_external {
            job.dest_path
                .strip_prefix("/Volumes/")
                .and_then(|rest| rest.split('/').next())
                .map(String::from)
        } else {
            None
        };

        // Load snapshots from manifest if mounted
        let (snapshots, snapshot_source) = if mounted {
            match manifest_service::read_manifest(&job.dest_path).await {
                Ok(Some(manifest)) => {
                    let snaps: Vec<SnapshotInfo> = manifest
                        .snapshots
                        .into_iter()
                        .map(SnapshotInfo::from)
                        .collect();
                    (snaps, "manifest".to_string())
                }
                Ok(None) => (Vec::new(), "none".to_string()),
                Err(_) => (Vec::new(), "none".to_string()),
            }
        } else {
            // TODO: TIM-111 - Load from local cache when not mounted
            (Vec::new(), "none".to_string())
        };

        results.push(JobWithStatus {
            job,
            mounted,
            is_external,
            volume_name,
            snapshots,
            snapshot_source,
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
    store.delete_job(&job_id)
}
