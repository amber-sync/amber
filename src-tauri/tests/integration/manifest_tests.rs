//! Integration tests for manifest service
//!
//! Tests manifest creation, validation, and consistency checking.

use crate::common::test_common::{generate, verify, TestBackupEnv};
use std::fs;

#[test]
fn test_manifest_json_structure() {
    let env = TestBackupEnv::new().unwrap();
    let meta = env.meta_path();
    fs::create_dir_all(&meta).unwrap();

    let manifest_path = meta.join("manifest.json");
    let manifest_content = r#"{
        "job_id": "test-job-123",
        "source_path": "/Users/test/Documents",
        "dest_path": "/Volumes/Backup/amber",
        "created_at": "2024-01-01T12:00:00Z",
        "snapshots": [
            {
                "name": "2024-01-01_120000",
                "timestamp": 1704106800,
                "size_bytes": 1024000,
                "file_count": 150
            }
        ]
    }"#;

    generate::file(&manifest_path, manifest_content.as_bytes()).unwrap();

    // Verify JSON is parseable
    let content = fs::read_to_string(&manifest_path).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();

    assert_eq!(parsed["job_id"], "test-job-123");
    assert_eq!(parsed["snapshots"].as_array().unwrap().len(), 1);
}

#[test]
fn test_manifest_validates_on_load() {
    let env = TestBackupEnv::new().unwrap();
    let meta = env.meta_path();
    fs::create_dir_all(&meta).unwrap();

    // Write invalid JSON
    let manifest_path = meta.join("manifest.json");
    generate::file(&manifest_path, b"{ invalid json }").unwrap();

    // Attempt to parse should fail
    let content = fs::read_to_string(&manifest_path).unwrap();
    let result: Result<serde_json::Value, _> = serde_json::from_str(&content);

    assert!(result.is_err(), "Invalid JSON should fail to parse");
}

#[test]
fn test_manifest_empty_snapshots_array() {
    let env = TestBackupEnv::new().unwrap();
    let meta = env.meta_path();
    fs::create_dir_all(&meta).unwrap();

    let manifest_path = meta.join("manifest.json");
    let manifest_content = r#"{
        "job_id": "test-job",
        "source_path": "/test/source",
        "dest_path": "/test/dest",
        "snapshots": []
    }"#;

    generate::file(&manifest_path, manifest_content.as_bytes()).unwrap();

    let content = fs::read_to_string(&manifest_path).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();

    assert!(parsed["snapshots"].as_array().unwrap().is_empty());
}

#[test]
fn test_manifest_consistency_with_snapshots() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshots on filesystem
    let snap1 = env.snapshot_path("2024-01-01_120000");
    let snap2 = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap1).unwrap();
    fs::create_dir_all(&snap2).unwrap();

    // Create manifest with matching snapshots
    let meta = env.meta_path();
    fs::create_dir_all(&meta).unwrap();

    let manifest_path = meta.join("manifest.json");
    let manifest_content = r#"{
        "job_id": "test-job",
        "source_path": "/test/source",
        "dest_path": "/test/dest",
        "snapshots": [
            {"name": "2024-01-01_120000", "timestamp": 1704106800},
            {"name": "2024-01-02_120000", "timestamp": 1704193200}
        ]
    }"#;

    generate::file(&manifest_path, manifest_content.as_bytes()).unwrap();

    // Verify consistency
    let result = verify::verify_manifest_consistency(&manifest_path, &env.dest_path);
    assert!(
        result.is_ok(),
        "Manifest should be consistent with filesystem"
    );
}

#[test]
fn test_manifest_inconsistency_missing_snapshot() {
    let env = TestBackupEnv::new().unwrap();

    // Create only one snapshot on filesystem
    let snap1 = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap1).unwrap();

    // Create manifest claiming two snapshots
    let meta = env.meta_path();
    fs::create_dir_all(&meta).unwrap();

    let manifest_path = meta.join("manifest.json");
    let manifest_content = r#"{
        "job_id": "test-job",
        "source_path": "/test/source",
        "dest_path": "/test/dest",
        "snapshots": [
            {"name": "2024-01-01_120000", "timestamp": 1704106800},
            {"name": "2024-01-02_120000", "timestamp": 1704193200}
        ]
    }"#;

    generate::file(&manifest_path, manifest_content.as_bytes()).unwrap();

    // Verify inconsistency is detected
    let result = verify::verify_manifest_consistency(&manifest_path, &env.dest_path);
    assert!(
        result.is_err(),
        "Missing snapshot should cause inconsistency"
    );
}

#[test]
fn test_manifest_inconsistency_extra_snapshot() {
    let env = TestBackupEnv::new().unwrap();

    // Create two snapshots on filesystem
    let snap1 = env.snapshot_path("2024-01-01_120000");
    let snap2 = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap1).unwrap();
    fs::create_dir_all(&snap2).unwrap();

    // Create manifest with only one snapshot
    let meta = env.meta_path();
    fs::create_dir_all(&meta).unwrap();

    let manifest_path = meta.join("manifest.json");
    let manifest_content = r#"{
        "job_id": "test-job",
        "source_path": "/test/source",
        "dest_path": "/test/dest",
        "snapshots": [
            {"name": "2024-01-01_120000", "timestamp": 1704106800}
        ]
    }"#;

    generate::file(&manifest_path, manifest_content.as_bytes()).unwrap();

    // Verify inconsistency is detected
    let result = verify::verify_manifest_consistency(&manifest_path, &env.dest_path);
    assert!(result.is_err(), "Extra snapshot should cause inconsistency");
}

#[test]
fn test_manifest_with_multiple_snapshots() {
    let env = TestBackupEnv::new().unwrap();
    let meta = env.meta_path();
    fs::create_dir_all(&meta).unwrap();

    let manifest_path = meta.join("manifest.json");
    let manifest_content = r#"{
        "job_id": "test-job",
        "source_path": "/test/source",
        "dest_path": "/test/dest",
        "snapshots": [
            {"name": "2024-01-01_120000", "timestamp": 1704106800, "size_bytes": 1000},
            {"name": "2024-01-02_120000", "timestamp": 1704193200, "size_bytes": 2000},
            {"name": "2024-01-03_120000", "timestamp": 1704279600, "size_bytes": 3000},
            {"name": "2024-01-04_120000", "timestamp": 1704366000, "size_bytes": 4000},
            {"name": "2024-01-05_120000", "timestamp": 1704452400, "size_bytes": 5000}
        ]
    }"#;

    generate::file(&manifest_path, manifest_content.as_bytes()).unwrap();

    let content = fs::read_to_string(&manifest_path).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();

    assert_eq!(parsed["snapshots"].as_array().unwrap().len(), 5);

    // Verify snapshots are in order
    let snapshots = parsed["snapshots"].as_array().unwrap();
    for i in 1..snapshots.len() {
        let prev_ts = snapshots[i - 1]["timestamp"].as_i64().unwrap();
        let curr_ts = snapshots[i]["timestamp"].as_i64().unwrap();
        assert!(
            curr_ts > prev_ts,
            "Snapshots should be chronologically ordered"
        );
    }
}

#[test]
fn test_manifest_backup_file_exists() {
    let env = TestBackupEnv::new().unwrap();
    let meta = env.meta_path();
    fs::create_dir_all(&meta).unwrap();

    // Create main manifest
    let manifest_path = meta.join("manifest.json");
    let manifest_content = r#"{"job_id": "test"}"#;
    generate::file(&manifest_path, manifest_content.as_bytes()).unwrap();

    // Simulate creating a backup
    let backup_path = meta.join("manifest.json.bak");
    fs::copy(&manifest_path, &backup_path).unwrap();

    assert!(backup_path.exists(), "Backup manifest should exist");
    assert!(verify::file_has_content(
        &backup_path,
        manifest_content.as_bytes()
    ));
}
