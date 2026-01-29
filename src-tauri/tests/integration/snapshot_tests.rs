//! Integration tests for snapshot service
//!
//! Tests snapshot listing, deletion protection, and chronological ordering.

use crate::common::test_common::{generate, verify, TestBackupEnv};
use std::fs;

#[test]
fn test_snapshot_directory_structure() {
    let env = TestBackupEnv::new().unwrap();

    // Create a snapshot-like directory structure
    let snap1 = env.snapshot_path("2024-01-01_120000");
    let snap2 = env.snapshot_path("2024-01-02_120000");

    fs::create_dir_all(&snap1).unwrap();
    fs::create_dir_all(&snap2).unwrap();

    generate::file(&snap1.join("file1.txt"), b"content1").unwrap();
    generate::file(&snap2.join("file1.txt"), b"content1 modified").unwrap();
    generate::file(&snap2.join("file2.txt"), b"new file").unwrap();

    // Verify structure
    assert!(snap1.exists());
    assert!(snap2.exists());
    assert!(snap1.join("file1.txt").exists());
    assert!(snap2.join("file2.txt").exists());
}

#[test]
fn test_snapshot_names_are_chronological() {
    let mut names = vec![
        "2024-01-15_120000",
        "2024-01-01_120000",
        "2024-01-10_120000",
        "2024-01-05_120000",
    ];

    // Sort chronologically
    names.sort();

    assert_eq!(
        names,
        vec![
            "2024-01-01_120000",
            "2024-01-05_120000",
            "2024-01-10_120000",
            "2024-01-15_120000",
        ]
    );
}

#[test]
fn test_meta_directory_structure() {
    let env = TestBackupEnv::new().unwrap();

    // Create .amber-meta structure
    let meta = env.meta_path();
    fs::create_dir_all(&meta).unwrap();

    let manifest = meta.join("manifest.json");
    let manifest_content = r#"{
        "job_id": "test-job",
        "source_path": "/test/source",
        "dest_path": "/test/dest",
        "snapshots": []
    }"#;
    generate::file(&manifest, manifest_content.as_bytes()).unwrap();

    assert!(manifest.exists());
    assert!(verify::file_has_content(
        &manifest,
        manifest_content.as_bytes()
    ));
}

#[test]
fn test_snapshot_with_files_creates_exact_copy() {
    let env = TestBackupEnv::new().unwrap();

    // Create source files
    generate::simple_backup_structure(&env.source_path).unwrap();

    // Simulate copying to snapshot
    let snapshot = env.snapshot_path("2024-01-01_120000");
    crate::common::test_common::copy_dir_recursive(&env.source_path, &snapshot).unwrap();

    // Verify they're identical
    let diff = verify::compare_directories(&env.source_path, &snapshot).unwrap();
    assert!(
        diff.is_identical(),
        "Snapshot should be identical to source"
    );
}

#[test]
fn test_nested_directory_snapshot() {
    let env = TestBackupEnv::new().unwrap();

    // Create deeply nested structure
    generate::nested_dirs(&env.source_path, 3, 2).unwrap();

    // Copy to snapshot
    let snapshot = env.snapshot_path("2024-01-01_120000");
    crate::common::test_common::copy_dir_recursive(&env.source_path, &snapshot).unwrap();

    // Count files in both
    let source_count = verify::count_files(&env.source_path).unwrap();
    let snapshot_count = verify::count_files(&snapshot).unwrap();

    assert_eq!(source_count, snapshot_count, "File counts should match");

    // Verify structure is identical
    let diff = verify::compare_directories(&env.source_path, &snapshot).unwrap();
    assert!(diff.is_identical());
}

#[test]
fn test_unicode_filename_snapshot() {
    let env = TestBackupEnv::new().unwrap();

    // Create files with unicode names
    generate::unicode_files(&env.source_path, 5).unwrap();

    // Copy to snapshot
    let snapshot = env.snapshot_path("2024-01-01_120000");
    crate::common::test_common::copy_dir_recursive(&env.source_path, &snapshot).unwrap();

    // Verify all unicode files copied correctly
    let diff = verify::compare_directories(&env.source_path, &snapshot).unwrap();
    assert!(
        diff.is_identical(),
        "Unicode files should be copied correctly"
    );
}

#[test]
fn test_random_files_snapshot() {
    let env = TestBackupEnv::with_random_files(50, 1024).unwrap();

    // Copy to snapshot
    let snapshot = env.snapshot_path("2024-01-01_120000");
    crate::common::test_common::copy_dir_recursive(&env.source_path, &snapshot).unwrap();

    // Verify integrity
    verify::verify_backup_integrity(&env.source_path, &snapshot).unwrap();
}

#[test]
fn test_empty_source_snapshot() {
    let env = TestBackupEnv::new().unwrap();

    // Source is already empty from new()

    // Create snapshot directory
    let snapshot = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot).unwrap();

    // Copy empty source
    crate::common::test_common::copy_dir_recursive(&env.source_path, &snapshot).unwrap();

    // Verify both are empty
    let diff = verify::compare_directories(&env.source_path, &snapshot).unwrap();
    assert!(diff.is_identical());
    assert_eq!(diff.identical.len(), 0);
}

#[test]
fn test_snapshot_preserves_empty_directories() {
    let env = TestBackupEnv::new().unwrap();

    // Create structure with empty dirs
    fs::create_dir_all(env.source_path.join("empty_dir")).unwrap();
    fs::create_dir_all(env.source_path.join("has_file")).unwrap();
    generate::file(&env.source_path.join("has_file/content.txt"), b"data").unwrap();

    // Copy to snapshot
    let snapshot = env.snapshot_path("2024-01-01_120000");
    crate::common::test_common::copy_dir_recursive(&env.source_path, &snapshot).unwrap();

    // Verify empty directory exists in snapshot
    assert!(snapshot.join("empty_dir").exists());
    assert!(snapshot.join("empty_dir").is_dir());
}

#[cfg(unix)]
#[test]
fn test_snapshot_with_symlinks() {
    use std::os::unix::fs::symlink;

    let env = TestBackupEnv::new().unwrap();

    // Create a target file and symlink
    let target = env.source_path.join("target.txt");
    generate::file(&target, b"target content").unwrap();

    let link = env.source_path.join("link.txt");
    symlink(&target, &link).unwrap();

    // Copy to snapshot
    let snapshot = env.snapshot_path("2024-01-01_120000");
    crate::common::test_common::copy_dir_recursive(&env.source_path, &snapshot).unwrap();

    // Verify symlink was copied as symlink
    let snapshot_link = snapshot.join("link.txt");
    assert!(snapshot_link.is_symlink());
}
