//! E2E tests for Time Machine-style workflows
//!
//! Tests complete backup/modify/backup/compare/restore cycles.

use crate::common::{
    rsync_available, rsync_restore_file, run_rsync_backup,
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
fn test_full_time_machine_workflow() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // 1. Create initial backup
    generate::file(&env.source_path.join("keep.txt"), b"this file stays").unwrap();
    generate::file(&env.source_path.join("modify.txt"), b"original content").unwrap();
    generate::file(&env.source_path.join("delete.txt"), b"will be deleted").unwrap();

    let snap1 = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap1).unwrap();
    run_rsync_backup(&env.source_path, &snap1).unwrap();

    // Verify first snapshot
    let diff1 = verify::compare_directories(&env.source_path, &snap1).unwrap();
    assert!(diff1.is_identical(), "First snapshot should match source");

    // 2. Modify source (add, delete, change files)
    generate::file(&env.source_path.join("new.txt"), b"new file").unwrap();
    fs::remove_file(env.source_path.join("delete.txt")).unwrap();
    generate::file(&env.source_path.join("modify.txt"), b"modified content!!!").unwrap();

    // 3. Create second backup
    let snap2 = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap2).unwrap();
    run_rsync_backup(&env.source_path, &snap2).unwrap();

    // 4. Verify compare shows correct diff
    let diff = verify::compare_directories(&snap1, &snap2).unwrap();

    assert!(
        diff.only_in_a.contains(&"delete.txt".to_string()),
        "delete.txt should be in snap1 only (deleted)"
    );
    assert!(
        diff.only_in_b.contains(&"new.txt".to_string()),
        "new.txt should be in snap2 only (added)"
    );
    assert!(
        diff.different.contains(&"modify.txt".to_string()),
        "modify.txt should be modified"
    );
    assert!(
        diff.identical.contains(&"keep.txt".to_string()),
        "keep.txt should be unchanged"
    );

    // 5. Restore deleted file from first snapshot
    rsync_restore_file(
        &snap1.join("delete.txt"),
        &env.source_path.join("delete.txt"),
    )
    .unwrap();

    // 6. Verify restored file is identical to original
    assert!(verify::file_has_content(
        &env.source_path.join("delete.txt"),
        b"will be deleted"
    ));

    // 7. Browse history - all snapshots accessible
    assert!(snap1.exists());
    assert!(snap2.exists());
    assert!(snap1.join("delete.txt").exists());
    assert!(snap2.join("new.txt").exists());
}

#[test]
fn test_multiple_snapshot_history() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create 5 snapshots with modifications each time
    let mut snapshots = Vec::new();

    for i in 1..=5 {
        // Modify source
        generate::file(
            &env.source_path.join("evolving.txt"),
            format!("version {}", i).as_bytes(),
        )
        .unwrap();
        generate::file(
            &env.source_path.join(format!("file_{}.txt", i)),
            format!("content {}", i).as_bytes(),
        )
        .unwrap();

        // Create snapshot
        let snap = env.snapshot_path(&format!("2024-01-0{}_120000", i));
        fs::create_dir_all(&snap).unwrap();
        run_rsync_backup(&env.source_path, &snap).unwrap();
        snapshots.push(snap);
    }

    // Verify we can access any point in history
    for (i, snap) in snapshots.iter().enumerate() {
        let i = i + 1;
        // evolving.txt should have version i
        assert!(verify::file_has_content(
            &snap.join("evolving.txt"),
            format!("version {}", i).as_bytes()
        ));

        // Should have files up to file_i.txt
        for j in 1..=i {
            assert!(snap.join(format!("file_{}.txt", j)).exists());
        }
    }
}

#[test]
fn test_restore_to_previous_state() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create initial state
    generate::file(&env.source_path.join("a.txt"), b"a").unwrap();
    generate::file(&env.source_path.join("b.txt"), b"b").unwrap();

    let snap1 = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap1).unwrap();
    run_rsync_backup(&env.source_path, &snap1).unwrap();

    // Make lots of changes
    fs::remove_file(env.source_path.join("a.txt")).unwrap();
    generate::file(&env.source_path.join("b.txt"), b"b modified").unwrap();
    generate::file(&env.source_path.join("c.txt"), b"c").unwrap();
    generate::file(&env.source_path.join("d.txt"), b"d").unwrap();

    let snap2 = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap2).unwrap();
    run_rsync_backup(&env.source_path, &snap2).unwrap();

    // Restore entire source from snap1 (go back in time)
    fs::remove_dir_all(&env.source_path).unwrap();
    fs::create_dir_all(&env.source_path).unwrap();
    crate::common::test_common::copy_dir_recursive(&snap1, &env.source_path).unwrap();

    // Verify we're back to snap1 state
    let diff = verify::compare_directories(&snap1, &env.source_path).unwrap();
    assert!(diff.is_identical(), "Should be back to snap1 state");

    assert!(env.source_path.join("a.txt").exists());
    assert!(verify::file_has_content(
        &env.source_path.join("b.txt"),
        b"b"
    ));
    assert!(!env.source_path.join("c.txt").exists());
    assert!(!env.source_path.join("d.txt").exists());
}

#[test]
fn test_compare_across_multiple_snapshots() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Snapshot 1: A, B
    generate::file(&env.source_path.join("a.txt"), b"a").unwrap();
    generate::file(&env.source_path.join("b.txt"), b"b").unwrap();
    let snap1 = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap1).unwrap();
    run_rsync_backup(&env.source_path, &snap1).unwrap();

    // Snapshot 2: A, B, C
    generate::file(&env.source_path.join("c.txt"), b"c").unwrap();
    let snap2 = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap2).unwrap();
    run_rsync_backup(&env.source_path, &snap2).unwrap();

    // Snapshot 3: B, C, D
    fs::remove_file(env.source_path.join("a.txt")).unwrap();
    generate::file(&env.source_path.join("d.txt"), b"d").unwrap();
    let snap3 = env.snapshot_path("2024-01-03_120000");
    fs::create_dir_all(&snap3).unwrap();
    run_rsync_backup(&env.source_path, &snap3).unwrap();

    // Compare snap1 to snap3 (skip snap2)
    let diff = verify::compare_directories(&snap1, &snap3).unwrap();

    // a.txt deleted, c.txt and d.txt added, b.txt unchanged
    assert!(diff.only_in_a.contains(&"a.txt".to_string()));
    assert!(diff.only_in_b.contains(&"c.txt".to_string()));
    assert!(diff.only_in_b.contains(&"d.txt".to_string()));
    assert!(diff.identical.contains(&"b.txt".to_string()));
}

#[test]
fn test_browse_file_history() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();
    let snapshots: Vec<_> = (1..=5)
        .map(|i| {
            generate::file(
                &env.source_path.join("file.txt"),
                format!("content at version {}", i).as_bytes(),
            )
            .unwrap();

            let snap = env.snapshot_path(&format!("2024-01-0{}_120000", i));
            fs::create_dir_all(&snap).unwrap();
            run_rsync_backup(&env.source_path, &snap).unwrap();
            snap
        })
        .collect();

    // Browse history of file.txt - should be able to see all versions
    for (i, snap) in snapshots.iter().enumerate() {
        let file_path = snap.join("file.txt");
        assert!(
            file_path.exists(),
            "File should exist in snapshot {}",
            i + 1
        );

        let content = fs::read_to_string(&file_path).unwrap();
        assert!(
            content.contains(&format!("version {}", i + 1)),
            "Snapshot {} should have version {}",
            i + 1,
            i + 1
        );
    }
}

#[test]
fn test_time_machine_with_unicode_files() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create unicode files
    generate::file(&env.source_path.join("中文.txt"), b"chinese").unwrap();
    generate::file(&env.source_path.join("émoji.txt"), b"emoji").unwrap();

    let snap1 = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap1).unwrap();
    run_rsync_backup(&env.source_path, &snap1).unwrap();

    // Modify unicode files
    generate::file(&env.source_path.join("中文.txt"), b"chinese modified").unwrap();
    generate::file(&env.source_path.join("日本語.txt"), b"japanese").unwrap();

    let snap2 = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap2).unwrap();
    run_rsync_backup(&env.source_path, &snap2).unwrap();

    // Compare should detect unicode file changes
    let diff = verify::compare_directories(&snap1, &snap2).unwrap();

    assert!(
        diff.different.iter().any(|f| f.contains("中文")),
        "Should detect modified Chinese file"
    );
    assert!(
        diff.only_in_b.iter().any(|f| f.contains("日本語")),
        "Should detect added Japanese file"
    );

    // Restore Chinese file from snap1
    rsync_restore_file(
        &snap1.join("中文.txt"),
        &env.source_path.join("中文_restored.txt"),
    )
    .unwrap();

    assert!(verify::file_has_content(
        &env.source_path.join("中文_restored.txt"),
        b"chinese"
    ));
}

#[test]
fn test_time_machine_with_nested_structures() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create complex nested structure
    generate::nested_dirs(&env.source_path, 3, 2).unwrap();

    let snap1 = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap1).unwrap();
    run_rsync_backup(&env.source_path, &snap1).unwrap();

    // Add more nesting
    generate::nested_dirs(&env.source_path.join("extra"), 2, 2).unwrap();

    let snap2 = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap2).unwrap();
    run_rsync_backup(&env.source_path, &snap2).unwrap();

    // Verify we can navigate the nested structure in both snapshots
    let snap1_count = verify::count_files(&snap1).unwrap();
    let snap2_count = verify::count_files(&snap2).unwrap();

    assert!(snap2_count > snap1_count, "snap2 should have more files");

    // Verify we can compare nested structures
    let diff = verify::compare_directories(&snap1, &snap2).unwrap();
    assert!(
        !diff.only_in_b.is_empty(),
        "Should detect new files in nested structure"
    );
}

#[test]
fn test_incremental_backup_chain() {
    if skip_if_no_rsync() {
        return;
    }

    let env = TestBackupEnv::new().unwrap();

    // Create base backup
    generate::simple_backup_structure(&env.source_path).unwrap();

    let snap1 = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap1).unwrap();
    run_rsync_backup(&env.source_path, &snap1).unwrap();

    // Incremental: modify one file (keep same format as original)
    generate::file(
        &env.source_path.join("config.json"),
        b"{\"version\": 2, \"updated\": true}",
    )
    .unwrap();

    let snap2 = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap2).unwrap();
    crate::common::run_rsync_incremental(&env.source_path, &snap2, &snap1).unwrap();

    // Both snapshots should be complete and valid
    let diff1 = verify::compare_directories(&env.source_path, &snap2).unwrap();
    assert!(diff1.is_identical(), "Latest snapshot should match source");

    // snap1 should have original config
    assert!(verify::file_has_content(
        &snap1.join("config.json"),
        b"{\"version\": 1}"
    ));

    // snap2 should have updated config
    assert!(verify::file_has_content(
        &snap2.join("config.json"),
        b"{\"version\": 2, \"updated\": true}"
    ));
}
