//! Integration tests for snapshot comparison (TIM-221)
//!
//! Tests comparing two snapshots to identify added, deleted, and modified files.

use crate::common::test_common::{generate, verify, TestBackupEnv};
use std::fs;

#[test]
fn test_compare_detects_added_files() {
    let env = TestBackupEnv::new().unwrap();

    // Create first snapshot
    let snap_a = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap_a).unwrap();
    generate::file(&snap_a.join("original.txt"), b"original").unwrap();

    // Create second snapshot with additional file
    let snap_b = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap_b).unwrap();
    generate::file(&snap_b.join("original.txt"), b"original").unwrap();
    generate::file(&snap_b.join("new_file.txt"), b"new").unwrap();

    // Compare
    let diff = verify::compare_directories(&snap_a, &snap_b).unwrap();

    assert_eq!(diff.only_in_b.len(), 1, "Should detect 1 added file");
    assert!(diff.only_in_b.contains(&"new_file.txt".to_string()));
}

#[test]
fn test_compare_detects_deleted_files() {
    let env = TestBackupEnv::new().unwrap();

    // Create first snapshot with two files
    let snap_a = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap_a).unwrap();
    generate::file(&snap_a.join("kept.txt"), b"kept").unwrap();
    generate::file(&snap_a.join("deleted.txt"), b"will be deleted").unwrap();

    // Create second snapshot with one file removed
    let snap_b = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap_b).unwrap();
    generate::file(&snap_b.join("kept.txt"), b"kept").unwrap();

    // Compare
    let diff = verify::compare_directories(&snap_a, &snap_b).unwrap();

    assert_eq!(diff.only_in_a.len(), 1, "Should detect 1 deleted file");
    assert!(diff.only_in_a.contains(&"deleted.txt".to_string()));
}

#[test]
fn test_compare_detects_modified_files() {
    let env = TestBackupEnv::new().unwrap();

    // Create first snapshot
    let snap_a = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap_a).unwrap();
    generate::file(&snap_a.join("file.txt"), b"original content").unwrap();

    // Create second snapshot with modified content
    let snap_b = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap_b).unwrap();
    generate::file(&snap_b.join("file.txt"), b"modified content!!!").unwrap();

    // Compare
    let diff = verify::compare_directories(&snap_a, &snap_b).unwrap();

    assert_eq!(diff.different.len(), 1, "Should detect 1 modified file");
    assert!(diff.different.contains(&"file.txt".to_string()));
}

#[test]
fn test_compare_handles_empty_snapshots() {
    let env = TestBackupEnv::new().unwrap();

    // Create empty first snapshot
    let snap_a = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap_a).unwrap();

    // Create second snapshot with files
    let snap_b = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap_b).unwrap();
    generate::file(&snap_b.join("new.txt"), b"new").unwrap();

    // Compare
    let diff = verify::compare_directories(&snap_a, &snap_b).unwrap();

    assert_eq!(diff.only_in_b.len(), 1, "Should detect 1 added file");
    assert!(diff.only_in_a.is_empty(), "Should have no deletions");
    assert!(diff.different.is_empty(), "Should have no modifications");
}

#[test]
fn test_compare_handles_identical_snapshots() {
    let env = TestBackupEnv::new().unwrap();

    // Create identical snapshots
    let snap_a = env.snapshot_path("2024-01-01_120000");
    let snap_b = env.snapshot_path("2024-01-02_120000");

    generate::simple_backup_structure(&snap_a).unwrap();
    generate::simple_backup_structure(&snap_b).unwrap();

    // Compare
    let diff = verify::compare_directories(&snap_a, &snap_b).unwrap();

    assert!(
        diff.is_identical(),
        "Identical snapshots should show no differences"
    );
    assert!(diff.only_in_a.is_empty());
    assert!(diff.only_in_b.is_empty());
    assert!(diff.different.is_empty());
}

#[test]
fn test_compare_complex_changes() {
    let env = TestBackupEnv::new().unwrap();

    // Create first snapshot
    let snap_a = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap_a).unwrap();
    generate::file(&snap_a.join("unchanged.txt"), b"same").unwrap();
    generate::file(&snap_a.join("modified.txt"), b"old version").unwrap();
    generate::file(&snap_a.join("deleted.txt"), b"will be gone").unwrap();

    // Create second snapshot with mixed changes
    let snap_b = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap_b).unwrap();
    generate::file(&snap_b.join("unchanged.txt"), b"same").unwrap();
    generate::file(
        &snap_b.join("modified.txt"),
        b"new version with more content",
    )
    .unwrap();
    generate::file(&snap_b.join("added.txt"), b"brand new").unwrap();

    // Compare
    let diff = verify::compare_directories(&snap_a, &snap_b).unwrap();

    assert!(!diff.is_identical(), "Snapshots should differ");
    assert_eq!(diff.only_in_a.len(), 1, "Should have 1 deleted");
    assert_eq!(diff.only_in_b.len(), 1, "Should have 1 added");
    assert_eq!(diff.different.len(), 1, "Should have 1 modified");
    assert_eq!(diff.identical.len(), 1, "Should have 1 unchanged");
}

#[test]
fn test_compare_nested_directory_changes() {
    let env = TestBackupEnv::new().unwrap();

    // Create first snapshot with nested structure
    let snap_a = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(snap_a.join("dir_a")).unwrap();
    fs::create_dir_all(snap_a.join("dir_b")).unwrap();
    generate::file(&snap_a.join("dir_a/file.txt"), b"a").unwrap();
    generate::file(&snap_a.join("dir_b/file.txt"), b"b").unwrap();

    // Create second snapshot with new nested file
    let snap_b = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(snap_b.join("dir_a")).unwrap();
    fs::create_dir_all(snap_b.join("dir_b")).unwrap();
    fs::create_dir_all(snap_b.join("dir_c")).unwrap();
    generate::file(&snap_b.join("dir_a/file.txt"), b"a").unwrap();
    generate::file(&snap_b.join("dir_b/file.txt"), b"b").unwrap();
    generate::file(&snap_b.join("dir_c/new.txt"), b"c").unwrap();

    // Compare
    let diff = verify::compare_directories(&snap_a, &snap_b).unwrap();

    assert!(diff.only_in_b.iter().any(|f| f.contains("dir_c")));
}

#[test]
fn test_compare_unicode_filenames() {
    let env = TestBackupEnv::new().unwrap();

    // Create first snapshot
    let snap_a = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap_a).unwrap();
    generate::file(&snap_a.join("中文.txt"), b"chinese").unwrap();
    generate::file(&snap_a.join("émoji.txt"), b"emoji").unwrap();

    // Create second snapshot with modified unicode file
    let snap_b = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap_b).unwrap();
    generate::file(&snap_b.join("中文.txt"), b"chinese modified").unwrap();
    generate::file(&snap_b.join("émoji.txt"), b"emoji").unwrap();
    generate::file(&snap_b.join("日本語.txt"), b"japanese").unwrap();

    // Compare
    let diff = verify::compare_directories(&snap_a, &snap_b).unwrap();

    assert!(diff.different.iter().any(|f| f.contains("中文")));
    assert!(diff.only_in_b.iter().any(|f| f.contains("日本語")));
}

#[test]
fn test_compare_size_delta_calculation() {
    let env = TestBackupEnv::new().unwrap();

    // Create first snapshot with 100 bytes
    let snap_a = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap_a).unwrap();
    generate::file(&snap_a.join("file.txt"), &[0u8; 100]).unwrap();

    // Create second snapshot with 150 bytes
    let snap_b = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap_b).unwrap();
    generate::file(&snap_b.join("file.txt"), &[0u8; 150]).unwrap();

    // Get sizes
    let size_a = verify::total_size(&snap_a).unwrap();
    let size_b = verify::total_size(&snap_b).unwrap();

    assert_eq!(size_a, 100);
    assert_eq!(size_b, 150);
    assert_eq!(
        size_b as i64 - size_a as i64,
        50,
        "Delta should be +50 bytes"
    );
}

#[test]
fn test_compare_many_files() {
    let env = TestBackupEnv::new().unwrap();

    // Create first snapshot with 50 files
    let snap_a = env.snapshot_path("2024-01-01_120000");
    generate::random_files(&snap_a, 50, 100).unwrap();

    // Create second snapshot - copy all and modify some
    let snap_b = env.snapshot_path("2024-01-02_120000");
    crate::common::test_common::copy_dir_recursive(&snap_a, &snap_b).unwrap();

    // Modify a few files
    generate::file(&snap_b.join("file_0010.dat"), b"modified").unwrap();
    generate::file(&snap_b.join("file_0020.dat"), b"modified").unwrap();

    // Add new files
    generate::file(&snap_b.join("new_file_a.dat"), b"new a").unwrap();
    generate::file(&snap_b.join("new_file_b.dat"), b"new b").unwrap();

    // Compare
    let diff = verify::compare_directories(&snap_a, &snap_b).unwrap();

    assert_eq!(diff.only_in_b.len(), 2, "Should have 2 added files");
    // Modified count depends on whether content hash differs
    assert!(diff.diff_count() > 0, "Should have some differences");
}

#[test]
fn test_compare_empty_vs_populated() {
    let env = TestBackupEnv::new().unwrap();

    // Create empty first snapshot
    let snap_a = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap_a).unwrap();

    // Create populated second snapshot
    let snap_b = env.snapshot_path("2024-01-02_120000");
    generate::simple_backup_structure(&snap_b).unwrap();

    // Compare empty -> populated
    let diff = verify::compare_directories(&snap_a, &snap_b).unwrap();
    assert!(diff.only_in_a.is_empty());
    assert!(diff.only_in_b.len() > 0);

    // Compare populated -> empty
    let diff_reverse = verify::compare_directories(&snap_b, &snap_a).unwrap();
    assert!(diff_reverse.only_in_a.len() > 0);
    assert!(diff_reverse.only_in_b.is_empty());
}

#[test]
fn test_compare_respects_directory_structure() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot A with file in root
    let snap_a = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap_a).unwrap();
    generate::file(&snap_a.join("file.txt"), b"content").unwrap();

    // Create snapshot B with same filename but in subdirectory
    let snap_b = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(snap_b.join("subdir")).unwrap();
    generate::file(&snap_b.join("subdir/file.txt"), b"content").unwrap();

    // Compare - files should be different (different paths)
    let diff = verify::compare_directories(&snap_a, &snap_b).unwrap();

    // file.txt in A is deleted, subdir/file.txt in B is added
    assert!(!diff.is_identical(), "Different paths should not match");
}
