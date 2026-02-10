//! E2E tests for restore operations
//!
//! Tests restoring files and directories from backups.

use crate::common::{
    rsync_available, rsync_restore_dir, rsync_restore_file, run_rsync_backup,
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
fn test_restore_single_file_exact() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create source file
    let original_content = b"This is the original file content for testing.";
    generate::file(&env.source_path.join("important.txt"), original_content).unwrap();

    // Backup to snapshot
    let snapshot = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot).unwrap();
    run_rsync_backup(&env.source_path, &snapshot).unwrap();

    // Delete original
    fs::remove_file(env.source_path.join("important.txt")).unwrap();
    assert!(!env.source_path.join("important.txt").exists());

    // Restore from snapshot
    let restore_target = env.source_path.join("important.txt");
    rsync_restore_file(&snapshot.join("important.txt"), &restore_target).unwrap();

    // Verify restoration is byte-identical
    assert!(verify::file_has_content(&restore_target, original_content));
}

#[test]
fn test_restore_directory_recursive() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create nested structure
    generate::nested_dirs(&env.source_path, 3, 2).unwrap();

    // Backup
    let snapshot = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot).unwrap();
    run_rsync_backup(&env.source_path, &snapshot).unwrap();

    // Delete source entirely
    fs::remove_dir_all(&env.source_path).unwrap();
    fs::create_dir_all(&env.source_path).unwrap();

    // Restore entire directory
    rsync_restore_dir(&snapshot, &env.source_path).unwrap();

    // Verify restoration
    verify::verify_backup_integrity(&snapshot, &env.source_path).unwrap();
}

#[test]
fn test_restore_to_different_location() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create source files
    generate::simple_backup_structure(&env.source_path).unwrap();

    // Backup
    let snapshot = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot).unwrap();
    run_rsync_backup(&env.source_path, &snapshot).unwrap();

    // Restore to completely different location
    let alternate_restore = env.temp_dir.path().join("alternate_restore");
    fs::create_dir_all(&alternate_restore).unwrap();

    rsync_restore_dir(&snapshot, &alternate_restore).unwrap();

    // Verify the alternate location has the files
    let diff = verify::compare_directories(&snapshot, &alternate_restore).unwrap();
    assert!(diff.is_identical());
}

#[test]
fn test_restore_handles_existing_files() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create original
    let original_content = b"original version";
    generate::file(&env.source_path.join("file.txt"), original_content).unwrap();

    // Backup
    let snapshot = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot).unwrap();
    run_rsync_backup(&env.source_path, &snapshot).unwrap();

    // Modify the source file
    generate::file(&env.source_path.join("file.txt"), b"modified version").unwrap();

    // Restore (should overwrite)
    rsync_restore_file(
        &snapshot.join("file.txt"),
        &env.source_path.join("file.txt"),
    )
    .unwrap();

    // Verify original content restored
    assert!(verify::file_has_content(
        &env.source_path.join("file.txt"),
        original_content
    ));
}

#[cfg(unix)]
#[test]
fn test_restore_preserves_timestamps() {
    use std::time::SystemTime;

    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create file
    generate::file(&env.source_path.join("file.txt"), b"content").unwrap();

    // Backup
    let snapshot = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot).unwrap();
    run_rsync_backup(&env.source_path, &snapshot).unwrap();

    // Get snapshot file mtime
    let snapshot_mtime = fs::metadata(snapshot.join("file.txt"))
        .unwrap()
        .modified()
        .unwrap();

    // Wait a moment and restore
    std::thread::sleep(std::time::Duration::from_millis(100));

    // Delete and restore
    fs::remove_file(env.source_path.join("file.txt")).unwrap();
    rsync_restore_file(
        &snapshot.join("file.txt"),
        &env.source_path.join("file.txt"),
    )
    .unwrap();

    // Verify mtime preserved (rsync -a preserves timestamps)
    let restored_mtime = fs::metadata(env.source_path.join("file.txt"))
        .unwrap()
        .modified()
        .unwrap();

    // Allow small difference due to filesystem precision
    let diff = snapshot_mtime
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .abs_diff(
            restored_mtime
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        );
    assert!(diff <= 1, "Timestamps should be preserved within 1 second");
}

#[test]
fn test_restore_from_any_snapshot() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create first version
    generate::file(&env.source_path.join("file.txt"), b"version 1").unwrap();
    let snap1 = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap1).unwrap();
    run_rsync_backup(&env.source_path, &snap1).unwrap();

    // Create second version
    generate::file(&env.source_path.join("file.txt"), b"version 2").unwrap();
    let snap2 = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap2).unwrap();
    run_rsync_backup(&env.source_path, &snap2).unwrap();

    // Create third version
    generate::file(&env.source_path.join("file.txt"), b"version 3").unwrap();
    let snap3 = env.snapshot_path("2024-01-03_120000");
    fs::create_dir_all(&snap3).unwrap();
    run_rsync_backup(&env.source_path, &snap3).unwrap();

    // Restore from middle snapshot (snap2)
    rsync_restore_file(&snap2.join("file.txt"), &env.source_path.join("file.txt")).unwrap();
    assert!(verify::file_has_content(
        &env.source_path.join("file.txt"),
        b"version 2"
    ));

    // Restore from oldest snapshot (snap1)
    rsync_restore_file(&snap1.join("file.txt"), &env.source_path.join("file.txt")).unwrap();
    assert!(verify::file_has_content(
        &env.source_path.join("file.txt"),
        b"version 1"
    ));

    // Restore from newest snapshot (snap3)
    rsync_restore_file(&snap3.join("file.txt"), &env.source_path.join("file.txt")).unwrap();
    assert!(verify::file_has_content(
        &env.source_path.join("file.txt"),
        b"version 3"
    ));
}

#[test]
fn test_partial_restore_works() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create full backup
    generate::simple_backup_structure(&env.source_path).unwrap();
    let snapshot = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot).unwrap();
    run_rsync_backup(&env.source_path, &snapshot).unwrap();

    // Delete everything
    fs::remove_dir_all(&env.source_path).unwrap();
    fs::create_dir_all(&env.source_path).unwrap();

    // Restore only the documents directory
    let docs_snapshot = snapshot.join("documents");
    let docs_restore = env.source_path.join("documents");
    rsync_restore_dir(&docs_snapshot, &docs_restore).unwrap();

    // Verify only documents were restored
    assert!(env.source_path.join("documents/readme.txt").exists());
    assert!(env.source_path.join("documents/notes.md").exists());
    assert!(!env.source_path.join("code").exists());
    assert!(!env.source_path.join("config.json").exists());
}

#[test]
fn test_restore_unicode_files() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create unicode files
    generate::unicode_files(&env.source_path, 5).unwrap();

    // Backup
    let snapshot = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot).unwrap();
    run_rsync_backup(&env.source_path, &snapshot).unwrap();

    // Delete source
    fs::remove_dir_all(&env.source_path).unwrap();
    fs::create_dir_all(&env.source_path).unwrap();

    // Restore
    rsync_restore_dir(&snapshot, &env.source_path).unwrap();

    // Verify
    let diff = verify::compare_directories(&snapshot, &env.source_path).unwrap();
    assert!(
        diff.is_identical(),
        "Unicode files should restore correctly"
    );
}

#[test]
fn test_restore_empty_directory() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create structure with empty dir
    fs::create_dir_all(env.source_path.join("empty_dir")).unwrap();
    generate::file(&env.source_path.join("file.txt"), b"content").unwrap();

    // Backup
    let snapshot = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot).unwrap();
    run_rsync_backup(&env.source_path, &snapshot).unwrap();

    // Delete source
    fs::remove_dir_all(&env.source_path).unwrap();
    fs::create_dir_all(&env.source_path).unwrap();

    // Restore
    rsync_restore_dir(&snapshot, &env.source_path).unwrap();

    // Verify empty directory exists
    assert!(env.source_path.join("empty_dir").exists());
    assert!(env.source_path.join("empty_dir").is_dir());
}
