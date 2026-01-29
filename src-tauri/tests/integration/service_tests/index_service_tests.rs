//! Integration tests for IndexService
//!
//! Tests real SQLite database operations with temp directories.
//! These tests call REAL service methods to find actual bugs.

use crate::common::test_common::{generate, TestBackupEnv};
use app_lib::services::index_service::IndexService;
use std::fs;

/// Helper function to create a test IndexService pointing to a temp destination
fn create_test_index(dest_path: &str) -> IndexService {
    // The service needs an app_data_dir, we'll use a subdirectory in the dest
    let app_data_dir = std::path::Path::new(dest_path).join(".index-data");
    fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
    IndexService::new(&app_data_dir).expect("Failed to create IndexService")
}

// ============================================================================
// Basic Indexing Tests
// ============================================================================

#[test]
fn test_index_empty_directory() {
    let env = TestBackupEnv::new().unwrap();

    // Create an empty snapshot directory
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    // Index the empty directory
    let result = service
        .index_snapshot(
            "test-job-id",
            1704110400000, // 2024-01-01 12:00:00 UTC
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Verify stats for empty directory
    assert_eq!(result.job_id, "test-job-id");
    assert_eq!(result.timestamp, 1704110400000);
    assert_eq!(result.file_count, 0, "Empty directory should have 0 files");
    assert_eq!(
        result.total_size, 0,
        "Empty directory should have 0 total size"
    );

    // Verify we can query the indexed snapshot
    assert!(service.is_indexed("test-job-id", 1704110400000).unwrap());

    // Verify listing returns the snapshot
    let snapshots = service.list_snapshots("test-job-id").unwrap();
    assert_eq!(snapshots.len(), 1);
    assert_eq!(snapshots[0].file_count, 0);
}

#[test]
fn test_index_nested_structure() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot with deeply nested structure
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    // depth=3, files_per_dir=2
    // This creates:
    // - 2 files at root (level 0)
    // - 2 dirs at root, each with 2 files (level 1) = 4 files
    // - 4 dirs at level 1, each with 2 files (level 2) = 8 files
    // - 8 dirs at level 2, each with 2 files (level 3) = 16 files
    // Total: 2 + 4 + 8 + 16 = 30 files
    generate::nested_dirs(&snapshot_path, 3, 2).unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    // Index the nested structure
    let result = service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Verify we indexed many files
    assert!(
        result.file_count >= 20,
        "Should have at least 20 files in nested structure, got {}",
        result.file_count
    );
    assert!(result.total_size > 0, "Total size should be > 0");

    // Verify we can browse at different levels
    let root_contents = service
        .get_directory_contents("test-job-id", 1704110400000, "")
        .unwrap();

    // Root should have files and directories
    let root_dirs: Vec<_> = root_contents
        .iter()
        .filter(|f| f.node_type == "dir")
        .collect();
    let root_files: Vec<_> = root_contents
        .iter()
        .filter(|f| f.node_type == "file")
        .collect();

    assert!(!root_dirs.is_empty(), "Should have directories at root");
    assert!(!root_files.is_empty(), "Should have files at root");

    // Verify snapshot is properly indexed
    assert!(service.is_indexed("test-job-id", 1704110400000).unwrap());
}

#[test]
fn test_index_unicode_filenames() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot with unicode-named files
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Create files with various unicode characters
    let unicode_names = [
        ("chinese_中文文件.txt", "Chinese content"),
        ("cyrillic_файл.txt", "Cyrillic content"),
        ("greek_αβγδ.txt", "Greek content"),
        ("emoji_🎉.txt", "Emoji content"),
        ("japanese_日本語.txt", "Japanese content"),
    ];

    for (name, content) in &unicode_names {
        generate::file(&snapshot_path.join(name), content.as_bytes()).unwrap();
    }

    let service = create_test_index(env.dest_path.to_str().unwrap());

    // Index the directory
    let result = service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Verify all unicode files were indexed
    assert_eq!(
        result.file_count,
        unicode_names.len() as i64,
        "Should index all unicode-named files"
    );

    // Verify we can search for unicode names
    let chinese_results = service
        .search_files("test-job-id", 1704110400000, "中文", 100)
        .unwrap();
    assert!(
        !chinese_results.is_empty(),
        "Should find files with Chinese characters"
    );

    let cyrillic_results = service
        .search_files("test-job-id", 1704110400000, "файл", 100)
        .unwrap();
    assert!(
        !cyrillic_results.is_empty(),
        "Should find files with Cyrillic characters"
    );

    let greek_results = service
        .search_files("test-job-id", 1704110400000, "αβγδ", 100)
        .unwrap();
    assert!(
        !greek_results.is_empty(),
        "Should find files with Greek characters"
    );

    // Verify directory contents include unicode names
    let contents = service
        .get_directory_contents("test-job-id", 1704110400000, "")
        .unwrap();

    let has_chinese = contents.iter().any(|f| f.name.contains("中文"));
    let has_cyrillic = contents.iter().any(|f| f.name.contains("файл"));
    let has_greek = contents.iter().any(|f| f.name.contains("αβγδ"));

    assert!(
        has_chinese,
        "Directory contents should include Chinese filename"
    );
    assert!(
        has_cyrillic,
        "Directory contents should include Cyrillic filename"
    );
    assert!(
        has_greek,
        "Directory contents should include Greek filename"
    );
}

#[test]
fn test_index_special_characters_in_paths() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot with files that have special characters
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Files with special characters (safe for filesystem)
    let special_names = [
        "file with spaces.txt",
        "file-with-dashes.txt",
        "file_with_underscores.txt",
        "file.multiple.dots.txt",
        "file'with'quotes.txt",
        "file(with)parens.txt",
        "file[with]brackets.txt",
        "file#hash.txt",
        "file@at.txt",
    ];

    for name in &special_names {
        generate::file(&snapshot_path.join(name), b"content").unwrap();
    }

    let service = create_test_index(env.dest_path.to_str().unwrap());

    // Index the directory
    let result = service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Verify all files were indexed
    assert_eq!(
        result.file_count,
        special_names.len() as i64,
        "Should index all files with special characters"
    );

    // Verify we can browse and see all files
    let contents = service
        .get_directory_contents("test-job-id", 1704110400000, "")
        .unwrap();

    assert_eq!(
        contents.len(),
        special_names.len(),
        "Should list all files with special characters"
    );

    // Verify search works with special characters
    let space_results = service
        .search_files("test-job-id", 1704110400000, "spaces", 100)
        .unwrap();
    assert!(
        !space_results.is_empty(),
        "Should find file with spaces in name"
    );

    let hash_results = service
        .search_files("test-job-id", 1704110400000, "hash", 100)
        .unwrap();
    assert!(
        !hash_results.is_empty(),
        "Should find file with hash in name"
    );
}

#[cfg(unix)]
#[test]
fn test_index_symlinks() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot with symlinks
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Create a target file
    let target_content = b"This is the target file content";
    generate::file(&snapshot_path.join("target.txt"), target_content).unwrap();

    // Create symlinks using the generate module
    generate::symlinks(&snapshot_path, 2, 1).unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    // Index the directory
    let result = service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // The index should include symlinks (as symlink type entries)
    // Note: IndexService tracks symlinks as FileType::Symlink
    assert!(
        result.file_count >= 1,
        "Should have indexed at least the target file"
    );

    // Verify we can browse the directory
    let contents = service
        .get_directory_contents("test-job-id", 1704110400000, "")
        .unwrap();

    // Should see the files (including symlinks as their own entries)
    assert!(
        !contents.is_empty(),
        "Directory contents should not be empty"
    );
}

#[test]
fn test_index_is_idempotent() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot with some files
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    generate::simple_backup_structure(&snapshot_path).unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    // Index the same snapshot twice
    let result1 = service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    let result2 = service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Stats should be identical
    assert_eq!(
        result1.file_count, result2.file_count,
        "File count should be identical after re-indexing"
    );
    assert_eq!(
        result1.total_size, result2.total_size,
        "Total size should be identical after re-indexing"
    );

    // Should still only have one snapshot entry (not duplicates)
    let snapshots = service.list_snapshots("test-job-id").unwrap();
    assert_eq!(
        snapshots.len(),
        1,
        "Should have exactly 1 snapshot, not duplicates"
    );

    // Verify no duplicate files in directory listing
    let contents = service
        .get_directory_contents("test-job-id", 1704110400000, "")
        .unwrap();

    // Count unique paths
    let paths: std::collections::HashSet<_> = contents.iter().map(|f| &f.path).collect();
    assert_eq!(
        paths.len(),
        contents.len(),
        "All file paths should be unique (no duplicates)"
    );
}

// ============================================================================
// Additional Edge Case Tests
// ============================================================================

#[test]
fn test_index_multiple_jobs_same_destination() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshots for two different jobs
    let snapshot_path1 = env.snapshot_path("job1/2024-01-01_120000");
    let snapshot_path2 = env.snapshot_path("job2/2024-01-01_130000");

    fs::create_dir_all(&snapshot_path1).unwrap();
    fs::create_dir_all(&snapshot_path2).unwrap();

    generate::file(&snapshot_path1.join("job1_file.txt"), b"Job 1 content").unwrap();
    generate::file(&snapshot_path2.join("job2_file.txt"), b"Job 2 content").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    // Index both jobs
    let result1 = service
        .index_snapshot("job-1", 1704110400000, snapshot_path1.to_str().unwrap())
        .unwrap();

    let result2 = service
        .index_snapshot("job-2", 1704114000000, snapshot_path2.to_str().unwrap())
        .unwrap();

    // Both should be indexed
    assert_eq!(result1.file_count, 1);
    assert_eq!(result2.file_count, 1);

    // List snapshots for each job separately
    let job1_snapshots = service.list_snapshots("job-1").unwrap();
    let job2_snapshots = service.list_snapshots("job-2").unwrap();

    assert_eq!(job1_snapshots.len(), 1);
    assert_eq!(job2_snapshots.len(), 1);

    // Snapshots should be isolated by job
    assert_eq!(job1_snapshots[0].job_id, "job-1");
    assert_eq!(job2_snapshots[0].job_id, "job-2");
}

#[test]
fn test_index_large_file_sizes() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot with files of various sizes
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Create files with specific sizes
    let sizes = [
        ("tiny.txt", 1usize),
        ("small.txt", 100),
        ("medium.txt", 10_000),
        ("large.txt", 100_000),
    ];

    let mut total_expected: u64 = 0;
    for (name, size) in &sizes {
        let content: Vec<u8> = vec![b'x'; *size];
        generate::file(&snapshot_path.join(name), &content).unwrap();
        total_expected += *size as u64;
    }

    let service = create_test_index(env.dest_path.to_str().unwrap());

    // Index the directory
    let result = service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    assert_eq!(result.file_count, sizes.len() as i64);
    assert_eq!(result.total_size as u64, total_expected);

    // Verify largest files query
    let largest = service
        .get_largest_files("test-job-id", 1704110400000, 10)
        .unwrap();

    assert!(!largest.is_empty());
    // Largest should be first
    assert_eq!(largest[0].size, 100_000);
    assert!(largest[0].name.contains("large"));
}

#[test]
fn test_index_delete_snapshot() {
    let env = TestBackupEnv::new().unwrap();

    // Create and index a snapshot
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    generate::simple_backup_structure(&snapshot_path).unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    assert!(service.is_indexed("test-job-id", 1704110400000).unwrap());

    // Delete the snapshot from index
    service
        .delete_snapshot("test-job-id", 1704110400000)
        .unwrap();

    // Should no longer be indexed
    assert!(!service.is_indexed("test-job-id", 1704110400000).unwrap());

    // List should be empty
    let snapshots = service.list_snapshots("test-job-id").unwrap();
    assert!(snapshots.is_empty());
}

#[test]
fn test_index_aggregate_stats() {
    let env = TestBackupEnv::new().unwrap();

    // Create multiple snapshots for one job
    let snapshot_path1 = env.snapshot_path("2024-01-01_120000");
    let snapshot_path2 = env.snapshot_path("2024-01-02_120000");

    fs::create_dir_all(&snapshot_path1).unwrap();
    fs::create_dir_all(&snapshot_path2).unwrap();

    generate::file(&snapshot_path1.join("file1.txt"), b"content 1").unwrap();
    generate::file(&snapshot_path2.join("file2.txt"), b"content 22").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    // Index both snapshots
    service
        .index_snapshot(
            "test-job-id",
            1704110400000, // Jan 1
            snapshot_path1.to_str().unwrap(),
        )
        .unwrap();

    service
        .index_snapshot(
            "test-job-id",
            1704196800000, // Jan 2
            snapshot_path2.to_str().unwrap(),
        )
        .unwrap();

    // Get aggregate stats
    let stats = service.get_job_aggregate_stats("test-job-id").unwrap();

    assert_eq!(stats.total_snapshots, 2);
    assert_eq!(stats.total_files, 2);
    assert!(stats.total_size_bytes > 0);
    assert_eq!(stats.first_snapshot_ms, Some(1704110400000));
    assert_eq!(stats.last_snapshot_ms, Some(1704196800000));
}

#[test]
fn test_index_snapshot_density() {
    let env = TestBackupEnv::new().unwrap();

    // Create multiple snapshots across different months
    let timestamps = [
        (1704110400000_i64, "2024-01-01_120000"), // Jan 1, 2024
        (1704196800000_i64, "2024-01-02_120000"), // Jan 2, 2024
        (1706788800000_i64, "2024-02-01_120000"), // Feb 1, 2024
    ];

    let service = create_test_index(env.dest_path.to_str().unwrap());

    for (ts, path_name) in &timestamps {
        let snapshot_path = env.snapshot_path(path_name);
        fs::create_dir_all(&snapshot_path).unwrap();
        generate::file(&snapshot_path.join("file.txt"), b"content").unwrap();

        service
            .index_snapshot("test-job-id", *ts, snapshot_path.to_str().unwrap())
            .unwrap();
    }

    // Get monthly density
    let density = service
        .get_snapshot_density("test-job-id", "month")
        .unwrap();

    assert_eq!(density.len(), 2, "Should have 2 months with snapshots");

    // January should have 2 snapshots
    let jan = density.iter().find(|d| d.period == "2024-01");
    assert!(jan.is_some());
    assert_eq!(jan.unwrap().count, 2);

    // February should have 1 snapshot
    let feb = density.iter().find(|d| d.period == "2024-02");
    assert!(feb.is_some());
    assert_eq!(feb.unwrap().count, 1);
}

// ============================================================================
// COMPARE SNAPSHOTS TESTS - The Critical TIM-221 Function
// ============================================================================
//
// NOTE: IndexService::compare_snapshots compares files by their ABSOLUTE paths
// stored in the database. This means that to test modifications and identical
// file detection, we must index the SAME physical directory at different timestamps.
// When files are in different directories, they will appear as added/deleted even
// if they have the same name and content.

#[test]
fn test_compare_identical_snapshots() {
    let env = TestBackupEnv::new().unwrap();

    // Create a single snapshot directory - we'll index it twice with different timestamps
    // This tests the case where the same backup location is scanned at different times
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Create files
    generate::file(&snapshot_path.join("file1.txt"), b"same content").unwrap();
    generate::file(&snapshot_path.join("file2.txt"), b"also same").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts_a = 1704110400000_i64; // Jan 1, 2024
    let ts_b = 1704196800000_i64; // Jan 2, 2024

    // Index the same directory at two different timestamps (simulating re-scan)
    service
        .index_snapshot("test-job-id", ts_a, snapshot_path.to_str().unwrap())
        .unwrap();
    service
        .index_snapshot("test-job-id", ts_b, snapshot_path.to_str().unwrap())
        .unwrap();

    // Compare the two snapshots of the same directory
    let diff = service
        .compare_snapshots("test-job-id", ts_a, ts_b, None)
        .unwrap();

    // No differences should be found (same files, same sizes)
    assert!(diff.added.is_empty(), "Should have no added files");
    assert!(diff.deleted.is_empty(), "Should have no deleted files");
    assert!(diff.modified.is_empty(), "Should have no modified files");
    assert_eq!(diff.summary.total_added, 0);
    assert_eq!(diff.summary.total_deleted, 0);
    assert_eq!(diff.summary.total_modified, 0);
    assert_eq!(diff.summary.size_delta, 0);
}

#[test]
fn test_compare_added_files() {
    let env = TestBackupEnv::new().unwrap();

    // Create a snapshot directory that we'll modify between scans
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts_a = 1704110400000_i64;
    let ts_b = 1704196800000_i64;

    // Index empty directory for snapshot A
    service
        .index_snapshot("test-job-id", ts_a, snapshot_path.to_str().unwrap())
        .unwrap();

    // Add a file and index again for snapshot B
    let new_content = b"this is new content";
    generate::file(&snapshot_path.join("new_file.txt"), new_content).unwrap();

    service
        .index_snapshot("test-job-id", ts_b, snapshot_path.to_str().unwrap())
        .unwrap();

    let diff = service
        .compare_snapshots("test-job-id", ts_a, ts_b, None)
        .unwrap();

    // Should show the new file as added
    assert_eq!(diff.added.len(), 1, "Should have 1 added file");
    assert!(diff.deleted.is_empty(), "Should have no deleted files");
    assert!(diff.modified.is_empty(), "Should have no modified files");

    // Check added file details
    let added_file = &diff.added[0];
    assert!(added_file.path.contains("new_file.txt"));
    assert!(
        added_file.size_a.is_none(),
        "Added file should have no size_a"
    );
    assert_eq!(
        added_file.size_b,
        Some(new_content.len() as i64),
        "Added file should have size_b"
    );

    // Check summary
    assert_eq!(diff.summary.total_added, 1);
    assert_eq!(diff.summary.size_delta, new_content.len() as i64);
}

#[test]
fn test_compare_deleted_files() {
    let env = TestBackupEnv::new().unwrap();

    // Create a snapshot directory with a file that we'll delete between scans
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    let deleted_content = b"this will be deleted";
    generate::file(&snapshot_path.join("deleted_file.txt"), deleted_content).unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts_a = 1704110400000_i64;
    let ts_b = 1704196800000_i64;

    // Index with the file present
    service
        .index_snapshot("test-job-id", ts_a, snapshot_path.to_str().unwrap())
        .unwrap();

    // Delete the file and re-index
    fs::remove_file(snapshot_path.join("deleted_file.txt")).unwrap();

    service
        .index_snapshot("test-job-id", ts_b, snapshot_path.to_str().unwrap())
        .unwrap();

    let diff = service
        .compare_snapshots("test-job-id", ts_a, ts_b, None)
        .unwrap();

    // Should show the file as deleted
    assert!(diff.added.is_empty(), "Should have no added files");
    assert_eq!(diff.deleted.len(), 1, "Should have 1 deleted file");
    assert!(diff.modified.is_empty(), "Should have no modified files");

    // Check deleted file details
    let deleted_file = &diff.deleted[0];
    assert!(deleted_file.path.contains("deleted_file.txt"));
    assert_eq!(
        deleted_file.size_a,
        Some(deleted_content.len() as i64),
        "Deleted file should have size_a"
    );
    assert!(
        deleted_file.size_b.is_none(),
        "Deleted file should have no size_b"
    );

    // Check summary
    assert_eq!(diff.summary.total_deleted, 1);
    assert_eq!(diff.summary.size_delta, -(deleted_content.len() as i64));
}

#[test]
fn test_compare_modified_files() {
    let env = TestBackupEnv::new().unwrap();

    // Create a snapshot directory with a file that we'll modify between scans
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // File starts small
    let content_a = b"small";
    generate::file(&snapshot_path.join("modified.txt"), content_a).unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts_a = 1704110400000_i64;
    let ts_b = 1704196800000_i64;

    // Index with original content
    service
        .index_snapshot("test-job-id", ts_a, snapshot_path.to_str().unwrap())
        .unwrap();

    // Modify the file (different size) and re-index
    let content_b = b"much larger content here";
    generate::file(&snapshot_path.join("modified.txt"), content_b).unwrap();

    service
        .index_snapshot("test-job-id", ts_b, snapshot_path.to_str().unwrap())
        .unwrap();

    let diff = service
        .compare_snapshots("test-job-id", ts_a, ts_b, None)
        .unwrap();

    // Should show the file as modified
    assert!(diff.added.is_empty(), "Should have no added files");
    assert!(diff.deleted.is_empty(), "Should have no deleted files");
    assert_eq!(diff.modified.len(), 1, "Should have 1 modified file");

    // Check modified file details
    let modified_file = &diff.modified[0];
    assert!(modified_file.path.contains("modified.txt"));
    assert_eq!(modified_file.size_a, Some(content_a.len() as i64));
    assert_eq!(modified_file.size_b, Some(content_b.len() as i64));

    // Check summary
    assert_eq!(diff.summary.total_modified, 1);
    let expected_delta = content_b.len() as i64 - content_a.len() as i64;
    assert_eq!(diff.summary.size_delta, expected_delta);
}

#[test]
fn test_compare_mixed_changes() {
    let env = TestBackupEnv::new().unwrap();

    // Create a snapshot directory that we'll modify between scans
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Initial state: unchanged file, file to delete, file to modify
    generate::file(&snapshot_path.join("unchanged.txt"), b"same").unwrap();
    generate::file(&snapshot_path.join("deleted.txt"), b"will be deleted").unwrap();
    generate::file(&snapshot_path.join("modified.txt"), b"short").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts_a = 1704110400000_i64;
    let ts_b = 1704196800000_i64;

    // Index initial state
    service
        .index_snapshot("test-job-id", ts_a, snapshot_path.to_str().unwrap())
        .unwrap();

    // Make changes: delete, add, and modify files
    fs::remove_file(snapshot_path.join("deleted.txt")).unwrap();
    generate::file(&snapshot_path.join("added.txt"), b"newly added").unwrap();
    generate::file(&snapshot_path.join("modified.txt"), b"much longer now").unwrap();

    // Re-index
    service
        .index_snapshot("test-job-id", ts_b, snapshot_path.to_str().unwrap())
        .unwrap();

    let diff = service
        .compare_snapshots("test-job-id", ts_a, ts_b, None)
        .unwrap();

    // Verify all change types
    assert_eq!(diff.added.len(), 1, "Should have 1 added file");
    assert_eq!(diff.deleted.len(), 1, "Should have 1 deleted file");
    assert_eq!(diff.modified.len(), 1, "Should have 1 modified file");

    // Verify summary counts
    assert_eq!(diff.summary.total_added, 1);
    assert_eq!(diff.summary.total_deleted, 1);
    assert_eq!(diff.summary.total_modified, 1);

    // Verify paths
    assert!(diff.added.iter().any(|f| f.path.contains("added.txt")));
    assert!(diff.deleted.iter().any(|f| f.path.contains("deleted.txt")));
    assert!(diff
        .modified
        .iter()
        .any(|f| f.path.contains("modified.txt")));
}

#[test]
fn test_compare_empty_vs_populated() {
    let env = TestBackupEnv::new().unwrap();

    // Start with an empty directory
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts_a = 1704110400000_i64;
    let ts_b = 1704196800000_i64;

    // Index empty directory
    service
        .index_snapshot("test-job-id", ts_a, snapshot_path.to_str().unwrap())
        .unwrap();

    // Add multiple files
    generate::file(&snapshot_path.join("file1.txt"), b"content 1").unwrap();
    generate::file(&snapshot_path.join("file2.txt"), b"content 2").unwrap();
    generate::file(&snapshot_path.join("file3.txt"), b"content 3").unwrap();

    // Re-index
    service
        .index_snapshot("test-job-id", ts_b, snapshot_path.to_str().unwrap())
        .unwrap();

    let diff = service
        .compare_snapshots("test-job-id", ts_a, ts_b, None)
        .unwrap();

    // All files should be added
    assert_eq!(diff.added.len(), 3, "Should have 3 added files");
    assert!(diff.deleted.is_empty(), "Should have no deleted files");
    assert!(diff.modified.is_empty(), "Should have no modified files");
    assert_eq!(diff.summary.total_added, 3);
    assert!(diff.summary.size_delta > 0, "Size delta should be positive");
}

#[test]
fn test_compare_nonexistent_snapshot_a() {
    let env = TestBackupEnv::new().unwrap();

    // Only create and index snapshot B
    let snapshot_path_b = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snapshot_path_b).unwrap();
    generate::file(&snapshot_path_b.join("file.txt"), b"content").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts_a = 1704110400000_i64; // Not indexed
    let ts_b = 1704196800000_i64;

    service
        .index_snapshot("test-job-id", ts_b, snapshot_path_b.to_str().unwrap())
        .unwrap();

    // Try to compare with non-existent snapshot A
    let result = service.compare_snapshots("test-job-id", ts_a, ts_b, None);

    assert!(
        result.is_err(),
        "Should error when snapshot A doesn't exist"
    );
    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("Snapshot A not found"),
        "Error should mention snapshot A: {}",
        err
    );
}

#[test]
fn test_compare_nonexistent_snapshot_b() {
    let env = TestBackupEnv::new().unwrap();

    // Only create and index snapshot A
    let snapshot_path_a = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path_a).unwrap();
    generate::file(&snapshot_path_a.join("file.txt"), b"content").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts_a = 1704110400000_i64;
    let ts_b = 1704196800000_i64; // Not indexed

    service
        .index_snapshot("test-job-id", ts_a, snapshot_path_a.to_str().unwrap())
        .unwrap();

    // Try to compare with non-existent snapshot B
    let result = service.compare_snapshots("test-job-id", ts_a, ts_b, None);

    assert!(
        result.is_err(),
        "Should error when snapshot B doesn't exist"
    );
    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("Snapshot B not found"),
        "Error should mention snapshot B: {}",
        err
    );
}

#[test]
fn test_compare_wrong_job_id() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshots for job-1
    let snapshot_path_a = env.snapshot_path("2024-01-01_120000");
    let snapshot_path_b = env.snapshot_path("2024-01-02_120000");

    fs::create_dir_all(&snapshot_path_a).unwrap();
    fs::create_dir_all(&snapshot_path_b).unwrap();
    generate::file(&snapshot_path_a.join("file.txt"), b"content a").unwrap();
    generate::file(&snapshot_path_b.join("file.txt"), b"content b").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts_a = 1704110400000_i64;
    let ts_b = 1704196800000_i64;

    // Index under job-1
    service
        .index_snapshot("job-1", ts_a, snapshot_path_a.to_str().unwrap())
        .unwrap();
    service
        .index_snapshot("job-1", ts_b, snapshot_path_b.to_str().unwrap())
        .unwrap();

    // Try to compare using wrong job ID
    let result = service.compare_snapshots("wrong-job-id", ts_a, ts_b, None);

    assert!(result.is_err(), "Should error when using wrong job ID");
}

#[test]
fn test_compare_with_limit() {
    let env = TestBackupEnv::new().unwrap();

    // Start with empty directory
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts_a = 1704110400000_i64;
    let ts_b = 1704196800000_i64;

    // Index empty directory
    service
        .index_snapshot("test-job-id", ts_a, snapshot_path.to_str().unwrap())
        .unwrap();

    // Add 10 files
    for i in 0..10 {
        let filename = format!("file_{}.txt", i);
        generate::file(
            &snapshot_path.join(&filename),
            format!("content {}", i).as_bytes(),
        )
        .unwrap();
    }

    // Re-index
    service
        .index_snapshot("test-job-id", ts_b, snapshot_path.to_str().unwrap())
        .unwrap();

    // Compare with a limit of 3
    let diff = service
        .compare_snapshots("test-job-id", ts_a, ts_b, Some(3))
        .unwrap();

    // The limit is applied per category (added/deleted/modified)
    assert_eq!(
        diff.added.len(),
        3,
        "Added files should be exactly 3 due to limit (had 10 files, limited to 3)"
    );

    // Compare without limit
    let diff_no_limit = service
        .compare_snapshots("test-job-id", ts_a, ts_b, None)
        .unwrap();

    assert_eq!(
        diff_no_limit.added.len(),
        10,
        "Without limit should return all 10 added files"
    );
}

#[test]
fn test_compare_unicode_paths() {
    let env = TestBackupEnv::new().unwrap();

    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Initial state: Chinese and Cyrillic files, plus emoji file
    generate::file(&snapshot_path.join("中文文件.txt"), b"chinese content").unwrap();
    generate::file(&snapshot_path.join("файл.txt"), b"cyrillic content").unwrap();
    generate::file(&snapshot_path.join("emoji_🎉.txt"), b"small").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts_a = 1704110400000_i64;
    let ts_b = 1704196800000_i64;

    // Index initial state
    service
        .index_snapshot("test-job-id", ts_a, snapshot_path.to_str().unwrap())
        .unwrap();

    // Changes: delete Chinese and Cyrillic, add Japanese and Greek, modify emoji
    fs::remove_file(snapshot_path.join("中文文件.txt")).unwrap();
    fs::remove_file(snapshot_path.join("файл.txt")).unwrap();
    generate::file(&snapshot_path.join("日本語.txt"), b"japanese content").unwrap();
    generate::file(&snapshot_path.join("αβγδ.txt"), b"greek content").unwrap();
    generate::file(&snapshot_path.join("emoji_🎉.txt"), b"much larger content").unwrap();

    // Re-index
    service
        .index_snapshot("test-job-id", ts_b, snapshot_path.to_str().unwrap())
        .unwrap();

    let diff = service
        .compare_snapshots("test-job-id", ts_a, ts_b, None)
        .unwrap();

    // Should correctly handle unicode paths
    assert_eq!(diff.added.len(), 2, "Should have 2 added unicode files");
    assert_eq!(diff.deleted.len(), 2, "Should have 2 deleted unicode files");
    assert_eq!(
        diff.modified.len(),
        1,
        "Should have 1 modified unicode file"
    );

    // Verify specific unicode paths are found
    assert!(
        diff.added.iter().any(|f| f.path.contains("日本語")),
        "Should find Japanese filename in added"
    );
    assert!(
        diff.deleted.iter().any(|f| f.path.contains("中文")),
        "Should find Chinese filename in deleted"
    );
    assert!(
        diff.modified.iter().any(|f| f.path.contains("emoji")),
        "Should find emoji filename in modified"
    );
}

#[test]
fn test_compare_deeply_nested_changes() {
    let env = TestBackupEnv::new().unwrap();

    let snapshot_path = env.snapshot_path("2024-01-01_120000");

    // Create deep directory structure: level1/level2/level3/level4/level5
    let deep_path = "level1/level2/level3/level4/level5";
    let deep_dir = snapshot_path.join(deep_path);
    fs::create_dir_all(&deep_dir).unwrap();

    // Initial state: root file, deep deleted file, deep modified file
    generate::file(&snapshot_path.join("root_file.txt"), b"at root").unwrap();
    generate::file(&deep_dir.join("deep_deleted.txt"), b"deep content").unwrap();
    generate::file(&deep_dir.join("deep_modified.txt"), b"short").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts_a = 1704110400000_i64;
    let ts_b = 1704196800000_i64;

    // Index initial state
    service
        .index_snapshot("test-job-id", ts_a, snapshot_path.to_str().unwrap())
        .unwrap();

    // Make changes: delete root and deep file, add new deep file, modify deep file
    fs::remove_file(snapshot_path.join("root_file.txt")).unwrap();
    fs::remove_file(deep_dir.join("deep_deleted.txt")).unwrap();
    generate::file(&deep_dir.join("deep_added.txt"), b"new deep content").unwrap();
    generate::file(&deep_dir.join("deep_modified.txt"), b"much longer content").unwrap();

    // Re-index
    service
        .index_snapshot("test-job-id", ts_b, snapshot_path.to_str().unwrap())
        .unwrap();

    let diff = service
        .compare_snapshots("test-job-id", ts_a, ts_b, None)
        .unwrap();

    // Should find changes at all levels
    assert_eq!(diff.added.len(), 1, "Should have 1 added file");
    assert_eq!(diff.deleted.len(), 2, "Should have 2 deleted files");
    assert_eq!(diff.modified.len(), 1, "Should have 1 modified file");

    // Verify deep paths are correctly detected
    assert!(
        diff.added.iter().any(|f| f.path.contains("level5")),
        "Should find deeply nested added file"
    );
    assert!(
        diff.deleted.iter().any(|f| f.path.contains("level5")),
        "Should find deeply nested deleted file"
    );
    assert!(
        diff.modified.iter().any(|f| f.path.contains("level5")),
        "Should find deeply nested modified file"
    );

    // Also verify root-level deletion was detected
    assert!(
        diff.deleted.iter().any(|f| f.path.contains("root_file")),
        "Should find root-level deleted file"
    );
}

// ============================================================================
// SEARCH TESTS AND EDGE CASES
// ============================================================================

#[test]
fn test_search_exact_filename() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot with distinctly named files
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    generate::file(&snapshot_path.join("unique_target.txt"), b"target content").unwrap();
    generate::file(&snapshot_path.join("other_file.txt"), b"other content").unwrap();
    generate::file(&snapshot_path.join("another.rs"), b"rust code").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Search for exact filename
    let results = service
        .search_files("test-job-id", 1704110400000, "unique_target", 100)
        .unwrap();

    assert_eq!(
        results.len(),
        1,
        "Should find exactly one file with exact name match"
    );
    assert_eq!(results[0].name, "unique_target.txt");
}

#[test]
fn test_search_partial_match() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot with files that share a common substring
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    generate::file(&snapshot_path.join("config.json"), b"json config").unwrap();
    generate::file(&snapshot_path.join("config.yaml"), b"yaml config").unwrap();
    generate::file(&snapshot_path.join("config.toml"), b"toml config").unwrap();
    generate::file(&snapshot_path.join("settings.json"), b"settings").unwrap();
    generate::file(&snapshot_path.join("readme.txt"), b"readme").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Search for partial match - "config" should match 3 files
    let results = service
        .search_files("test-job-id", 1704110400000, "config", 100)
        .unwrap();

    assert_eq!(
        results.len(),
        3,
        "Should find all files containing 'config'"
    );
    for result in &results {
        assert!(
            result.name.contains("config"),
            "Each result should contain 'config': {}",
            result.name
        );
    }

    // Search for ".json" should match 2 files
    let json_results = service
        .search_files("test-job-id", 1704110400000, ".json", 100)
        .unwrap();

    assert_eq!(json_results.len(), 2, "Should find 2 .json files");
}

#[test]
fn test_search_sql_injection_attempt() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot with normal files
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    generate::file(&snapshot_path.join("normal_file.txt"), b"normal content").unwrap();
    generate::file(&snapshot_path.join("another.txt"), b"more content").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // SQL injection attempts - these should NOT crash or corrupt the database
    let injection_attempts = [
        "'; DROP TABLE files; --",
        "\" OR 1=1 --",
        "file%' UNION SELECT * FROM snapshots --",
        "'; DELETE FROM snapshots WHERE '1'='1",
        "Robert'); DROP TABLE files;--",
        "1; SELECT * FROM snapshots",
        "' OR ''='",
        "%'; TRUNCATE TABLE files; --",
    ];

    for injection in &injection_attempts {
        // Each injection should return empty results, not error
        let result = service.search_files("test-job-id", 1704110400000, injection, 100);

        assert!(
            result.is_ok(),
            "SQL injection attempt '{}' should not cause an error",
            injection
        );
    }

    // Verify the database is still functional after injection attempts
    let snapshots = service.list_snapshots("test-job-id").unwrap();
    assert_eq!(
        snapshots.len(),
        1,
        "Database should still have the snapshot after injection attempts"
    );

    // Verify files table is intact
    let files = service
        .get_directory_contents("test-job-id", 1704110400000, "")
        .unwrap();
    assert_eq!(
        files.len(),
        2,
        "Files should still exist after injection attempts"
    );

    // Verify normal search still works
    let normal_search = service
        .search_files("test-job-id", 1704110400000, "normal", 100)
        .unwrap();
    assert!(
        !normal_search.is_empty(),
        "Normal search should still work after injection attempts"
    );
}

#[test]
fn test_search_unicode_query() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot with unicode filenames
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Files with various unicode characters
    generate::file(&snapshot_path.join("chinese_文档.txt"), b"chinese doc").unwrap();
    generate::file(&snapshot_path.join("chinese_报告.txt"), b"chinese report").unwrap();
    generate::file(
        &snapshot_path.join("cyrillic_документ.txt"),
        b"cyrillic doc",
    )
    .unwrap();
    generate::file(&snapshot_path.join("japanese_資料.txt"), b"japanese doc").unwrap();
    generate::file(&snapshot_path.join("korean_문서.txt"), b"korean doc").unwrap();
    generate::file(&snapshot_path.join("arabic_وثيقة.txt"), b"arabic doc").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Search with Chinese characters
    let chinese_results = service
        .search_files("test-job-id", 1704110400000, "文档", 100)
        .unwrap();
    assert!(
        !chinese_results.is_empty(),
        "Should find files with Chinese characters in search"
    );

    // Search with Cyrillic characters
    let cyrillic_results = service
        .search_files("test-job-id", 1704110400000, "документ", 100)
        .unwrap();
    assert!(
        !cyrillic_results.is_empty(),
        "Should find files with Cyrillic characters in search"
    );

    // Search with Japanese characters
    let japanese_results = service
        .search_files("test-job-id", 1704110400000, "資料", 100)
        .unwrap();
    assert!(
        !japanese_results.is_empty(),
        "Should find files with Japanese characters in search"
    );

    // Search prefix "chinese_" should find both Chinese files
    let prefix_results = service
        .search_files("test-job-id", 1704110400000, "chinese_", 100)
        .unwrap();
    assert_eq!(
        prefix_results.len(),
        2,
        "Should find both files with chinese_ prefix"
    );
}

#[test]
fn test_delete_snapshot_from_index() {
    let env = TestBackupEnv::new().unwrap();

    // Create and index two snapshots
    let snapshot_path1 = env.snapshot_path("2024-01-01_120000");
    let snapshot_path2 = env.snapshot_path("2024-01-02_120000");

    fs::create_dir_all(&snapshot_path1).unwrap();
    fs::create_dir_all(&snapshot_path2).unwrap();

    generate::file(&snapshot_path1.join("file1.txt"), b"content 1").unwrap();
    generate::file(&snapshot_path2.join("file2.txt"), b"content 2").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts1 = 1704110400000_i64;
    let ts2 = 1704196800000_i64;

    service
        .index_snapshot("test-job-id", ts1, snapshot_path1.to_str().unwrap())
        .unwrap();
    service
        .index_snapshot("test-job-id", ts2, snapshot_path2.to_str().unwrap())
        .unwrap();

    // Verify both are indexed
    assert!(service.is_indexed("test-job-id", ts1).unwrap());
    assert!(service.is_indexed("test-job-id", ts2).unwrap());

    let snapshots_before = service.list_snapshots("test-job-id").unwrap();
    assert_eq!(snapshots_before.len(), 2);

    // Delete the first snapshot
    service.delete_snapshot("test-job-id", ts1).unwrap();

    // Verify it's removed
    assert!(
        !service.is_indexed("test-job-id", ts1).unwrap(),
        "Deleted snapshot should no longer be indexed"
    );

    // Verify the other snapshot is still there
    assert!(
        service.is_indexed("test-job-id", ts2).unwrap(),
        "Other snapshot should still be indexed"
    );

    let snapshots_after = service.list_snapshots("test-job-id").unwrap();
    assert_eq!(snapshots_after.len(), 1, "Should have 1 snapshot remaining");
    assert_eq!(snapshots_after[0].timestamp, ts2);

    // Verify we can no longer query the deleted snapshot
    // (cascade delete removes files automatically via foreign key)
    let result = service.get_directory_contents("test-job-id", ts1, "");
    assert!(
        result.is_err(),
        "get_directory_contents should fail for deleted snapshot"
    );
}

#[test]
fn test_delete_nonexistent_snapshot() {
    let env = TestBackupEnv::new().unwrap();

    // Create an existing snapshot
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();
    generate::file(&snapshot_path.join("file.txt"), b"content").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Try to delete a snapshot that doesn't exist
    let nonexistent_ts = 9999999999999_i64;

    // This should NOT error - it's a no-op
    let result = service.delete_snapshot("test-job-id", nonexistent_ts);
    assert!(
        result.is_ok(),
        "Deleting non-existent snapshot should not error"
    );

    // Try to delete from a non-existent job
    let result2 = service.delete_snapshot("nonexistent-job", 1704110400000);
    assert!(
        result2.is_ok(),
        "Deleting from non-existent job should not error"
    );

    // Verify the existing snapshot is unchanged
    assert!(service.is_indexed("test-job-id", 1704110400000).unwrap());
}

#[test]
fn test_get_directory_contents() {
    let env = TestBackupEnv::new().unwrap();

    // Create a nested directory structure
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Root level files
    generate::file(&snapshot_path.join("root1.txt"), b"root file 1").unwrap();
    generate::file(&snapshot_path.join("root2.txt"), b"root file 2").unwrap();

    // Subdirectory with files
    let subdir = snapshot_path.join("subdir");
    fs::create_dir_all(&subdir).unwrap();
    generate::file(&subdir.join("sub1.txt"), b"sub file 1").unwrap();
    generate::file(&subdir.join("sub2.txt"), b"sub file 2").unwrap();

    // Nested subdirectory
    let nested = subdir.join("nested");
    fs::create_dir_all(&nested).unwrap();
    generate::file(&nested.join("nested1.txt"), b"nested file").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Get root directory contents
    let root_contents = service
        .get_directory_contents("test-job-id", 1704110400000, "")
        .unwrap();

    // Should have 2 files and 1 directory at root
    let root_files: Vec<_> = root_contents
        .iter()
        .filter(|f| f.node_type == "file")
        .collect();
    let root_dirs: Vec<_> = root_contents
        .iter()
        .filter(|f| f.node_type == "dir")
        .collect();

    assert_eq!(root_files.len(), 2, "Root should have 2 files");
    assert_eq!(root_dirs.len(), 1, "Root should have 1 directory");
    assert!(
        root_dirs.iter().any(|d| d.name == "subdir"),
        "Root should contain 'subdir' directory"
    );

    // Get subdirectory contents - need to use the relative path from index
    // The parent_path is stored as relative path from the snapshot root
    let subdir_contents = service
        .get_directory_contents("test-job-id", 1704110400000, "subdir")
        .unwrap();

    // Should have 2 files and 1 nested directory
    let sub_files: Vec<_> = subdir_contents
        .iter()
        .filter(|f| f.node_type == "file")
        .collect();
    let sub_dirs: Vec<_> = subdir_contents
        .iter()
        .filter(|f| f.node_type == "dir")
        .collect();

    assert_eq!(sub_files.len(), 2, "Subdir should have 2 files");
    assert_eq!(sub_dirs.len(), 1, "Subdir should have 1 nested directory");

    // Verify file metadata is correct
    for file in &root_files {
        assert!(!file.name.is_empty(), "File name should not be empty");
        assert!(file.size > 0, "File size should be > 0");
        assert!(file.modified > 0, "File mtime should be > 0");
    }
}

#[test]
fn test_multiple_jobs_isolation() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshots for two different jobs
    let snapshot_path1 = env.snapshot_path("job1/2024-01-01_120000");
    let snapshot_path2 = env.snapshot_path("job2/2024-01-01_120000");

    fs::create_dir_all(&snapshot_path1).unwrap();
    fs::create_dir_all(&snapshot_path2).unwrap();

    // Job 1 has specific files
    generate::file(
        &snapshot_path1.join("job1_secret.txt"),
        b"job 1 secret data",
    )
    .unwrap();
    generate::file(&snapshot_path1.join("job1_config.json"), b"job 1 config").unwrap();

    // Job 2 has different files
    generate::file(&snapshot_path2.join("job2_data.txt"), b"job 2 data").unwrap();
    generate::file(
        &snapshot_path2.join("job2_settings.yaml"),
        b"job 2 settings",
    )
    .unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let ts = 1704110400000_i64;

    // Index both jobs
    service
        .index_snapshot("job-alpha", ts, snapshot_path1.to_str().unwrap())
        .unwrap();
    service
        .index_snapshot("job-beta", ts, snapshot_path2.to_str().unwrap())
        .unwrap();

    // Verify each job only sees its own files
    let job1_files = service.get_directory_contents("job-alpha", ts, "").unwrap();
    let job2_files = service.get_directory_contents("job-beta", ts, "").unwrap();

    // Job 1 should only see job1 files
    assert_eq!(job1_files.len(), 2);
    assert!(
        job1_files.iter().all(|f| f.name.starts_with("job1_")),
        "Job 1 should only see job1 files"
    );

    // Job 2 should only see job2 files
    assert_eq!(job2_files.len(), 2);
    assert!(
        job2_files.iter().all(|f| f.name.starts_with("job2_")),
        "Job 2 should only see job2 files"
    );

    // Search in job 1 should not find job 2 files
    let search_result = service.search_files("job-alpha", ts, "job2", 100).unwrap();
    assert!(
        search_result.is_empty(),
        "Search in job-alpha should not find job-beta files"
    );

    // Search in job 2 should not find job 1 files
    let search_result2 = service.search_files("job-beta", ts, "secret", 100).unwrap();
    assert!(
        search_result2.is_empty(),
        "Search in job-beta should not find job-alpha's secret file"
    );

    // List snapshots should be isolated by job
    let job1_snapshots = service.list_snapshots("job-alpha").unwrap();
    let job2_snapshots = service.list_snapshots("job-beta").unwrap();

    assert_eq!(job1_snapshots.len(), 1);
    assert_eq!(job2_snapshots.len(), 1);
    assert_eq!(job1_snapshots[0].job_id, "job-alpha");
    assert_eq!(job2_snapshots[0].job_id, "job-beta");

    // Aggregate stats should be isolated
    let job1_stats = service.get_job_aggregate_stats("job-alpha").unwrap();
    let job2_stats = service.get_job_aggregate_stats("job-beta").unwrap();

    assert_eq!(job1_stats.total_files, 2);
    assert_eq!(job2_stats.total_files, 2);

    // Deleting one job's snapshot should not affect the other
    service.delete_snapshot("job-alpha", ts).unwrap();

    assert!(!service.is_indexed("job-alpha", ts).unwrap());
    assert!(
        service.is_indexed("job-beta", ts).unwrap(),
        "Job-beta should still be indexed after deleting job-alpha"
    );

    // Job 2 files should still be accessible
    let job2_files_after = service.get_directory_contents("job-beta", ts, "").unwrap();
    assert_eq!(
        job2_files_after.len(),
        2,
        "Job-beta files should still be accessible"
    );
}
