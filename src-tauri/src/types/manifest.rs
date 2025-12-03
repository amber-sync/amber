use serde::{Deserialize, Serialize};

/// Manifest version for future migrations
pub const MANIFEST_VERSION: u32 = 1;

/// Status of a snapshot in the manifest
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ManifestSnapshotStatus {
    Complete,
    Partial,
    Failed,
}

/// Snapshot entry in the manifest - lightweight metadata only
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestSnapshot {
    /// Unique identifier (timestamp-based)
    pub id: String,
    /// Unix timestamp in milliseconds
    pub timestamp: i64,
    /// Folder name on disk (e.g., "2024-01-01-120000")
    pub folder_name: String,
    /// Number of files in this snapshot
    pub file_count: u64,
    /// Total size in bytes
    pub total_size: u64,
    /// Snapshot status
    pub status: ManifestSnapshotStatus,
    /// Duration of backup in milliseconds (if completed)
    pub duration_ms: Option<u64>,
}

/// The manifest file that lives on the backup destination drive
/// Located at: {dest_path}/.amber-meta/manifest.json
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    /// Schema version for migrations
    pub version: u32,
    /// Unique machine identifier (hostname + hardware UUID)
    pub machine_id: String,
    /// Human-readable machine name
    pub machine_name: Option<String>,
    /// Job ID this manifest belongs to
    pub job_id: String,
    /// Job name for display purposes
    pub job_name: String,
    /// Source path that was backed up
    pub source_path: String,
    /// When this manifest was first created (unix ms)
    pub created_at: i64,
    /// When this manifest was last updated (unix ms)
    pub updated_at: i64,
    /// All snapshots in this backup repository
    pub snapshots: Vec<ManifestSnapshot>,
}

impl BackupManifest {
    /// Create a new manifest for a job
    pub fn new(job_id: String, job_name: String, source_path: String, machine_id: String) -> Self {
        let now = chrono::Utc::now().timestamp_millis();
        Self {
            version: MANIFEST_VERSION,
            machine_id,
            machine_name: Self::get_machine_name(),
            job_id,
            job_name,
            source_path,
            created_at: now,
            updated_at: now,
            snapshots: Vec::new(),
        }
    }

    /// Get the machine's hostname
    fn get_machine_name() -> Option<String> {
        hostname::get().ok().and_then(|h| h.into_string().ok())
    }

    /// Add a snapshot to the manifest
    pub fn add_snapshot(&mut self, snapshot: ManifestSnapshot) {
        self.snapshots.push(snapshot);
        self.updated_at = chrono::Utc::now().timestamp_millis();
    }

    /// Get snapshot by ID
    pub fn get_snapshot(&self, id: &str) -> Option<&ManifestSnapshot> {
        self.snapshots.iter().find(|s| s.id == id)
    }

    /// Get the most recent snapshot
    pub fn latest_snapshot(&self) -> Option<&ManifestSnapshot> {
        self.snapshots.iter().max_by_key(|s| s.timestamp)
    }

    /// Remove a snapshot by ID
    pub fn remove_snapshot(&mut self, id: &str) -> Option<ManifestSnapshot> {
        if let Some(pos) = self.snapshots.iter().position(|s| s.id == id) {
            self.updated_at = chrono::Utc::now().timestamp_millis();
            Some(self.snapshots.remove(pos))
        } else {
            None
        }
    }

    /// Get total backup size (sum of all snapshots)
    /// Note: This overcounts due to hard links - actual disk usage is less
    pub fn total_logical_size(&self) -> u64 {
        self.snapshots.iter().map(|s| s.total_size).sum()
    }

    /// Get total file count across all snapshots
    pub fn total_file_count(&self) -> u64 {
        self.snapshots.iter().map(|s| s.file_count).sum()
    }
}

impl ManifestSnapshot {
    /// Create a new snapshot entry
    pub fn new(
        folder_name: String,
        file_count: u64,
        total_size: u64,
        status: ManifestSnapshotStatus,
        duration_ms: Option<u64>,
    ) -> Self {
        let timestamp = chrono::Utc::now().timestamp_millis();
        Self {
            id: timestamp.to_string(),
            timestamp,
            folder_name,
            file_count,
            total_size,
            status,
            duration_ms,
        }
    }

    /// Create from existing timestamp (for migration)
    pub fn from_timestamp(
        timestamp: i64,
        folder_name: String,
        file_count: u64,
        total_size: u64,
        status: ManifestSnapshotStatus,
    ) -> Self {
        Self {
            id: timestamp.to_string(),
            timestamp,
            folder_name,
            file_count,
            total_size,
            status,
            duration_ms: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manifest_creation() {
        let manifest = BackupManifest::new(
            "job-123".to_string(),
            "Documents".to_string(),
            "/Users/me/Documents".to_string(),
            "MacBook-abc123".to_string(),
        );

        assert_eq!(manifest.version, MANIFEST_VERSION);
        assert_eq!(manifest.job_id, "job-123");
        assert!(manifest.snapshots.is_empty());
    }

    #[test]
    fn test_add_snapshot() {
        let mut manifest = BackupManifest::new(
            "job-123".to_string(),
            "Documents".to_string(),
            "/Users/me/Documents".to_string(),
            "MacBook-abc123".to_string(),
        );

        let snapshot = ManifestSnapshot::new(
            "2024-01-01-120000".to_string(),
            1000,
            1024 * 1024 * 100, // 100 MB
            ManifestSnapshotStatus::Complete,
            Some(5000),
        );

        manifest.add_snapshot(snapshot);

        assert_eq!(manifest.snapshots.len(), 1);
        assert_eq!(manifest.total_file_count(), 1000);
    }

    #[test]
    fn test_latest_snapshot() {
        let mut manifest = BackupManifest::new(
            "job-123".to_string(),
            "Documents".to_string(),
            "/Users/me/Documents".to_string(),
            "MacBook-abc123".to_string(),
        );

        let older = ManifestSnapshot::from_timestamp(
            1704067200000, // Jan 1, 2024
            "2024-01-01-120000".to_string(),
            100,
            1024,
            ManifestSnapshotStatus::Complete,
        );

        let newer = ManifestSnapshot::from_timestamp(
            1704153600000, // Jan 2, 2024
            "2024-01-02-120000".to_string(),
            150,
            2048,
            ManifestSnapshotStatus::Complete,
        );

        manifest.add_snapshot(older);
        manifest.add_snapshot(newer);

        let latest = manifest.latest_snapshot().unwrap();
        assert_eq!(latest.folder_name, "2024-01-02-120000");
    }
}
