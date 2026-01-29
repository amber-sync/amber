//! Integration tests for SnapshotService
//!
//! Tests real snapshot operations with temp directories.
//! These tests verify the priority logic: index -> manifest -> filesystem fallback.

use crate::common::test_common::{generate, TestBackupEnv};
use app_lib::services::index_service::IndexService;
use app_lib::services::manifest_service::{get_index_path, get_manifest_path, get_meta_dir};
use app_lib::services::snapshot_service::SnapshotService;
use app_lib::types::manifest::{BackupManifest, ManifestSnapshot, ManifestSnapshotStatus};
use std::fs;

/// Helper function to create a test SnapshotService
fn create_test_snapshot_service(app_data_dir: &std::path::Path) -> SnapshotService {
    SnapshotService::new(app_data_dir)
}

/// Helper function to create IndexService for destination
fn create_dest_index(dest_path: &str) -> IndexService {
    IndexService::for_destination(dest_path).expect("Failed to create IndexService for destination")
}

/// Helper to write a manifest directly (bypasses service for test setup)
fn write_test_manifest(dest_path: &str, manifest: &BackupManifest) {
    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();
    let manifest_path = get_manifest_path(dest_path);
    let json = serde_json::to_string_pretty(manifest).unwrap();
    fs::write(manifest_path, json).unwrap();
}

// ============================================================================
// Basic List Snapshots Tests
// ============================================================================

#[tokio::test]
async fn test_list_snapshots_empty_destination() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());

    // Empty destination directory
    let snapshots = service
        .list_snapshots("test-job", env.dest_path.to_str().unwrap())
        .await
        .unwrap();

    assert!(
        snapshots.is_empty(),
        "Empty destination should return empty list"
    );
}

#[tokio::test]
async fn test_list_snapshots_nonexistent_destination() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());

    // Non-existent path should return empty list, not error
    let snapshots = service
        .list_snapshots("test-job", "/nonexistent/path/that/does/not/exist")
        .await
        .unwrap();

    assert!(
        snapshots.is_empty(),
        "Non-existent destination should return empty list, not error"
    );
}

#[tokio::test]
async fn test_list_snapshots_dest_is_file() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());

    // Create a file instead of directory
    let file_path = env.temp_dir.path().join("not-a-directory");
    fs::write(&file_path, "I am a file, not a directory").unwrap();

    // Passing a file path should return empty list, not crash
    let snapshots = service
        .list_snapshots("test-job", file_path.to_str().unwrap())
        .await
        .unwrap();

    assert!(
        snapshots.is_empty(),
        "File path (not dir) should return empty list"
    );
}

// ============================================================================
// Manifest-Based Loading Tests
// ============================================================================

#[tokio::test]
async fn test_list_snapshots_from_manifest() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest with snapshots
    let mut manifest = BackupManifest::new(
        "job-123".to_string(),
        "Test Job".to_string(),
        "/source".to_string(),
        "test-machine".to_string(),
    );

    manifest.add_snapshot(ManifestSnapshot::from_timestamp(
        1704110400000, // 2024-01-01 12:00:00 UTC
        "2024-01-01-120000".to_string(),
        100,
        1024 * 1024,
        ManifestSnapshotStatus::Complete,
    ));

    manifest.add_snapshot(ManifestSnapshot::from_timestamp(
        1704196800000, // 2024-01-02 12:00:00 UTC
        "2024-01-02-120000".to_string(),
        200,
        2 * 1024 * 1024,
        ManifestSnapshotStatus::Complete,
    ));

    write_test_manifest(dest_path, &manifest);

    // List snapshots - should use manifest
    let snapshots = service.list_snapshots("job-123", dest_path).await.unwrap();

    assert_eq!(snapshots.len(), 2, "Should find 2 snapshots from manifest");

    // Verify stats are loaded from manifest (not zeros)
    // Snapshots are sorted newest first
    assert_eq!(snapshots[0].timestamp, 1704196800000);
    assert_eq!(snapshots[0].file_count, 200);
    assert_eq!(snapshots[0].size_bytes, 2 * 1024 * 1024);

    assert_eq!(snapshots[1].timestamp, 1704110400000);
    assert_eq!(snapshots[1].file_count, 100);
    assert_eq!(snapshots[1].size_bytes, 1024 * 1024);
}

#[tokio::test]
async fn test_list_snapshots_from_index_priority() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create a snapshot directory with files
    let snapshot_path = env.snapshot_path("2024-01-01-120000");
    fs::create_dir_all(&snapshot_path).unwrap();
    generate::file(&snapshot_path.join("test.txt"), b"Hello from index test").unwrap();

    // Index the snapshot using destination index
    let index = create_dest_index(dest_path);
    let indexed = index
        .index_snapshot("job-123", 1704110400000, snapshot_path.to_str().unwrap())
        .unwrap();

    // Also create a manifest with DIFFERENT values (to verify index takes priority)
    let mut manifest = BackupManifest::new(
        "job-123".to_string(),
        "Test Job".to_string(),
        "/source".to_string(),
        "test-machine".to_string(),
    );
    manifest.add_snapshot(ManifestSnapshot::from_timestamp(
        1704110400000,
        "2024-01-01-120000".to_string(),
        999, // Different file count than index
        999, // Different size than index
        ManifestSnapshotStatus::Complete,
    ));
    write_test_manifest(dest_path, &manifest);

    // List snapshots - should prioritize INDEX over manifest
    let snapshots = service.list_snapshots("job-123", dest_path).await.unwrap();

    assert_eq!(snapshots.len(), 1, "Should find 1 snapshot");

    // Verify stats come from INDEX (not manifest)
    assert_eq!(snapshots[0].timestamp, 1704110400000);
    assert_eq!(
        snapshots[0].file_count, indexed.file_count as u64,
        "File count should come from index, not manifest"
    );
    assert_eq!(
        snapshots[0].size_bytes, indexed.total_size as u64,
        "Size should come from index, not manifest"
    );
}

#[tokio::test]
async fn test_list_snapshots_filesystem_fallback() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create snapshot directories matching the expected pattern (no manifest, no index)
    fs::create_dir_all(env.snapshot_path("2024-01-01-120000")).unwrap();
    fs::create_dir_all(env.snapshot_path("2024-01-02-090000")).unwrap();

    // List snapshots - should fall back to filesystem scan
    let snapshots = service.list_snapshots("job-123", dest_path).await.unwrap();

    assert_eq!(
        snapshots.len(),
        2,
        "Should find 2 snapshots via filesystem fallback"
    );

    // Without manifest or index, stats should be (0, 0)
    assert_eq!(
        snapshots[0].file_count, 0,
        "Filesystem fallback without cache should have 0 file count"
    );
    assert_eq!(
        snapshots[0].size_bytes, 0,
        "Filesystem fallback without cache should have 0 size"
    );
}

// ============================================================================
// Chronological Order Tests
// ============================================================================

#[tokio::test]
async fn test_list_snapshots_chronological_order() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest with snapshots in random order
    let mut manifest = BackupManifest::new(
        "job-order".to_string(),
        "Order Test".to_string(),
        "/source".to_string(),
        "test-machine".to_string(),
    );

    // Add in non-chronological order
    manifest.add_snapshot(ManifestSnapshot::from_timestamp(
        1704196800000, // Jan 2
        "2024-01-02-120000".to_string(),
        200,
        2000,
        ManifestSnapshotStatus::Complete,
    ));
    manifest.add_snapshot(ManifestSnapshot::from_timestamp(
        1704110400000, // Jan 1
        "2024-01-01-120000".to_string(),
        100,
        1000,
        ManifestSnapshotStatus::Complete,
    ));
    manifest.add_snapshot(ManifestSnapshot::from_timestamp(
        1704283200000, // Jan 3
        "2024-01-03-120000".to_string(),
        300,
        3000,
        ManifestSnapshotStatus::Complete,
    ));

    write_test_manifest(dest_path, &manifest);

    // List snapshots
    let snapshots = service
        .list_snapshots("job-order", dest_path)
        .await
        .unwrap();

    assert_eq!(snapshots.len(), 3);

    // Should be sorted newest first (descending timestamp)
    assert!(
        snapshots[0].timestamp > snapshots[1].timestamp,
        "First snapshot should be newest"
    );
    assert!(
        snapshots[1].timestamp > snapshots[2].timestamp,
        "Snapshots should be sorted by timestamp descending"
    );

    // Verify exact order
    assert_eq!(snapshots[0].timestamp, 1704283200000); // Jan 3 (newest)
    assert_eq!(snapshots[1].timestamp, 1704196800000); // Jan 2
    assert_eq!(snapshots[2].timestamp, 1704110400000); // Jan 1 (oldest)
}

#[tokio::test]
async fn test_list_snapshots_filesystem_chronological_order() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create snapshot directories (filesystem fallback path)
    fs::create_dir_all(env.snapshot_path("2024-06-15-090000")).unwrap(); // Middle
    fs::create_dir_all(env.snapshot_path("2024-01-01-120000")).unwrap(); // Oldest
    fs::create_dir_all(env.snapshot_path("2024-12-25-180000")).unwrap(); // Newest

    let snapshots = service.list_snapshots("job-fs", dest_path).await.unwrap();

    assert_eq!(snapshots.len(), 3);

    // Should be sorted newest first
    assert!(
        snapshots[0].timestamp > snapshots[1].timestamp,
        "First should be newest"
    );
    assert!(
        snapshots[1].timestamp > snapshots[2].timestamp,
        "Second should be middle"
    );
}

// ============================================================================
// Filter and Edge Case Tests
// ============================================================================

#[tokio::test]
async fn test_list_ignores_amber_meta() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create .amber-meta directory (should NOT be listed as snapshot)
    let meta_dir = env.dest_path.join(".amber-meta");
    fs::create_dir_all(&meta_dir).unwrap();
    fs::write(meta_dir.join("manifest.json"), "{}").unwrap();

    // Create a valid snapshot directory
    fs::create_dir_all(env.snapshot_path("2024-01-01-120000")).unwrap();

    // Create other non-snapshot directories
    fs::create_dir_all(env.dest_path.join("latest")).unwrap();
    fs::create_dir_all(env.dest_path.join("not-a-snapshot")).unwrap();
    fs::create_dir_all(env.dest_path.join("random-folder")).unwrap();

    let snapshots = service
        .list_snapshots("job-filter", dest_path)
        .await
        .unwrap();

    // Should only find the valid snapshot, not .amber-meta or other dirs
    assert_eq!(
        snapshots.len(),
        1,
        "Should only find 1 valid snapshot, ignoring .amber-meta and other dirs"
    );
    assert!(
        snapshots[0].path.contains("2024-01-01-120000"),
        "Should find the valid snapshot directory"
    );
}

#[tokio::test]
async fn test_list_snapshots_filters_invalid_patterns() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create various directories, some valid, some not
    // Valid patterns: YYYY-MM-DD-HHMMSS
    fs::create_dir_all(env.snapshot_path("2024-03-15-140000")).unwrap(); // Valid
    fs::create_dir_all(env.snapshot_path("2024-03-16-080000")).unwrap(); // Valid

    // Invalid patterns (should be ignored)
    fs::create_dir_all(env.dest_path.join("not-a-snapshot")).unwrap();
    fs::create_dir_all(env.dest_path.join("latest")).unwrap();
    fs::create_dir_all(env.dest_path.join("2024-03-15")).unwrap(); // Missing time
    fs::create_dir_all(env.dest_path.join("2024-3-15-140000")).unwrap(); // Single digit month
    fs::create_dir_all(env.dest_path.join("backup")).unwrap();

    // Create a file (not dir) that matches pattern
    fs::write(env.dest_path.join("2024-03-17-100000"), "I am a file").unwrap();

    let snapshots = service
        .list_snapshots("job-filter", dest_path)
        .await
        .unwrap();

    assert_eq!(
        snapshots.len(),
        2,
        "Should only find 2 valid snapshot directories"
    );
}

// ============================================================================
// Manifest Field Tests
// ============================================================================

#[tokio::test]
async fn test_list_snapshots_populates_all_fields() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest with all fields populated
    let mut manifest = BackupManifest::new(
        "job-fields".to_string(),
        "Fields Test".to_string(),
        "/source".to_string(),
        "test-machine".to_string(),
    );

    let mut snapshot = ManifestSnapshot::from_timestamp(
        1705320000000, // 2024-01-15 12:00:00 UTC
        "2024-01-15-120000".to_string(),
        500,
        1048576,
        ManifestSnapshotStatus::Complete,
    );
    snapshot.duration_ms = Some(5000);
    snapshot.changes_count = Some(42);

    manifest.add_snapshot(snapshot);
    write_test_manifest(dest_path, &manifest);

    let snapshots = service
        .list_snapshots("job-fields", dest_path)
        .await
        .unwrap();

    assert_eq!(snapshots.len(), 1);

    let snap = &snapshots[0];
    assert_eq!(snap.timestamp, 1705320000000);
    assert_eq!(snap.file_count, 500);
    assert_eq!(snap.size_bytes, 1048576);
    assert_eq!(snap.status, "Complete");
    assert_eq!(snap.duration, Some(5000));
    assert_eq!(snap.changes_count, Some(42));

    // Path should be constructed correctly
    let expected_path = env
        .dest_path
        .join("2024-01-15-120000")
        .to_string_lossy()
        .to_string();
    assert_eq!(snap.path, expected_path);

    // Date should be RFC3339 format
    assert!(
        snap.date.contains("2024-01-15"),
        "Date should contain 2024-01-15, got: {}",
        snap.date
    );
}

#[tokio::test]
async fn test_list_snapshots_different_statuses() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest with different snapshot statuses
    let mut manifest = BackupManifest::new(
        "job-status".to_string(),
        "Status Test".to_string(),
        "/source".to_string(),
        "test-machine".to_string(),
    );

    manifest.add_snapshot(ManifestSnapshot::from_timestamp(
        1704110400000,
        "2024-01-01-120000".to_string(),
        100,
        1024,
        ManifestSnapshotStatus::Complete,
    ));

    manifest.add_snapshot(ManifestSnapshot::from_timestamp(
        1704196800000,
        "2024-01-02-120000".to_string(),
        50,
        512,
        ManifestSnapshotStatus::Partial,
    ));

    manifest.add_snapshot(ManifestSnapshot::from_timestamp(
        1704283200000,
        "2024-01-03-120000".to_string(),
        0,
        0,
        ManifestSnapshotStatus::Failed,
    ));

    write_test_manifest(dest_path, &manifest);

    let snapshots = service
        .list_snapshots("job-status", dest_path)
        .await
        .unwrap();

    assert_eq!(snapshots.len(), 3);

    // Newest first
    assert_eq!(snapshots[0].status, "Failed");
    assert_eq!(snapshots[1].status, "Partial");
    assert_eq!(snapshots[2].status, "Complete");
}

// ============================================================================
// Malformed Manifest Tests
// ============================================================================

#[tokio::test]
async fn test_list_snapshots_malformed_manifest_fallback() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create malformed manifest
    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();
    fs::write(get_manifest_path(dest_path), "{ invalid json }").unwrap();

    // Create valid snapshot directory for filesystem fallback
    fs::create_dir_all(env.snapshot_path("2024-01-15-120000")).unwrap();

    // Should gracefully fall back to filesystem scan
    let snapshots = service.list_snapshots("job-123", dest_path).await.unwrap();

    assert_eq!(
        snapshots.len(),
        1,
        "Should fall back to filesystem scan on malformed manifest"
    );
}

#[tokio::test]
async fn test_list_snapshots_empty_manifest_snapshots() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest with no snapshots
    let manifest = BackupManifest::new(
        "job-empty".to_string(),
        "Empty Test".to_string(),
        "/source".to_string(),
        "test-machine".to_string(),
    );
    write_test_manifest(dest_path, &manifest);

    // Create a snapshot directory that exists on filesystem
    fs::create_dir_all(env.snapshot_path("2024-01-01-120000")).unwrap();

    let snapshots = service
        .list_snapshots("job-empty", dest_path)
        .await
        .unwrap();

    // Empty manifest returns empty list from manifest path (doesn't fall through to filesystem)
    // The service returns what the manifest says
    assert!(
        snapshots.is_empty(),
        "Empty manifest should return empty list from manifest"
    );
}

// ============================================================================
// Index Database Edge Cases
// ============================================================================

#[tokio::test]
async fn test_list_snapshots_index_empty_for_job() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create an index with a snapshot for a DIFFERENT job
    let snapshot_path = env.snapshot_path("2024-01-01-120000");
    fs::create_dir_all(&snapshot_path).unwrap();
    generate::file(&snapshot_path.join("test.txt"), b"Test content").unwrap();

    let index = create_dest_index(dest_path);
    index
        .index_snapshot(
            "other-job-id", // Different job
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Also create a manifest for our job
    let mut manifest = BackupManifest::new(
        "job-123".to_string(),
        "Test Job".to_string(),
        "/source".to_string(),
        "test-machine".to_string(),
    );
    manifest.add_snapshot(ManifestSnapshot::from_timestamp(
        1704196800000,
        "2024-01-02-120000".to_string(),
        100,
        1024,
        ManifestSnapshotStatus::Complete,
    ));
    write_test_manifest(dest_path, &manifest);

    // Query for "job-123" - index has nothing for this job, should fall back to manifest
    let snapshots = service.list_snapshots("job-123", dest_path).await.unwrap();

    assert_eq!(snapshots.len(), 1, "Should fall back to manifest");
    assert_eq!(snapshots[0].timestamp, 1704196800000);
    assert_eq!(
        snapshots[0].file_count, 100,
        "Should get manifest values, not index"
    );
}

#[tokio::test]
async fn test_list_snapshots_index_exists_but_empty_db() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_snapshot_service(env.temp_dir.path());
    let dest_path = env.dest_path.to_str().unwrap();

    // Create index database file (will be empty, just schema)
    let _index = create_dest_index(dest_path);

    // Verify index file exists
    assert!(
        get_index_path(dest_path).exists(),
        "Index file should exist"
    );

    // Create filesystem snapshots for fallback
    fs::create_dir_all(env.snapshot_path("2024-01-01-120000")).unwrap();

    // Query - empty index should trigger filesystem fallback
    let snapshots = service.list_snapshots("job-123", dest_path).await.unwrap();

    assert_eq!(
        snapshots.len(),
        1,
        "Empty index should fall back to filesystem"
    );
}
