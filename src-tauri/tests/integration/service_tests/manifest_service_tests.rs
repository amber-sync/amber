//! Integration tests for ManifestService
//!
//! Tests real manifest file operations with temp directories.

use crate::common::test_common::TestBackupEnv;
use app_lib::services::manifest_service::{
    add_snapshot_to_manifest, get_manifest_path, get_meta_dir, get_or_create_manifest,
    manifest_exists, read_manifest, remove_snapshot_from_manifest, write_manifest, ManifestError,
    AMBER_META_DIR, MANIFEST_FILENAME,
};
use app_lib::types::manifest::{BackupManifest, ManifestSnapshot, ManifestSnapshotStatus};
use std::fs;

// ============================================================================
// Path Construction Tests
// ============================================================================

#[test]
fn test_get_meta_dir() {
    let dest_path = "/backup/drive";
    let meta_dir = get_meta_dir(dest_path);

    assert_eq!(meta_dir.to_str().unwrap(), "/backup/drive/.amber-meta");
    assert!(meta_dir.ends_with(AMBER_META_DIR));
}

#[test]
fn test_get_meta_dir_trailing_slash() {
    // Test with trailing slash
    let dest_path = "/backup/drive/";
    let meta_dir = get_meta_dir(dest_path);

    // Should still work correctly
    assert!(meta_dir.to_str().unwrap().contains(AMBER_META_DIR));
}

#[test]
fn test_get_manifest_path() {
    let dest_path = "/backup/drive";
    let manifest_path = get_manifest_path(dest_path);

    assert_eq!(
        manifest_path.to_str().unwrap(),
        "/backup/drive/.amber-meta/manifest.json"
    );
    assert!(manifest_path.ends_with(MANIFEST_FILENAME));
}

#[test]
fn test_get_manifest_path_nested() {
    // Test with nested destination path
    let dest_path = "/volumes/external/backups/job-123";
    let manifest_path = get_manifest_path(dest_path);

    assert!(manifest_path.to_str().unwrap().contains(".amber-meta"));
    assert!(manifest_path.to_str().unwrap().ends_with("manifest.json"));
}

// ============================================================================
// Manifest Existence Tests
// ============================================================================

#[tokio::test]
async fn test_manifest_exists_false_when_missing() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Empty destination should not have manifest
    let exists = manifest_exists(dest_path).await;

    assert!(!exists, "manifest_exists should return false for empty dir");
}

#[tokio::test]
async fn test_manifest_exists_false_with_empty_meta_dir() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create .amber-meta directory but no manifest file
    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();

    let exists = manifest_exists(dest_path).await;

    assert!(
        !exists,
        "manifest_exists should return false when meta dir exists but manifest doesn't"
    );
}

#[tokio::test]
async fn test_manifest_exists_true_when_present() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create a manifest
    let manifest = BackupManifest::new(
        "job-123".to_string(),
        "Test Job".to_string(),
        "/source/path".to_string(),
        "test-machine".to_string(),
    );
    write_manifest(dest_path, &manifest).await.unwrap();

    let exists = manifest_exists(dest_path).await;

    assert!(
        exists,
        "manifest_exists should return true when manifest file exists"
    );
}

// ============================================================================
// Read Manifest Tests
// ============================================================================

#[tokio::test]
async fn test_read_manifest_returns_none_when_missing() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Read from empty destination
    let result = read_manifest(dest_path).await;

    assert!(
        result.is_ok(),
        "read_manifest should not error for missing manifest"
    );
    assert!(
        result.unwrap().is_none(),
        "read_manifest should return None when manifest doesn't exist"
    );
}

#[tokio::test]
async fn test_read_manifest_valid_json() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create and write a manifest
    let original = BackupManifest::new(
        "job-456".to_string(),
        "Documents Backup".to_string(),
        "/Users/me/Documents".to_string(),
        "MacBook-xyz".to_string(),
    );
    write_manifest(dest_path, &original).await.unwrap();

    // Read it back
    let result = read_manifest(dest_path).await.unwrap();

    assert!(result.is_some(), "Should successfully read valid manifest");

    let manifest = result.unwrap();
    assert_eq!(manifest.job_id, "job-456");
    assert_eq!(manifest.job_name, "Documents Backup");
    assert_eq!(manifest.source_path, "/Users/me/Documents");
    assert_eq!(manifest.machine_id, "MacBook-xyz");
    assert_eq!(manifest.version, 1);
    assert!(manifest.snapshots.is_empty());
}

#[tokio::test]
async fn test_read_manifest_corrupted_json() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create .amber-meta directory and write corrupted JSON
    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();

    let manifest_path = get_manifest_path(dest_path);
    fs::write(&manifest_path, "{ invalid json without closing brace").unwrap();

    // Read should return an error
    let result = read_manifest(dest_path).await;

    assert!(
        result.is_err(),
        "read_manifest should error on corrupted JSON"
    );

    let err = result.unwrap_err();
    match err {
        ManifestError::ParseError(_) => {} // Expected
        other => panic!("Expected ParseError, got: {:?}", other),
    }
}

#[tokio::test]
async fn test_read_manifest_empty_file() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create .amber-meta directory and write empty file
    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();

    let manifest_path = get_manifest_path(dest_path);
    fs::write(&manifest_path, "").unwrap();

    // Read should return an error
    let result = read_manifest(dest_path).await;

    assert!(result.is_err(), "read_manifest should error on empty file");

    let err = result.unwrap_err();
    match err {
        ManifestError::ParseError(_) => {} // Expected
        other => panic!("Expected ParseError, got: {:?}", other),
    }
}

#[tokio::test]
async fn test_read_manifest_wrong_schema() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create .amber-meta directory and write valid JSON but wrong schema
    let meta_dir = get_meta_dir(dest_path);
    fs::create_dir_all(&meta_dir).unwrap();

    let manifest_path = get_manifest_path(dest_path);
    fs::write(
        &manifest_path,
        r#"{"someField": "value", "anotherField": 123}"#,
    )
    .unwrap();

    // Read should return an error due to missing required fields
    let result = read_manifest(dest_path).await;

    assert!(
        result.is_err(),
        "read_manifest should error on wrong JSON schema"
    );
}

// ============================================================================
// Write Manifest Tests
// ============================================================================

#[tokio::test]
async fn test_write_creates_meta_dir() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Verify .amber-meta doesn't exist yet
    let meta_dir = get_meta_dir(dest_path);
    assert!(!meta_dir.exists(), "Meta dir should not exist initially");

    // Write manifest
    let manifest = BackupManifest::new(
        "job-789".to_string(),
        "Test Job".to_string(),
        "/source".to_string(),
        "machine-id".to_string(),
    );
    write_manifest(dest_path, &manifest).await.unwrap();

    // Verify .amber-meta was created
    assert!(
        meta_dir.exists(),
        "write_manifest should create .amber-meta directory"
    );
    assert!(meta_dir.is_dir(), ".amber-meta should be a directory");

    // Verify manifest file was created
    let manifest_path = get_manifest_path(dest_path);
    assert!(manifest_path.exists(), "manifest.json should exist");
}

#[tokio::test]
async fn test_write_manifest_invalid_destination() {
    // Try to write to a non-existent destination
    let result = write_manifest(
        "/nonexistent/path/that/does/not/exist",
        &BackupManifest::new(
            "job".to_string(),
            "name".to_string(),
            "/source".to_string(),
            "machine".to_string(),
        ),
    )
    .await;

    assert!(
        result.is_err(),
        "write_manifest should error for non-existent destination"
    );

    let err = result.unwrap_err();
    match err {
        ManifestError::InvalidDestination(_) => {} // Expected
        other => panic!("Expected InvalidDestination, got: {:?}", other),
    }
}

#[tokio::test]
async fn test_write_manifest_overwrites_existing() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Write first manifest
    let manifest1 = BackupManifest::new(
        "job-old".to_string(),
        "Old Name".to_string(),
        "/old/source".to_string(),
        "old-machine".to_string(),
    );
    write_manifest(dest_path, &manifest1).await.unwrap();

    // Write second manifest (should overwrite)
    let manifest2 = BackupManifest::new(
        "job-new".to_string(),
        "New Name".to_string(),
        "/new/source".to_string(),
        "new-machine".to_string(),
    );
    write_manifest(dest_path, &manifest2).await.unwrap();

    // Read back should get the new manifest
    let result = read_manifest(dest_path).await.unwrap().unwrap();

    assert_eq!(result.job_id, "job-new");
    assert_eq!(result.job_name, "New Name");
}

// ============================================================================
// Get or Create Manifest Tests
// ============================================================================

#[tokio::test]
async fn test_get_or_create_creates_new_manifest() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Call get_or_create on empty destination
    let manifest = get_or_create_manifest(dest_path, "job-create", "My Backup", "/Users/me/docs")
        .await
        .unwrap();

    assert_eq!(manifest.job_id, "job-create");
    assert_eq!(manifest.job_name, "My Backup");
    assert_eq!(manifest.source_path, "/Users/me/docs");
    assert!(manifest.snapshots.is_empty());

    // Verify file was created
    assert!(
        manifest_exists(dest_path).await,
        "Manifest file should be created"
    );
}

#[tokio::test]
async fn test_get_or_create_returns_existing_manifest() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest first
    let manifest1 =
        get_or_create_manifest(dest_path, "job-existing", "First Name", "/first/source")
            .await
            .unwrap();

    let created_at = manifest1.created_at;

    // Call get_or_create again with same job_id
    let manifest2 =
        get_or_create_manifest(dest_path, "job-existing", "Second Name", "/second/source")
            .await
            .unwrap();

    // Should return existing manifest with original values
    assert_eq!(manifest2.job_id, "job-existing");
    assert_eq!(manifest2.job_name, "First Name"); // Original name preserved
    assert_eq!(manifest2.source_path, "/first/source"); // Original source preserved
    assert_eq!(manifest2.created_at, created_at); // Same creation time
}

#[tokio::test]
async fn test_get_or_create_job_mismatch_error() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest for one job
    get_or_create_manifest(dest_path, "job-alpha", "Alpha Backup", "/alpha")
        .await
        .unwrap();

    // Try to get or create with different job_id
    let result = get_or_create_manifest(dest_path, "job-beta", "Beta Backup", "/beta").await;

    assert!(result.is_err(), "Should error when job_id doesn't match");

    let err = result.unwrap_err();
    match err {
        ManifestError::JobMismatch { expected, found } => {
            assert_eq!(expected, "job-beta");
            assert_eq!(found, "job-alpha");
        }
        other => panic!("Expected JobMismatch, got: {:?}", other),
    }
}

// ============================================================================
// Snapshot Management Tests
// ============================================================================

#[tokio::test]
async fn test_add_snapshot_to_manifest() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create initial manifest
    get_or_create_manifest(dest_path, "job-snap", "Snapshot Test", "/source")
        .await
        .unwrap();

    // Add a snapshot
    let snapshot = ManifestSnapshot::new(
        "2024-01-01-120000".to_string(),
        500,
        1024 * 1024,
        ManifestSnapshotStatus::Complete,
        Some(3000),
    );

    let updated = add_snapshot_to_manifest(dest_path, snapshot).await.unwrap();

    assert_eq!(updated.snapshots.len(), 1);
    assert_eq!(updated.snapshots[0].folder_name, "2024-01-01-120000");
    assert_eq!(updated.snapshots[0].file_count, 500);
    assert_eq!(updated.snapshots[0].total_size, 1024 * 1024);
    assert_eq!(
        updated.snapshots[0].status,
        ManifestSnapshotStatus::Complete
    );
    assert_eq!(updated.snapshots[0].duration_ms, Some(3000));

    // Verify persisted by re-reading
    let reread = read_manifest(dest_path).await.unwrap().unwrap();
    assert_eq!(reread.snapshots.len(), 1);
}

#[tokio::test]
async fn test_add_multiple_snapshots() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create initial manifest
    get_or_create_manifest(dest_path, "job-multi", "Multi Snapshot Test", "/source")
        .await
        .unwrap();

    // Add first snapshot
    let snapshot1 = ManifestSnapshot::new(
        "2024-01-01-120000".to_string(),
        100,
        1024,
        ManifestSnapshotStatus::Complete,
        Some(1000),
    );
    add_snapshot_to_manifest(dest_path, snapshot1)
        .await
        .unwrap();

    // Add second snapshot
    let snapshot2 = ManifestSnapshot::new(
        "2024-01-02-120000".to_string(),
        200,
        2048,
        ManifestSnapshotStatus::Complete,
        Some(2000),
    );
    add_snapshot_to_manifest(dest_path, snapshot2)
        .await
        .unwrap();

    // Add third snapshot
    let snapshot3 = ManifestSnapshot::new(
        "2024-01-03-120000".to_string(),
        300,
        3072,
        ManifestSnapshotStatus::Partial,
        None,
    );
    let final_manifest = add_snapshot_to_manifest(dest_path, snapshot3)
        .await
        .unwrap();

    assert_eq!(final_manifest.snapshots.len(), 3);

    // Verify order and values
    assert_eq!(final_manifest.snapshots[0].folder_name, "2024-01-01-120000");
    assert_eq!(final_manifest.snapshots[1].folder_name, "2024-01-02-120000");
    assert_eq!(final_manifest.snapshots[2].folder_name, "2024-01-03-120000");

    // Verify total methods work
    assert_eq!(final_manifest.total_file_count(), 600); // 100 + 200 + 300
    assert_eq!(final_manifest.total_logical_size(), 1024 + 2048 + 3072);
}

#[tokio::test]
async fn test_add_snapshot_to_missing_manifest() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Don't create manifest first - try to add snapshot directly
    let snapshot = ManifestSnapshot::new(
        "2024-01-01-120000".to_string(),
        100,
        1024,
        ManifestSnapshotStatus::Complete,
        None,
    );

    let result = add_snapshot_to_manifest(dest_path, snapshot).await;

    assert!(
        result.is_err(),
        "add_snapshot_to_manifest should error when manifest doesn't exist"
    );

    let err = result.unwrap_err();
    match err {
        ManifestError::NotFound(_) => {} // Expected
        other => panic!("Expected NotFound, got: {:?}", other),
    }
}

#[tokio::test]
async fn test_remove_snapshot_from_manifest() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest and add a snapshot
    get_or_create_manifest(dest_path, "job-remove", "Remove Test", "/source")
        .await
        .unwrap();

    let snapshot = ManifestSnapshot::new(
        "2024-01-01-120000".to_string(),
        500,
        1024 * 1024,
        ManifestSnapshotStatus::Complete,
        Some(3000),
    );
    let added = add_snapshot_to_manifest(dest_path, snapshot).await.unwrap();
    let snapshot_id = added.snapshots[0].id.clone();

    // Remove the snapshot
    let removed = remove_snapshot_from_manifest(dest_path, &snapshot_id)
        .await
        .unwrap();

    assert!(removed.is_some(), "Should return the removed snapshot");

    let removed_snap = removed.unwrap();
    assert_eq!(removed_snap.folder_name, "2024-01-01-120000");

    // Verify manifest no longer has the snapshot
    let reread = read_manifest(dest_path).await.unwrap().unwrap();
    assert!(
        reread.snapshots.is_empty(),
        "Manifest should have no snapshots after removal"
    );
}

#[tokio::test]
async fn test_remove_nonexistent_snapshot() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest with one snapshot
    get_or_create_manifest(dest_path, "job-noremove", "No Remove Test", "/source")
        .await
        .unwrap();

    let snapshot = ManifestSnapshot::new(
        "2024-01-01-120000".to_string(),
        100,
        1024,
        ManifestSnapshotStatus::Complete,
        None,
    );
    add_snapshot_to_manifest(dest_path, snapshot).await.unwrap();

    // Try to remove a non-existent snapshot ID
    let result = remove_snapshot_from_manifest(dest_path, "nonexistent-id-12345")
        .await
        .unwrap();

    assert!(
        result.is_none(),
        "Removing non-existent snapshot should return None (no-op)"
    );

    // Verify original snapshot is still there
    let reread = read_manifest(dest_path).await.unwrap().unwrap();
    assert_eq!(reread.snapshots.len(), 1);
}

#[tokio::test]
async fn test_remove_specific_snapshot_from_multiple() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest with multiple snapshots
    get_or_create_manifest(
        dest_path,
        "job-multi-remove",
        "Multi Remove Test",
        "/source",
    )
    .await
    .unwrap();

    // Add three snapshots
    let snap1 = ManifestSnapshot::new(
        "2024-01-01-120000".to_string(),
        100,
        1024,
        ManifestSnapshotStatus::Complete,
        None,
    );
    let added1 = add_snapshot_to_manifest(dest_path, snap1).await.unwrap();
    let id1 = added1.snapshots[0].id.clone();

    let snap2 = ManifestSnapshot::new(
        "2024-01-02-120000".to_string(),
        200,
        2048,
        ManifestSnapshotStatus::Complete,
        None,
    );
    let added2 = add_snapshot_to_manifest(dest_path, snap2).await.unwrap();
    let id2 = added2.snapshots[1].id.clone();

    let snap3 = ManifestSnapshot::new(
        "2024-01-03-120000".to_string(),
        300,
        3072,
        ManifestSnapshotStatus::Complete,
        None,
    );
    add_snapshot_to_manifest(dest_path, snap3).await.unwrap();

    // Remove the middle snapshot
    let removed = remove_snapshot_from_manifest(dest_path, &id2)
        .await
        .unwrap();

    assert!(removed.is_some());
    assert_eq!(removed.unwrap().folder_name, "2024-01-02-120000");

    // Verify only first and third remain
    let reread = read_manifest(dest_path).await.unwrap().unwrap();
    assert_eq!(reread.snapshots.len(), 2);
    assert_eq!(reread.snapshots[0].id, id1);
    assert_eq!(reread.snapshots[1].folder_name, "2024-01-03-120000");
}

// ============================================================================
// Manifest Data Integrity Tests
// ============================================================================

#[tokio::test]
async fn test_manifest_preserves_timestamps() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest
    let manifest1 = get_or_create_manifest(dest_path, "job-ts", "Timestamp Test", "/source")
        .await
        .unwrap();

    let created_at = manifest1.created_at;
    let initial_updated_at = manifest1.updated_at;

    // Add a snapshot (should update updated_at but not created_at)
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

    let snapshot = ManifestSnapshot::new(
        "2024-01-01-120000".to_string(),
        100,
        1024,
        ManifestSnapshotStatus::Complete,
        None,
    );
    let updated = add_snapshot_to_manifest(dest_path, snapshot).await.unwrap();

    // created_at should be unchanged
    assert_eq!(updated.created_at, created_at);

    // updated_at should be newer or same (might be same on fast systems)
    assert!(updated.updated_at >= initial_updated_at);

    // Re-read and verify persistence
    let reread = read_manifest(dest_path).await.unwrap().unwrap();
    assert_eq!(reread.created_at, created_at);
}

#[tokio::test]
async fn test_manifest_snapshot_status_types() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    get_or_create_manifest(dest_path, "job-status", "Status Test", "/source")
        .await
        .unwrap();

    // Add snapshots with different statuses
    let complete = ManifestSnapshot::new(
        "complete".to_string(),
        100,
        1024,
        ManifestSnapshotStatus::Complete,
        Some(1000),
    );

    let partial = ManifestSnapshot::new(
        "partial".to_string(),
        50,
        512,
        ManifestSnapshotStatus::Partial,
        Some(500),
    );

    let failed = ManifestSnapshot::new(
        "failed".to_string(),
        0,
        0,
        ManifestSnapshotStatus::Failed,
        None,
    );

    add_snapshot_to_manifest(dest_path, complete).await.unwrap();
    add_snapshot_to_manifest(dest_path, partial).await.unwrap();
    add_snapshot_to_manifest(dest_path, failed).await.unwrap();

    // Re-read and verify all statuses are preserved
    let manifest = read_manifest(dest_path).await.unwrap().unwrap();

    assert_eq!(manifest.snapshots.len(), 3);
    assert_eq!(
        manifest.snapshots[0].status,
        ManifestSnapshotStatus::Complete
    );
    assert_eq!(
        manifest.snapshots[1].status,
        ManifestSnapshotStatus::Partial
    );
    assert_eq!(manifest.snapshots[2].status, ManifestSnapshotStatus::Failed);
}

#[tokio::test]
async fn test_manifest_unicode_values() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest with unicode values
    let manifest = get_or_create_manifest(
        dest_path,
        "job-unicode-测试",
        "备份工作 🎉 Резервное копирование",
        "/Users/用户/文档",
    )
    .await
    .unwrap();

    assert_eq!(manifest.job_id, "job-unicode-测试");
    assert_eq!(manifest.job_name, "备份工作 🎉 Резервное копирование");
    assert_eq!(manifest.source_path, "/Users/用户/文档");

    // Re-read and verify unicode is preserved
    let reread = read_manifest(dest_path).await.unwrap().unwrap();
    assert_eq!(reread.job_id, "job-unicode-测试");
    assert_eq!(reread.job_name, "备份工作 🎉 Резервное копирование");
    assert_eq!(reread.source_path, "/Users/用户/文档");
}

#[tokio::test]
async fn test_manifest_latest_snapshot() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    get_or_create_manifest(dest_path, "job-latest", "Latest Test", "/source")
        .await
        .unwrap();

    // Add older snapshot
    let older = ManifestSnapshot::from_timestamp(
        1704067200000, // Jan 1, 2024
        "2024-01-01-120000".to_string(),
        100,
        1024,
        ManifestSnapshotStatus::Complete,
    );
    add_snapshot_to_manifest(dest_path, older).await.unwrap();

    // Add newer snapshot
    let newer = ManifestSnapshot::from_timestamp(
        1704153600000, // Jan 2, 2024
        "2024-01-02-120000".to_string(),
        200,
        2048,
        ManifestSnapshotStatus::Complete,
    );
    add_snapshot_to_manifest(dest_path, newer).await.unwrap();

    // Read and verify latest_snapshot method works
    let manifest = read_manifest(dest_path).await.unwrap().unwrap();

    let latest = manifest.latest_snapshot();
    assert!(latest.is_some());
    assert_eq!(latest.unwrap().folder_name, "2024-01-02-120000");
    assert_eq!(latest.unwrap().timestamp, 1704153600000);
}

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

#[tokio::test]
async fn test_manifest_with_special_characters_in_path() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create manifest with special characters in source path
    let manifest = get_or_create_manifest(
        dest_path,
        "job-special",
        "Special Path Test",
        "/Users/name with spaces/folder (copy)/file's.txt",
    )
    .await
    .unwrap();

    assert_eq!(
        manifest.source_path,
        "/Users/name with spaces/folder (copy)/file's.txt"
    );

    // Re-read and verify
    let reread = read_manifest(dest_path).await.unwrap().unwrap();
    assert_eq!(
        reread.source_path,
        "/Users/name with spaces/folder (copy)/file's.txt"
    );
}

#[tokio::test]
async fn test_manifest_large_snapshot_values() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    get_or_create_manifest(dest_path, "job-large", "Large Values Test", "/source")
        .await
        .unwrap();

    // Add snapshot with large values (simulating TB backup)
    let large_snap = ManifestSnapshot::new(
        "2024-01-01-120000".to_string(),
        10_000_000,        // 10 million files
        1_000_000_000_000, // 1 TB
        ManifestSnapshotStatus::Complete,
        Some(86_400_000), // 24 hours in ms
    );

    add_snapshot_to_manifest(dest_path, large_snap)
        .await
        .unwrap();

    // Verify values are preserved
    let manifest = read_manifest(dest_path).await.unwrap().unwrap();
    assert_eq!(manifest.snapshots[0].file_count, 10_000_000);
    assert_eq!(manifest.snapshots[0].total_size, 1_000_000_000_000);
    assert_eq!(manifest.snapshots[0].duration_ms, Some(86_400_000));
}

#[tokio::test]
async fn test_manifest_atomic_write() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Create initial manifest
    let manifest = BackupManifest::new(
        "job-atomic".to_string(),
        "Atomic Test".to_string(),
        "/source".to_string(),
        "machine".to_string(),
    );
    write_manifest(dest_path, &manifest).await.unwrap();

    // Verify no temp files left over
    let meta_dir = get_meta_dir(dest_path);
    for entry in fs::read_dir(&meta_dir).unwrap() {
        let entry = entry.unwrap();
        let name = entry.file_name();
        let name_str = name.to_str().unwrap();
        assert!(
            !name_str.ends_with(".tmp"),
            "No temp files should remain: {}",
            name_str
        );
    }

    // Only manifest.json should exist
    let files: Vec<_> = fs::read_dir(&meta_dir).unwrap().collect();
    assert_eq!(files.len(), 1);
}

#[tokio::test]
async fn test_remove_snapshot_from_missing_manifest() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap();

    // Don't create manifest - try to remove snapshot directly
    let result = remove_snapshot_from_manifest(dest_path, "any-id").await;

    assert!(
        result.is_err(),
        "remove_snapshot_from_manifest should error when manifest doesn't exist"
    );

    let err = result.unwrap_err();
    match err {
        ManifestError::NotFound(_) => {} // Expected
        other => panic!("Expected NotFound, got: {:?}", other),
    }
}
