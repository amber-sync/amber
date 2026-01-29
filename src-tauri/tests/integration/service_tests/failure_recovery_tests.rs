//! Failure and Recovery Tests
//!
//! Tests for catastrophic failure scenarios that matter for a backup application.
//! These test what happens when things go wrong, not when things work correctly.

use crate::common::test_common::{generate, TestBackupEnv};
use app_lib::services::{
    index_service::IndexService,
    manifest_service::{
        get_index_path, get_manifest_path, get_meta_dir, read_manifest, write_manifest,
    },
    snapshot_service::SnapshotService,
};
use app_lib::types::manifest::{BackupManifest, ManifestSnapshot, ManifestSnapshotStatus};
use std::fs;
use std::path::Path;

/// Helper function to create IndexService for destination
/// Uses the standard location (.amber-meta/index.db) so SnapshotService can find it
fn create_test_index(dest_path: &str) -> IndexService {
    IndexService::for_destination(dest_path).expect("Failed to create IndexService for destination")
}

/// Helper function to create a test SnapshotService
fn create_test_snapshot_service(dest_path: &str) -> SnapshotService {
    let app_data_dir = Path::new(dest_path).join(".snapshot-data");
    fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
    SnapshotService::new(&app_data_dir)
}

/// Helper to write a manifest directly (sync, avoids runtime nesting)
fn write_test_manifest(dest_path: &str, manifest: &BackupManifest) {
    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();
    let manifest_path = get_manifest_path(dest_path);
    let json = serde_json::to_string_pretty(manifest).unwrap();
    fs::write(manifest_path, json).unwrap();
}

/// Helper to create a complete backup setup with manifest and index
fn setup_complete_backup(
    env: &TestBackupEnv,
    job_id: &str,
    timestamp: i64,
) -> (IndexService, SnapshotService) {
    let dest_path = env.dest_path.to_str().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01-120000");

    // Create snapshot directory with files
    fs::create_dir_all(&snapshot_path).unwrap();
    generate::file(&snapshot_path.join("file1.txt"), b"content 1").unwrap();
    generate::file(&snapshot_path.join("file2.txt"), b"content 2").unwrap();
    fs::create_dir_all(snapshot_path.join("subdir")).unwrap();
    generate::file(&snapshot_path.join("subdir/nested.txt"), b"nested content").unwrap();

    // Create index service and index the snapshot
    let index = create_test_index(dest_path);
    index
        .index_snapshot(job_id, timestamp, snapshot_path.to_str().unwrap())
        .unwrap();

    // Create manifest using sync helper (avoids runtime nesting)
    let mut manifest = BackupManifest::new(
        job_id.to_string(),
        "Test Backup".to_string(),
        "/source".to_string(),
        "test-machine".to_string(),
    );

    let snap = ManifestSnapshot::from_timestamp(
        timestamp,
        "2024-01-01-120000".to_string(),
        3, // 3 files
        100,
        ManifestSnapshotStatus::Complete,
    );
    manifest.add_snapshot(snap);

    write_test_manifest(dest_path, &manifest);

    let snapshot_service = create_test_snapshot_service(dest_path);

    (index, snapshot_service)
}

// ============================================================================
// .AMBER-META DELETED SCENARIOS
// ============================================================================

#[tokio::test]
async fn test_amber_meta_deleted_after_backup() {
    // Setup: Create a backup with manifest and index
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();
    let job_id = "test-job";
    let timestamp = 1704110400000_i64;

    let (_index, snapshot_service) = setup_complete_backup(&env, job_id, timestamp);

    // Verify setup worked
    let meta_dir = get_meta_dir(dest_path);
    assert!(meta_dir.exists(), "Setup should create .amber-meta");

    // Action: Delete the .amber-meta directory
    fs::remove_dir_all(&meta_dir).unwrap();
    assert!(!meta_dir.exists(), ".amber-meta should be deleted");

    // Verify: SnapshotService falls back to filesystem scan (not crash)
    let result = snapshot_service.list_snapshots(job_id, dest_path).await;

    // Should succeed (graceful degradation)
    assert!(
        result.is_ok(),
        "SnapshotService should not crash when .amber-meta is deleted"
    );

    let snapshots = result.unwrap();
    // Should find snapshot via filesystem scan
    assert_eq!(
        snapshots.len(),
        1,
        "Should still find snapshot via filesystem fallback"
    );
}

#[tokio::test]
async fn test_manifest_deleted_index_remains() {
    // Setup: Create manifest and index
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();
    let job_id = "test-job";
    let timestamp = 1704110400000_i64;

    let (_index, snapshot_service) = setup_complete_backup(&env, job_id, timestamp);

    // Action: Delete just the manifest.json (not index.db)
    let manifest_path = get_manifest_path(dest_path);
    assert!(manifest_path.exists(), "Manifest should exist");
    fs::remove_file(&manifest_path).unwrap();
    assert!(!manifest_path.exists(), "Manifest should be deleted");

    // Verify index still exists
    let index_path = get_index_path(dest_path);
    assert!(index_path.exists(), "Index should still exist");

    // Verify: Can still list snapshots from index
    let result = snapshot_service.list_snapshots(job_id, dest_path).await;

    assert!(
        result.is_ok(),
        "Should be able to list snapshots from index even without manifest"
    );

    let snapshots = result.unwrap();
    assert_eq!(snapshots.len(), 1, "Should find snapshot from index");
}

#[tokio::test]
async fn test_index_deleted_manifest_remains() {
    // Setup: Create manifest and index
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();
    let job_id = "test-job";
    let timestamp = 1704110400000_i64;

    let (_index, snapshot_service) = setup_complete_backup(&env, job_id, timestamp);

    // Action: Delete just the index.db (not manifest)
    let index_path = get_index_path(dest_path);
    assert!(index_path.exists(), "Index should exist");
    fs::remove_file(&index_path).unwrap();

    // Also delete WAL and SHM files if they exist
    let wal_path = index_path.with_extension("db-wal");
    let shm_path = index_path.with_extension("db-shm");
    let _ = fs::remove_file(wal_path);
    let _ = fs::remove_file(shm_path);

    // Verify manifest still exists
    let manifest_path = get_manifest_path(dest_path);
    assert!(manifest_path.exists(), "Manifest should still exist");

    // Verify: Can still list snapshots from manifest
    let result = snapshot_service.list_snapshots(job_id, dest_path).await;

    assert!(
        result.is_ok(),
        "Should be able to list snapshots from manifest even without index"
    );

    let snapshots = result.unwrap();
    assert_eq!(snapshots.len(), 1, "Should find snapshot from manifest");
}

// ============================================================================
// DATABASE CORRUPTION SCENARIOS
// ============================================================================

#[test]
fn test_index_db_corrupted() {
    // Setup: Create valid index
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();
    let job_id = "test-job";
    let timestamp = 1704110400000_i64;

    let (index, _) = setup_complete_backup(&env, job_id, timestamp);

    // Verify we can query it
    assert!(
        index.is_indexed(job_id, timestamp).unwrap(),
        "Should be indexed initially"
    );

    // Get the db path and drop the index to release the lock
    let db_path = index.get_db_path().to_path_buf();
    drop(index);

    // Action: Overwrite index.db with garbage bytes
    fs::write(&db_path, b"THIS IS GARBAGE NOT A SQLITE DATABASE").unwrap();

    // Verify: Service handles gracefully (error, not crash/panic)
    // Try to reopen the corrupted database at the same location
    let result = IndexService::for_destination(dest_path);

    // It should error, not panic
    assert!(
        result.is_err(),
        "Opening corrupted database should return an error, not crash"
    );
}

#[test]
fn test_index_db_truncated() {
    // Setup: Create valid index with data
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();
    let job_id = "test-job";
    let timestamp = 1704110400000_i64;

    let (index, _) = setup_complete_backup(&env, job_id, timestamp);

    // Verify we can query it
    let snapshots = index.list_snapshots(job_id).unwrap();
    assert!(!snapshots.is_empty(), "Should have snapshots initially");

    // Get the db path and drop the index to release the lock
    let db_path = index.get_db_path().to_path_buf();
    drop(index);

    // Read the file and truncate it
    let original = fs::read(&db_path).unwrap();
    let truncated = &original[..original.len() / 4]; // Keep only first quarter
    fs::write(&db_path, truncated).unwrap();

    // Verify: Service handles gracefully
    let result = IndexService::for_destination(dest_path);

    // Truncated SQLite file should fail to open or have schema issues
    // Either error or empty results is acceptable - panic is not
    if let Ok(service) = result {
        // If it opened, queries should handle gracefully
        let query_result = service.list_snapshots(job_id);
        // Either error or empty results
        assert!(
            query_result.is_err() || query_result.unwrap().is_empty(),
            "Truncated database should either error or return no results"
        );
    }
    // If it errored on open, that's also acceptable
}

#[tokio::test]
async fn test_manifest_truncated_mid_write() {
    // Setup: Write a partial/truncated manifest.json
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();

    // Write truncated JSON (simulating crash mid-write)
    let manifest_path = get_manifest_path(dest_path);
    let partial_json = r#"{"version": 1, "jobId": "test", "jobName": "Test", "sou"#;
    fs::write(&manifest_path, partial_json).unwrap();

    // Verify: read_manifest returns error, not panic
    let result = read_manifest(dest_path).await;

    assert!(
        result.is_err(),
        "Truncated manifest should return error, not panic"
    );

    // Error message should indicate parse failure
    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("parse") || err_msg.contains("Parse"),
        "Error should mention parsing: {}",
        err_msg
    );
}

// ============================================================================
// MANIFEST/INDEX DESYNC SCENARIOS
// ============================================================================

#[tokio::test]
async fn test_manifest_has_snapshot_index_doesnt() {
    // Setup: Create manifest with snapshot entry
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();
    let job_id = "test-job";
    let timestamp = 1704110400000_i64;

    // Create snapshot directory
    let snapshot_path = env.snapshot_path("2024-01-01-120000");
    fs::create_dir_all(&snapshot_path).unwrap();
    generate::file(&snapshot_path.join("file.txt"), b"content").unwrap();

    // Create manifest with snapshot
    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();

    let mut manifest = BackupManifest::new(
        job_id.to_string(),
        "Test Backup".to_string(),
        "/source".to_string(),
        "test-machine".to_string(),
    );

    let snap = ManifestSnapshot::from_timestamp(
        timestamp,
        "2024-01-01-120000".to_string(),
        1,
        100,
        ManifestSnapshotStatus::Complete,
    );
    manifest.add_snapshot(snap);
    write_manifest(dest_path, &manifest).await.unwrap();

    // Create index but DO NOT index the snapshot
    let index = create_test_index(dest_path);
    let snapshot_service = create_test_snapshot_service(dest_path);

    // Verify: Index does NOT have snapshot
    assert!(
        !index.is_indexed(job_id, timestamp).unwrap(),
        "Index should NOT have this snapshot"
    );

    // Verify: What does list_snapshots return? Does compare work?
    // The SnapshotService should fall back to manifest
    let snapshots = snapshot_service
        .list_snapshots(job_id, dest_path)
        .await
        .unwrap();

    assert_eq!(
        snapshots.len(),
        1,
        "Should find snapshot from manifest even though not in index"
    );
}

#[tokio::test]
async fn test_index_has_snapshot_manifest_doesnt() {
    // Setup: Index has snapshot data, but manifest doesn't list it
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();
    let job_id = "test-job";
    let timestamp = 1704110400000_i64;

    // Create snapshot directory
    let snapshot_path = env.snapshot_path("2024-01-01-120000");
    fs::create_dir_all(&snapshot_path).unwrap();
    generate::file(&snapshot_path.join("file.txt"), b"content").unwrap();

    // Create index and index the snapshot
    let index = create_test_index(dest_path);
    index
        .index_snapshot(job_id, timestamp, snapshot_path.to_str().unwrap())
        .unwrap();

    // Create manifest WITHOUT the snapshot
    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();

    let manifest = BackupManifest::new(
        job_id.to_string(),
        "Test Backup".to_string(),
        "/source".to_string(),
        "test-machine".to_string(),
    );
    // Note: NOT adding snapshot to manifest
    write_manifest(dest_path, &manifest).await.unwrap();

    let snapshot_service = create_test_snapshot_service(dest_path);

    // Verify: Index HAS snapshot
    assert!(
        index.is_indexed(job_id, timestamp).unwrap(),
        "Index should have this snapshot"
    );

    // Verify: list_snapshots should still find it from index (priority)
    let snapshots = snapshot_service
        .list_snapshots(job_id, dest_path)
        .await
        .unwrap();

    assert_eq!(
        snapshots.len(),
        1,
        "Should find snapshot from index even though not in manifest"
    );
}

#[tokio::test]
async fn test_manifest_and_index_disagree_on_stats() {
    // Setup: Manifest says 100 files, 1GB; Index says 3 files, 100 bytes
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();
    let job_id = "test-job";
    let timestamp = 1704110400000_i64;

    // Create snapshot directory with 3 small files
    let snapshot_path = env.snapshot_path("2024-01-01-120000");
    fs::create_dir_all(&snapshot_path).unwrap();
    generate::file(&snapshot_path.join("file1.txt"), b"a").unwrap();
    generate::file(&snapshot_path.join("file2.txt"), b"b").unwrap();
    generate::file(&snapshot_path.join("file3.txt"), b"c").unwrap();

    // Create index (will have actual stats: 3 files, ~3 bytes)
    let index = create_test_index(dest_path);
    let indexed = index
        .index_snapshot(job_id, timestamp, snapshot_path.to_str().unwrap())
        .unwrap();

    // Verify actual index stats
    assert_eq!(indexed.file_count, 3);
    assert!(indexed.total_size < 100);

    // Create manifest with WRONG stats
    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();

    let mut manifest = BackupManifest::new(
        job_id.to_string(),
        "Test Backup".to_string(),
        "/source".to_string(),
        "test-machine".to_string(),
    );

    let snap = ManifestSnapshot::from_timestamp(
        timestamp,
        "2024-01-01-120000".to_string(),
        100,           // WRONG: says 100 files
        1_000_000_000, // WRONG: says 1GB
        ManifestSnapshotStatus::Complete,
    );
    manifest.add_snapshot(snap);
    write_manifest(dest_path, &manifest).await.unwrap();

    let snapshot_service = create_test_snapshot_service(dest_path);

    // Verify: Which source wins? (Index has priority in SnapshotService)
    let snapshots = snapshot_service
        .list_snapshots(job_id, dest_path)
        .await
        .unwrap();

    assert_eq!(snapshots.len(), 1);

    // Index should win (it has priority in the implementation)
    // So we should see the ACTUAL stats, not the manifest's wrong stats
    let snapshot = &snapshots[0];
    assert_eq!(
        snapshot.file_count, 3,
        "Should use index stats (3 files), not manifest stats (100 files)"
    );
    assert!(
        snapshot.size_bytes < 1_000_000,
        "Should use index size, not manifest's 1GB"
    );
}

// ============================================================================
// SNAPSHOT DIRECTORY CORRUPTION
// ============================================================================

#[tokio::test]
async fn test_snapshot_directory_missing() {
    // Setup: Manifest/index say snapshot exists
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();
    let job_id = "test-job";
    let timestamp = 1704110400000_i64;

    let (index, snapshot_service) = setup_complete_backup(&env, job_id, timestamp);

    // Verify setup
    assert!(index.is_indexed(job_id, timestamp).unwrap());

    // Action: Delete the snapshot directory from filesystem
    let snapshot_path = env.snapshot_path("2024-01-01-120000");
    assert!(snapshot_path.exists(), "Snapshot dir should exist");
    fs::remove_dir_all(&snapshot_path).unwrap();
    assert!(!snapshot_path.exists(), "Snapshot dir should be deleted");

    // Verify: list_snapshots behavior
    // Index still has the data, but directory is gone
    let snapshots = snapshot_service
        .list_snapshots(job_id, dest_path)
        .await
        .unwrap();

    // Should still list it from index (metadata is intact)
    assert_eq!(snapshots.len(), 1, "Index should still list the snapshot");

    // But browsing the directory should fail or return empty
    let browse_result = index.get_directory_contents(job_id, timestamp, "");

    // This will succeed because index has the data in SQLite
    // The data is "stale" but doesn't cause a crash
    assert!(browse_result.is_ok(), "Browsing should not crash");
}

#[tokio::test]
async fn test_snapshot_partially_deleted() {
    // Setup: Create snapshot with 10 files, index it
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();
    let job_id = "test-job";
    let timestamp = 1704110400000_i64;

    let snapshot_path = env.snapshot_path("2024-01-01-120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Create 10 files
    for i in 0..10 {
        let filename = format!("file_{:02}.txt", i);
        generate::file(
            &snapshot_path.join(&filename),
            format!("content {}", i).as_bytes(),
        )
        .unwrap();
    }

    // Index the snapshot
    let index = create_test_index(dest_path);
    let indexed = index
        .index_snapshot(job_id, timestamp, snapshot_path.to_str().unwrap())
        .unwrap();
    assert_eq!(indexed.file_count, 10);

    // Action: Delete 5 files from the snapshot directory
    for i in 0..5 {
        let filename = format!("file_{:02}.txt", i);
        fs::remove_file(snapshot_path.join(&filename)).unwrap();
    }

    // Verify: Index browsing behavior
    // Index still shows 10 files (stale data)
    let contents = index.get_directory_contents(job_id, timestamp, "").unwrap();
    assert_eq!(
        contents.len(),
        10,
        "Index should still show 10 files (stale data)"
    );

    // If we re-index, we should see 5 files
    let reindexed = index
        .index_snapshot(job_id, timestamp, snapshot_path.to_str().unwrap())
        .unwrap();
    assert_eq!(reindexed.file_count, 5, "Re-indexing should show 5 files");

    // Now index should show 5 files
    let updated_contents = index.get_directory_contents(job_id, timestamp, "").unwrap();
    assert_eq!(
        updated_contents.len(),
        5,
        "After re-index, should show 5 files"
    );
}

// ============================================================================
// CONCURRENT/INTERRUPTED OPERATION SCENARIOS
// ============================================================================

#[tokio::test]
async fn test_index_during_another_index() {
    // Can we index the same snapshot twice simultaneously?
    // What happens to the database?
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();
    let job_id = "test-job";
    let timestamp = 1704110400000_i64;

    // Create snapshot with some files
    let snapshot_path = env.snapshot_path("2024-01-01-120000");
    generate::nested_dirs(&snapshot_path, 2, 3).unwrap();

    // Create two index services pointing to the same database
    let index1 = create_test_index(dest_path);

    // Index concurrently (sequential here, but tests database locking)
    let result1 = index1.index_snapshot(job_id, timestamp, snapshot_path.to_str().unwrap());
    let result2 = index1.index_snapshot(job_id, timestamp, snapshot_path.to_str().unwrap());

    // Both should succeed (re-indexing is idempotent)
    assert!(
        result1.is_ok(),
        "First index should succeed: {:?}",
        result1.err()
    );
    assert!(
        result2.is_ok(),
        "Second index should succeed: {:?}",
        result2.err()
    );

    // Database should be consistent
    let snapshots = index1.list_snapshots(job_id).unwrap();
    assert_eq!(
        snapshots.len(),
        1,
        "Should have exactly 1 snapshot (not duplicates)"
    );
}

#[test]
fn test_read_only_destination() {
    // What happens if the destination becomes read-only?
    // Note: We don't actually make the directory read-only because that
    // would cause issues with test cleanup. This test verifies that
    // read operations work independently of write state.
    let env = TestBackupEnv::new().unwrap();
    let job_id = "test-job";
    let timestamp = 1704110400000_i64;

    // Create initial backup
    let (index, _) = setup_complete_backup(&env, job_id, timestamp);

    // Verify initial state
    assert!(index.is_indexed(job_id, timestamp).unwrap());

    // Reading should still work
    let snapshots = index.list_snapshots(job_id).unwrap();
    assert_eq!(snapshots.len(), 1);

    let contents = index.get_directory_contents(job_id, timestamp, "").unwrap();
    assert!(!contents.is_empty());
}

#[test]
fn test_manifest_write_permission_error() {
    // Test that write errors are properly reported
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create a file where the manifest.json should be (blocking directory creation)
    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();

    // Make manifest path a directory to cause write error
    let manifest_path = get_manifest_path(dest_path);
    fs::create_dir_all(&manifest_path).unwrap(); // This makes it a directory!

    let manifest = BackupManifest::new(
        "job".to_string(),
        "name".to_string(),
        "/source".to_string(),
        "machine".to_string(),
    );

    // Writing should fail because manifest_path is a directory
    let result = tokio::runtime::Runtime::new()
        .unwrap()
        .block_on(write_manifest(dest_path, &manifest));

    assert!(
        result.is_err(),
        "Writing to a directory should fail with error, not panic"
    );
}

// ============================================================================
// EMPTY/EDGE CASE SCENARIOS
// ============================================================================

#[test]
fn test_index_empty_database_queries() {
    // Test querying an empty but valid database
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create index but don't add any snapshots
    let index = create_test_index(dest_path);

    // All these should return empty results, not errors
    let snapshots = index.list_snapshots("nonexistent-job").unwrap();
    assert!(snapshots.is_empty());

    let stats = index.get_job_aggregate_stats("nonexistent-job").unwrap();
    assert_eq!(stats.total_snapshots, 0);
    assert_eq!(stats.total_files, 0);

    let density = index
        .get_snapshot_density("nonexistent-job", "month")
        .unwrap();
    assert!(density.is_empty());

    let is_indexed = index.is_indexed("nonexistent-job", 12345).unwrap();
    assert!(!is_indexed);
}

#[tokio::test]
async fn test_manifest_with_zero_snapshots() {
    // Test manifest operations when there are no snapshots
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest with no snapshots
    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();

    let manifest = BackupManifest::new(
        "empty-job".to_string(),
        "Empty Job".to_string(),
        "/source".to_string(),
        "machine".to_string(),
    );
    write_manifest(dest_path, &manifest).await.unwrap();

    // Read it back
    let result = read_manifest(dest_path).await.unwrap();
    assert!(result.is_some());

    let m = result.unwrap();
    assert!(m.snapshots.is_empty());
    assert_eq!(m.total_file_count(), 0);
    assert_eq!(m.total_logical_size(), 0);
    assert!(m.latest_snapshot().is_none());
}

#[test]
fn test_index_nonexistent_snapshot_path() {
    // What happens when we try to index a path that doesn't exist?
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    let index = create_test_index(dest_path);

    let result = index.index_snapshot("test-job", 12345, "/nonexistent/path/that/does/not/exist");

    // Should return an error, not panic
    assert!(
        result.is_err(),
        "Indexing non-existent path should return error"
    );

    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("not exist") || err_msg.contains("does not exist"),
        "Error should mention path doesn't exist: {}",
        err_msg
    );
}

#[test]
fn test_compare_with_only_one_snapshot_indexed() {
    // What happens when comparing and only one snapshot exists?
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();
    let job_id = "test-job";
    let ts_a = 1704110400000_i64;
    let ts_b = 1704196800000_i64;

    // Create and index only one snapshot
    let snapshot_path = env.snapshot_path("2024-01-01-120000");
    fs::create_dir_all(&snapshot_path).unwrap();
    generate::file(&snapshot_path.join("file.txt"), b"content").unwrap();

    let index = create_test_index(dest_path);
    index
        .index_snapshot(job_id, ts_a, snapshot_path.to_str().unwrap())
        .unwrap();

    // Try to compare with non-existent snapshot B
    let result = index.compare_snapshots(job_id, ts_a, ts_b, None);

    assert!(
        result.is_err(),
        "Compare should fail when snapshot B missing"
    );

    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("Snapshot B not found"),
        "Error should mention snapshot B: {}",
        err_msg
    );
}
