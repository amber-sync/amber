//! Local cache for snapshot metadata
//!
//! Provides offline access to snapshot data when backup destinations are not mounted.
//! The cache is disposable and rebuilt automatically when the destination is reconnected.
//!
//! Uses the centralized data_dir module to ensure consistent paths in dev and prod.

use crate::services::data_dir;
use crate::types::manifest::ManifestSnapshot;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Cache directory name under the app data directory
const CACHE_DIR: &str = "cache";
/// Subdirectory for snapshot caches
const SNAPSHOTS_DIR: &str = "snapshots";

/// Cached snapshot data for a job
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotCache {
    /// Job ID this cache belongs to
    pub job_id: String,
    /// When this cache was last updated (unix ms)
    pub cached_at: i64,
    /// Cached snapshot metadata
    pub snapshots: Vec<ManifestSnapshot>,
}

impl SnapshotCache {
    /// Create a new snapshot cache
    pub fn new(job_id: String, snapshots: Vec<ManifestSnapshot>) -> Self {
        Self {
            job_id,
            cached_at: chrono::Utc::now().timestamp_millis(),
            snapshots,
        }
    }
}

/// Get the base cache directory path
///
/// Uses the centralized data_dir module to ensure consistent paths.
/// In dev mode: mock-data/cache/
/// In prod mode: ~/.local/share/amber/cache/
fn get_cache_dir() -> PathBuf {
    data_dir::get().join(CACHE_DIR)
}

/// Get the snapshots cache directory path
fn get_snapshots_cache_dir() -> PathBuf {
    get_cache_dir().join(SNAPSHOTS_DIR)
}

/// Get the cache file path for a specific job
fn get_job_cache_path(job_id: &str) -> Result<PathBuf, CacheError> {
    let file_name = cache_file_name(job_id)?;
    Ok(get_snapshots_cache_dir().join(file_name))
}

fn legacy_cache_path(job_id: &str) -> Option<PathBuf> {
    let trimmed = job_id.trim();
    if trimmed.is_empty() || trimmed.contains('\0') {
        return None;
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return None;
    }
    Some(get_snapshots_cache_dir().join(format!("{}.json", trimmed)))
}

/// Write snapshot cache for a job
pub async fn write_snapshot_cache(
    job_id: &str,
    snapshots: Vec<ManifestSnapshot>,
) -> Result<(), CacheError> {
    let cache_dir = get_snapshots_cache_dir();

    log::debug!(
        "write_snapshot_cache: job_id={}, cache_dir={:?}, exists={}",
        job_id,
        cache_dir,
        cache_dir.exists()
    );

    // Always try to create cache directory (create_dir_all is idempotent)
    fs::create_dir_all(&cache_dir)
        .await
        .map_err(|e| CacheError::IoError(format!("Failed to create cache directory: {}", e)))?;

    let cache = SnapshotCache::new(job_id.to_string(), snapshots);
    let cache_path = get_job_cache_path(job_id)?;

    // Serialize cache
    let contents = serde_json::to_string_pretty(&cache)
        .map_err(|e| CacheError::SerializeError(format!("Failed to serialize cache: {}", e)))?;

    // Write atomically using a unique temp file name to avoid race conditions
    // when multiple concurrent writes happen for the same job
    let unique_id = std::process::id();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let file_name = cache_file_name(job_id)?;
    let temp_path = cache_dir.join(format!("{}.{}.{}.tmp", file_name, unique_id, timestamp));
    log::debug!(
        "write_snapshot_cache: creating temp file at {:?}",
        temp_path
    );
    let mut file = fs::File::create(&temp_path).await.map_err(|e| {
        CacheError::IoError(format!(
            "Failed to create temp cache file at {:?}: {}",
            temp_path, e
        ))
    })?;

    file.write_all(contents.as_bytes())
        .await
        .map_err(|e| CacheError::IoError(format!("Failed to write cache: {}", e)))?;

    file.sync_all()
        .await
        .map_err(|e| CacheError::IoError(format!("Failed to sync cache: {}", e)))?;

    log::debug!(
        "write_snapshot_cache: renaming {:?} to {:?}",
        temp_path,
        cache_path
    );
    fs::rename(&temp_path, &cache_path).await.map_err(|e| {
        CacheError::IoError(format!(
            "Failed to rename cache file from {:?} to {:?}: {}",
            temp_path, cache_path, e
        ))
    })?;

    if let Some(legacy_path) = legacy_cache_path(job_id) {
        if legacy_path.exists() && legacy_path != cache_path {
            let _ = fs::remove_file(&legacy_path).await;
        }
    }

    Ok(())
}

/// Read snapshot cache for a job
/// Returns None if no cache exists
pub async fn read_snapshot_cache(job_id: &str) -> Result<Option<SnapshotCache>, CacheError> {
    let cache_path = get_job_cache_path(job_id)?;

    if cache_path.exists() {
        let mut file = fs::File::open(&cache_path)
            .await
            .map_err(|e| CacheError::IoError(format!("Failed to open cache file: {}", e)))?;

        let mut contents = String::new();
        file.read_to_string(&mut contents)
            .await
            .map_err(|e| CacheError::IoError(format!("Failed to read cache: {}", e)))?;

        let cache: SnapshotCache = serde_json::from_str(&contents)
            .map_err(|e| CacheError::ParseError(format!("Failed to parse cache: {}", e)))?;

        return Ok(Some(cache));
    }

    if let Some(legacy_path) = legacy_cache_path(job_id) {
        if legacy_path.exists() {
            let mut file = fs::File::open(&legacy_path)
                .await
                .map_err(|e| CacheError::IoError(format!("Failed to open cache file: {}", e)))?;

            let mut contents = String::new();
            file.read_to_string(&mut contents)
                .await
                .map_err(|e| CacheError::IoError(format!("Failed to read cache: {}", e)))?;

            let cache: SnapshotCache = serde_json::from_str(&contents)
                .map_err(|e| CacheError::ParseError(format!("Failed to parse cache: {}", e)))?;

            let _ = write_snapshot_cache(job_id, cache.snapshots.clone()).await;
            let _ = fs::remove_file(&legacy_path).await;

            return Ok(Some(cache));
        }
    }

    Ok(None)
}

/// Delete snapshot cache for a job
pub async fn delete_snapshot_cache(job_id: &str) -> Result<(), CacheError> {
    let cache_path = get_job_cache_path(job_id)?;

    if cache_path.exists() {
        fs::remove_file(&cache_path)
            .await
            .map_err(|e| CacheError::IoError(format!("Failed to delete cache: {}", e)))?;
    }

    if let Some(legacy_path) = legacy_cache_path(job_id) {
        if legacy_path.exists() {
            let _ = fs::remove_file(&legacy_path).await;
        }
    }

    Ok(())
}

/// Clear all snapshot caches
/// Note: Currently unused but kept for future "clear cache" feature
#[allow(dead_code)]
pub async fn clear_all_caches() -> Result<(), CacheError> {
    let cache_dir = get_snapshots_cache_dir();

    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir)
            .await
            .map_err(|e| CacheError::IoError(format!("Failed to clear cache directory: {}", e)))?;
    }

    Ok(())
}

/// Errors that can occur when working with the cache
#[derive(Debug, thiserror::Error)]
pub enum CacheError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Failed to serialize cache: {0}")]
    SerializeError(String),

    #[error("Failed to parse cache: {0}")]
    ParseError(String),

    #[error("Invalid job id: {0}")]
    InvalidJobId(String),
}

impl From<CacheError> for String {
    fn from(error: CacheError) -> Self {
        error.to_string()
    }
}

fn cache_file_name(job_id: &str) -> Result<String, CacheError> {
    let trimmed = job_id.trim();
    if trimmed.is_empty() {
        return Err(CacheError::InvalidJobId(
            "Job id cannot be empty".to_string(),
        ));
    }
    if trimmed.contains('\0') {
        return Err(CacheError::InvalidJobId(
            "Job id contains null byte".to_string(),
        ));
    }

    let encoded = URL_SAFE_NO_PAD.encode(trimmed.as_bytes());
    Ok(format!("{}.json", encoded))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::manifest::ManifestSnapshotStatus;

    /// Initialize data_dir for tests using a temp directory
    fn setup_test_data_dir() {
        use std::sync::Once;
        static INIT: Once = Once::new();
        INIT.call_once(|| {
            let temp_dir = std::env::temp_dir().join("amber-test-cache");
            let _ = std::fs::create_dir_all(&temp_dir);
            data_dir::init(temp_dir);
        });
    }

    #[tokio::test]
    async fn test_write_and_read_cache() {
        setup_test_data_dir();

        let job_id = "test-job-cache-001";

        let snapshots = vec![ManifestSnapshot::new(
            "2024-01-01-120000".to_string(),
            100,
            1024 * 1024,
            ManifestSnapshotStatus::Complete,
            Some(5000),
        )];

        // Write cache
        write_snapshot_cache(job_id, snapshots.clone())
            .await
            .unwrap();

        // Read cache
        let cache = read_snapshot_cache(job_id).await.unwrap().unwrap();
        assert_eq!(cache.job_id, job_id);
        assert_eq!(cache.snapshots.len(), 1);
        assert_eq!(cache.snapshots[0].file_count, 100);

        // Cleanup
        delete_snapshot_cache(job_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_cache_not_found() {
        setup_test_data_dir();

        let result = read_snapshot_cache("nonexistent-job").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_delete_cache() {
        setup_test_data_dir();

        let job_id = "test-job-delete-001";

        let snapshots = vec![];
        write_snapshot_cache(job_id, snapshots).await.unwrap();

        // Verify it exists
        assert!(read_snapshot_cache(job_id).await.unwrap().is_some());

        // Delete
        delete_snapshot_cache(job_id).await.unwrap();

        // Verify deleted
        assert!(read_snapshot_cache(job_id).await.unwrap().is_none());
    }
}
