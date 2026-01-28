use crate::types::manifest::{BackupManifest, ManifestSnapshot};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Directory name for Amber metadata on backup drive
pub const AMBER_META_DIR: &str = ".amber-meta";
/// Manifest filename
pub const MANIFEST_FILENAME: &str = "manifest.json";
/// Index database filename (TIM-112)
pub const INDEX_FILENAME: &str = "index.db";

/// Get the path to the .amber-meta directory for a destination
pub fn get_meta_dir(dest_path: &str) -> PathBuf {
    Path::new(dest_path).join(AMBER_META_DIR)
}

/// Get the full path to the manifest file
pub fn get_manifest_path(dest_path: &str) -> PathBuf {
    get_meta_dir(dest_path).join(MANIFEST_FILENAME)
}

/// Get the full path to the index database on the destination
pub fn get_index_path(dest_path: &str) -> PathBuf {
    get_meta_dir(dest_path).join(INDEX_FILENAME)
}

/// Check if a manifest exists at the destination
pub async fn manifest_exists(dest_path: &str) -> bool {
    get_manifest_path(dest_path).exists()
}

/// Read manifest from the backup destination
/// Returns None if manifest doesn't exist
pub async fn read_manifest(dest_path: &str) -> Result<Option<BackupManifest>, ManifestError> {
    let manifest_path = get_manifest_path(dest_path);

    if !manifest_path.exists() {
        return Ok(None);
    }

    let mut file = fs::File::open(&manifest_path).await.map_err(|e| {
        ManifestError::IoError(format!(
            "Failed to open manifest at {:?}: {}",
            manifest_path, e
        ))
    })?;

    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .await
        .map_err(|e| ManifestError::IoError(format!("Failed to read manifest: {}", e)))?;

    let manifest: BackupManifest = serde_json::from_str(&contents)
        .map_err(|e| ManifestError::ParseError(format!("Failed to parse manifest: {}", e)))?;

    // Check version compatibility
    if manifest.version > crate::types::manifest::MANIFEST_VERSION {
        return Err(ManifestError::VersionMismatch {
            found: manifest.version,
            expected: crate::types::manifest::MANIFEST_VERSION,
        });
    }

    Ok(Some(manifest))
}

/// Write manifest to the backup destination
/// Creates the .amber-meta directory if it doesn't exist
pub async fn write_manifest(
    dest_path: &str,
    manifest: &BackupManifest,
) -> Result<(), ManifestError> {
    let meta_dir = get_meta_dir(dest_path);
    let manifest_path = get_manifest_path(dest_path);
    let dest_root = Path::new(dest_path);

    if !dest_root.exists() || !dest_root.is_dir() {
        return Err(ManifestError::InvalidDestination(dest_path.to_string()));
    }

    // Create .amber-meta directory if needed
    if !meta_dir.exists() {
        fs::create_dir_all(&meta_dir).await.map_err(|e| {
            ManifestError::IoError(format!(
                "Failed to create meta directory {:?}: {}",
                meta_dir, e
            ))
        })?;
    }

    // Serialize with pretty printing for human readability
    let contents = serde_json::to_string_pretty(manifest).map_err(|e| {
        ManifestError::SerializeError(format!("Failed to serialize manifest: {}", e))
    })?;

    // Write atomically by writing to temp file first, then renaming
    let temp_path = manifest_path.with_extension("json.tmp");

    let mut file = fs::File::create(&temp_path).await.map_err(|e| {
        ManifestError::IoError(format!("Failed to create temp manifest file: {}", e))
    })?;

    file.write_all(contents.as_bytes())
        .await
        .map_err(|e| ManifestError::IoError(format!("Failed to write manifest: {}", e)))?;

    file.sync_all()
        .await
        .map_err(|e| ManifestError::IoError(format!("Failed to sync manifest: {}", e)))?;

    // Rename temp file to final location (atomic on most filesystems)
    fs::rename(&temp_path, &manifest_path)
        .await
        .map_err(|e| ManifestError::IoError(format!("Failed to rename manifest: {}", e)))?;

    Ok(())
}

/// Create a new manifest for a job, or return existing one
pub async fn get_or_create_manifest(
    dest_path: &str,
    job_id: &str,
    job_name: &str,
    source_path: &str,
) -> Result<BackupManifest, ManifestError> {
    match read_manifest(dest_path).await? {
        Some(manifest) => {
            // Verify this manifest belongs to the same job
            if manifest.job_id != job_id {
                return Err(ManifestError::JobMismatch {
                    expected: job_id.to_string(),
                    found: manifest.job_id,
                });
            }
            Ok(manifest)
        }
        None => {
            let machine_id = crate::utils::get_machine_id();
            let manifest = BackupManifest::new(
                job_id.to_string(),
                job_name.to_string(),
                source_path.to_string(),
                machine_id,
            );
            write_manifest(dest_path, &manifest).await?;
            Ok(manifest)
        }
    }
}

/// Add a snapshot to the manifest and save
pub async fn add_snapshot_to_manifest(
    dest_path: &str,
    snapshot: ManifestSnapshot,
) -> Result<BackupManifest, ManifestError> {
    let mut manifest = read_manifest(dest_path)
        .await?
        .ok_or_else(|| ManifestError::NotFound(dest_path.to_string()))?;

    manifest.add_snapshot(snapshot);
    write_manifest(dest_path, &manifest).await?;

    Ok(manifest)
}

/// Remove a snapshot from the manifest and save
pub async fn remove_snapshot_from_manifest(
    dest_path: &str,
    snapshot_id: &str,
) -> Result<Option<ManifestSnapshot>, ManifestError> {
    let mut manifest = read_manifest(dest_path)
        .await?
        .ok_or_else(|| ManifestError::NotFound(dest_path.to_string()))?;

    let removed = manifest.remove_snapshot(snapshot_id);
    if removed.is_some() {
        write_manifest(dest_path, &manifest).await?;
    }

    Ok(removed)
}

/// Errors that can occur when working with manifests
#[derive(Debug, thiserror::Error)]
pub enum ManifestError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Failed to parse manifest: {0}")]
    ParseError(String),

    #[error("Failed to serialize manifest: {0}")]
    SerializeError(String),

    #[error("Manifest version mismatch: found v{found}, expected v{expected}")]
    VersionMismatch { found: u32, expected: u32 },

    #[error("Manifest not found at: {0}")]
    NotFound(String),

    #[error("Job mismatch: expected {expected}, found {found}")]
    JobMismatch { expected: String, found: String },

    #[error("Destination path is not accessible: {0}")]
    InvalidDestination(String),
}

impl From<ManifestError> for String {
    fn from(error: ManifestError) -> Self {
        error.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::manifest::ManifestSnapshotStatus;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_write_and_read_manifest() {
        let temp = tempdir().unwrap();
        let dest_path = temp.path().to_str().unwrap();

        let manifest = BackupManifest::new(
            "job-123".to_string(),
            "Test Job".to_string(),
            "/source/path".to_string(),
            "test-machine".to_string(),
        );

        // Write
        write_manifest(dest_path, &manifest).await.unwrap();

        // Verify file exists
        assert!(get_manifest_path(dest_path).exists());

        // Read back
        let read_manifest = read_manifest(dest_path).await.unwrap().unwrap();
        assert_eq!(read_manifest.job_id, "job-123");
        assert_eq!(read_manifest.job_name, "Test Job");
    }

    #[tokio::test]
    async fn test_add_snapshot() {
        let temp = tempdir().unwrap();
        let dest_path = temp.path().to_str().unwrap();

        // Create initial manifest
        let manifest = BackupManifest::new(
            "job-123".to_string(),
            "Test Job".to_string(),
            "/source/path".to_string(),
            "test-machine".to_string(),
        );
        write_manifest(dest_path, &manifest).await.unwrap();

        // Add snapshot
        let snapshot = ManifestSnapshot::new(
            "2024-01-01-120000".to_string(),
            500,
            1024 * 1024,
            ManifestSnapshotStatus::Complete,
            Some(3000),
        );

        let updated = add_snapshot_to_manifest(dest_path, snapshot).await.unwrap();
        assert_eq!(updated.snapshots.len(), 1);

        // Verify persisted
        let reread = read_manifest(dest_path).await.unwrap().unwrap();
        assert_eq!(reread.snapshots.len(), 1);
        assert_eq!(reread.snapshots[0].file_count, 500);
    }

    #[tokio::test]
    async fn test_manifest_not_found() {
        let temp = tempdir().unwrap();
        let dest_path = temp.path().to_str().unwrap();

        let result = read_manifest(dest_path).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_or_create_manifest() {
        let temp = tempdir().unwrap();
        let dest_path = temp.path().to_str().unwrap();

        // First call creates
        let manifest = get_or_create_manifest(dest_path, "job-456", "My Backup", "/Users/me/docs")
            .await
            .unwrap();

        assert_eq!(manifest.job_id, "job-456");

        // Second call returns existing
        let manifest2 = get_or_create_manifest(dest_path, "job-456", "My Backup", "/Users/me/docs")
            .await
            .unwrap();

        assert_eq!(manifest.created_at, manifest2.created_at);
    }
}
