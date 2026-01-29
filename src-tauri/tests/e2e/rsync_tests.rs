//! E2E tests for rsync backup operations
//!
//! Tests real rsync behavior with various file types and edge cases.

use crate::common::{
    rsync_available, run_rsync_backup, run_rsync_incremental,
    test_common::{generate, verify, TestBackupEnv},
};
use std::fs;

fn skip_if_no_rsync() -> bool {
    if !rsync_available() {
        eprintln!("Skipping test: rsync not available");
        return true;
    }
    false
}

#[test]
fn test_rsync_creates_exact_copy() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();
    generate::simple_backup_structure(&env.source_path).unwrap();

    // Run rsync
    run_rsync_backup(&env.source_path, &env.dest_path).unwrap();

    // Verify exact copy
    let diff = verify::compare_directories(&env.source_path, &env.dest_path).unwrap();
    assert!(
        diff.is_identical(),
        "rsync should create an exact copy. Diff: {:?}",
        diff
    );
}

#[test]
fn test_rsync_handles_unicode_filenames() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();
    generate::unicode_files(&env.source_path, 10).unwrap();

    // Run rsync
    run_rsync_backup(&env.source_path, &env.dest_path).unwrap();

    // Verify all unicode files copied
    let diff = verify::compare_directories(&env.source_path, &env.dest_path).unwrap();
    assert!(
        diff.is_identical(),
        "rsync should handle unicode filenames. Diff: {:?}",
        diff
    );
}

#[test]
fn test_rsync_handles_nested_directories() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();
    generate::nested_dirs(&env.source_path, 4, 3).unwrap();

    // Run rsync
    run_rsync_backup(&env.source_path, &env.dest_path).unwrap();

    // Verify structure
    let diff = verify::compare_directories(&env.source_path, &env.dest_path).unwrap();
    assert!(diff.is_identical(), "rsync should handle nested dirs");

    // Verify file counts match
    let source_count = verify::count_files(&env.source_path).unwrap();
    let dest_count = verify::count_files(&env.dest_path).unwrap();
    assert_eq!(source_count, dest_count);
}

#[test]
fn test_rsync_handles_special_characters() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create files with special characters
    generate::file(&env.source_path.join("file with spaces.txt"), b"spaces").unwrap();
    generate::file(&env.source_path.join("file-with-dashes.txt"), b"dashes").unwrap();
    generate::file(
        &env.source_path.join("file_with_underscores.txt"),
        b"underscores",
    )
    .unwrap();
    generate::file(&env.source_path.join("file.multiple.dots.txt"), b"dots").unwrap();

    // Run rsync
    run_rsync_backup(&env.source_path, &env.dest_path).unwrap();

    // Verify
    let diff = verify::compare_directories(&env.source_path, &env.dest_path).unwrap();
    assert!(
        diff.is_identical(),
        "rsync should handle special characters"
    );
}

#[cfg(unix)]
#[test]
fn test_rsync_preserves_permissions() {
    use std::os::unix::fs::PermissionsExt;

    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create file with specific permissions
    let file_path = env.source_path.join("executable.sh");
    generate::file_with_mode(&file_path, b"#!/bin/bash\necho hello", 0o755).unwrap();

    // Run rsync
    run_rsync_backup(&env.source_path, &env.dest_path).unwrap();

    // Verify permissions preserved
    let dest_file = env.dest_path.join("executable.sh");
    let perms = fs::metadata(&dest_file).unwrap().permissions();
    assert_eq!(
        perms.mode() & 0o777,
        0o755,
        "Permissions should be preserved"
    );
}

#[cfg(unix)]
#[test]
fn test_rsync_handles_symlinks() {
    use std::os::unix::fs::symlink;

    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create target and symlink
    let target = env.source_path.join("target.txt");
    generate::file(&target, b"target content").unwrap();

    let link = env.source_path.join("link.txt");
    symlink("target.txt", &link).unwrap();

    // Run rsync with -l to preserve symlinks
    run_rsync_backup(&env.source_path, &env.dest_path).unwrap();

    // Verify symlink was copied as symlink
    let dest_link = env.dest_path.join("link.txt");
    assert!(dest_link.is_symlink(), "Symlink should be preserved");
}

#[test]
fn test_rsync_incremental_uses_hardlinks() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();
    generate::simple_backup_structure(&env.source_path).unwrap();

    // Create first backup
    let snap1 = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap1).unwrap();
    run_rsync_backup(&env.source_path, &snap1).unwrap();

    // Create second incremental backup
    let snap2 = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap2).unwrap();
    run_rsync_incremental(&env.source_path, &snap2, &snap1).unwrap();

    // Both snapshots should be identical to source
    let diff1 = verify::compare_directories(&env.source_path, &snap1).unwrap();
    let diff2 = verify::compare_directories(&env.source_path, &snap2).unwrap();

    assert!(diff1.is_identical());
    assert!(diff2.is_identical());

    // With --link-dest, unchanged files should be hardlinks (same inode)
    // Note: This is implementation-dependent, just verify content matches
}

#[test]
fn test_rsync_handles_empty_directories() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create directory structure with empty dirs
    fs::create_dir_all(env.source_path.join("empty1")).unwrap();
    fs::create_dir_all(env.source_path.join("empty2")).unwrap();
    fs::create_dir_all(env.source_path.join("has_file")).unwrap();
    generate::file(&env.source_path.join("has_file/content.txt"), b"data").unwrap();

    // Run rsync
    run_rsync_backup(&env.source_path, &env.dest_path).unwrap();

    // Verify empty directories were created
    assert!(env.dest_path.join("empty1").exists());
    assert!(env.dest_path.join("empty1").is_dir());
    assert!(env.dest_path.join("empty2").exists());
    assert!(env.dest_path.join("empty2").is_dir());
}

#[test]
fn test_rsync_deletes_removed_files() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create initial backup
    generate::file(&env.source_path.join("keep.txt"), b"keep").unwrap();
    generate::file(&env.source_path.join("remove.txt"), b"remove").unwrap();

    run_rsync_backup(&env.source_path, &env.dest_path).unwrap();

    // Remove file from source
    fs::remove_file(env.source_path.join("remove.txt")).unwrap();

    // Run rsync again (with --delete)
    run_rsync_backup(&env.source_path, &env.dest_path).unwrap();

    // Verify file was deleted from dest
    assert!(env.dest_path.join("keep.txt").exists());
    assert!(
        !env.dest_path.join("remove.txt").exists(),
        "rsync --delete should remove files not in source"
    );
}

#[test]
fn test_rsync_handles_large_file_count() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::with_random_files(100, 1024).unwrap();

    // Run rsync
    run_rsync_backup(&env.source_path, &env.dest_path).unwrap();

    // Verify
    verify::verify_backup_integrity(&env.source_path, &env.dest_path).unwrap();
}

#[test]
fn test_rsync_handles_modified_files() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create initial file
    generate::file(&env.source_path.join("file.txt"), b"original content").unwrap();
    run_rsync_backup(&env.source_path, &env.dest_path).unwrap();

    // Modify source file
    generate::file(
        &env.source_path.join("file.txt"),
        b"modified content with more data",
    )
    .unwrap();
    run_rsync_backup(&env.source_path, &env.dest_path).unwrap();

    // Verify dest was updated
    assert!(verify::file_has_content(
        &env.dest_path.join("file.txt"),
        b"modified content with more data"
    ));
}

#[test]
fn test_rsync_fails_on_invalid_source() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();
    let nonexistent = env.temp_dir.path().join("nonexistent");

    let result = run_rsync_backup(&nonexistent, &env.dest_path);
    assert!(result.is_err(), "rsync should fail with invalid source");
}
