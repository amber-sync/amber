//! Migration service for upgrading from embedded snapshots to manifest-based architecture
//!
//! Handles migration of jobs.json from the old format (snapshots embedded in job)
//! to the new format (snapshots in manifest.json on backup drive + local cache)

use crate::services::{cache_service, manifest_service, store::Store};
use crate::types::manifest::{BackupManifest, ManifestSnapshot, ManifestSnapshotStatus};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Result of migrating a single job
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobMigrationResult {
    pub job_id: String,
    pub job_name: String,
    pub snapshots_migrated: usize,
    pub manifest_written: bool,
    pub cache_written: bool,
    pub error: Option<String>,
}

/// Overall migration report
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationReport {
    pub jobs_migrated: usize,
    pub jobs_skipped: usize,
    pub total_snapshots_migrated: usize,
    pub manifests_written: usize,
    pub caches_written: usize,
    pub results: Vec<JobMigrationResult>,
}

/// Old snapshot format from jobs.json (for parsing)
/// This mirrors what used to be stored in jobs
/// Note: Some fields are only needed for deserialization compatibility
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacySnapshot {
    timestamp: i64,
    /// Path field exists in legacy format but is not used in migration
    #[serde(default)]
    #[allow(dead_code)]
    path: Option<String>,
    #[serde(default)]
    size_bytes: Option<u64>,
    #[serde(default)]
    file_count: Option<u64>,
    /// Changes count exists in legacy format but is not tracked in manifest
    #[serde(default)]
    #[allow(dead_code)]
    changes_count: Option<u64>,
}

impl LegacySnapshot {
    /// Convert legacy snapshot to ManifestSnapshot
    fn to_manifest_snapshot(&self) -> ManifestSnapshot {
        // Generate folder name from timestamp
        let datetime = chrono::DateTime::from_timestamp_millis(self.timestamp)
            .unwrap_or_else(|| chrono::Utc::now());
        let folder_name = datetime.format("%Y-%m-%d-%H%M%S").to_string();

        ManifestSnapshot::from_timestamp(
            self.timestamp,
            folder_name,
            self.file_count.unwrap_or(0),
            self.size_bytes.unwrap_or(0),
            ManifestSnapshotStatus::Complete,
        )
    }
}

/// Check if migration is needed (any jobs have embedded snapshots)
pub fn needs_migration(store: &Store) -> bool {
    match store.load_jobs() {
        Ok(jobs) => jobs
            .iter()
            .any(|job| job.snapshots.as_ref().map_or(false, |s| !s.is_empty())),
        Err(_) => false,
    }
}

/// Run the migration
/// Converts embedded snapshots to manifest + cache format
pub async fn run_migration(store: &Store) -> Result<MigrationReport, MigrationError> {
    let jobs = store
        .load_jobs()
        .map_err(|e| MigrationError::LoadError(format!("Failed to load jobs: {}", e)))?;

    let mut report = MigrationReport {
        jobs_migrated: 0,
        jobs_skipped: 0,
        total_snapshots_migrated: 0,
        manifests_written: 0,
        caches_written: 0,
        results: Vec::new(),
    };

    for job in &jobs {
        // Check if job has embedded snapshots to migrate
        let snapshots_data = match &job.snapshots {
            Some(snapshots) if !snapshots.is_empty() => snapshots,
            _ => {
                report.jobs_skipped += 1;
                continue;
            }
        };

        let mut result = JobMigrationResult {
            job_id: job.id.clone(),
            job_name: job.name.clone(),
            snapshots_migrated: 0,
            manifest_written: false,
            cache_written: false,
            error: None,
        };

        // Parse legacy snapshots
        let manifest_snapshots: Vec<ManifestSnapshot> = snapshots_data
            .iter()
            .filter_map(|v| {
                serde_json::from_value::<LegacySnapshot>(v.clone())
                    .ok()
                    .map(|ls| ls.to_manifest_snapshot())
            })
            .collect();

        result.snapshots_migrated = manifest_snapshots.len();

        // Check if destination is mounted
        let dest_mounted = Path::new(&job.dest_path).exists();

        // Write manifest if destination is accessible
        if dest_mounted {
            match write_manifest_for_job(job, &manifest_snapshots).await {
                Ok(_) => {
                    result.manifest_written = true;
                    report.manifests_written += 1;
                }
                Err(e) => {
                    log::warn!("Failed to write manifest for job {}: {}", job.id, e);
                    result.error = Some(format!("Manifest write failed: {}", e));
                }
            }
        }

        // Always write to local cache
        match cache_service::write_snapshot_cache(&job.id, manifest_snapshots.clone()).await {
            Ok(_) => {
                result.cache_written = true;
                report.caches_written += 1;
            }
            Err(e) => {
                log::warn!("Failed to write cache for job {}: {}", job.id, e);
                if result.error.is_none() {
                    result.error = Some(format!("Cache write failed: {}", e));
                }
            }
        }

        report.total_snapshots_migrated += result.snapshots_migrated;
        report.jobs_migrated += 1;
        report.results.push(result);
    }

    // Re-save all jobs (which will strip the snapshots due to skip_serializing)
    store
        .save_jobs(&jobs)
        .map_err(|e| MigrationError::SaveError(format!("Failed to save migrated jobs: {}", e)))?;

    log::info!(
        "Migration complete: {} jobs migrated, {} snapshots, {} manifests, {} caches",
        report.jobs_migrated,
        report.total_snapshots_migrated,
        report.manifests_written,
        report.caches_written
    );

    Ok(report)
}

/// Write manifest for a job during migration
async fn write_manifest_for_job(
    job: &crate::types::job::SyncJob,
    snapshots: &[ManifestSnapshot],
) -> Result<(), MigrationError> {
    // Check if manifest already exists
    if manifest_service::manifest_exists(&job.dest_path).await {
        // Read existing manifest and merge snapshots
        if let Ok(Some(mut manifest)) = manifest_service::read_manifest(&job.dest_path).await {
            // Add any snapshots that don't already exist
            for snapshot in snapshots {
                if manifest.get_snapshot(&snapshot.id).is_none() {
                    manifest.add_snapshot(snapshot.clone());
                }
            }
            manifest_service::write_manifest(&job.dest_path, &manifest)
                .await
                .map_err(|e| MigrationError::ManifestError(e.to_string()))?;
        }
    } else {
        // Create new manifest
        let machine_id = crate::utils::get_machine_id();
        let mut manifest = BackupManifest::new(
            job.id.clone(),
            job.name.clone(),
            job.source_path.clone(),
            machine_id,
        );

        for snapshot in snapshots {
            manifest.add_snapshot(snapshot.clone());
        }

        manifest_service::write_manifest(&job.dest_path, &manifest)
            .await
            .map_err(|e| MigrationError::ManifestError(e.to_string()))?;
    }

    Ok(())
}

/// Errors that can occur during migration
#[derive(Debug, thiserror::Error)]
pub enum MigrationError {
    #[error("Failed to load jobs: {0}")]
    LoadError(String),

    #[error("Failed to save jobs: {0}")]
    SaveError(String),

    #[error("Manifest error: {0}")]
    ManifestError(String),
}

impl From<MigrationError> for String {
    fn from(error: MigrationError) -> Self {
        error.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_legacy_snapshot_conversion() {
        let legacy = LegacySnapshot {
            timestamp: 1704067200000, // Jan 1, 2024 12:00:00 UTC
            path: Some("/backup/2024-01-01-120000".to_string()),
            size_bytes: Some(1024 * 1024),
            file_count: Some(100),
            changes_count: Some(10),
        };

        let manifest = legacy.to_manifest_snapshot();
        assert_eq!(manifest.timestamp, 1704067200000);
        assert_eq!(manifest.file_count, 100);
        assert_eq!(manifest.total_size, 1024 * 1024);
        assert_eq!(manifest.status, ManifestSnapshotStatus::Complete);
    }

    #[test]
    fn test_needs_migration_empty() {
        let temp = tempdir().unwrap();
        let store = Store::new(temp.path());

        assert!(!needs_migration(&store));
    }
}
