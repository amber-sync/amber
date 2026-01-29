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
fn test_index_single_file() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot directory with a single file
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    let test_content = b"Hello, World! This is test content.";
    generate::file(&snapshot_path.join("test.txt"), test_content).unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    // Index the directory
    let result = service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Verify stats
    assert_eq!(result.file_count, 1, "Should have exactly 1 file");
    assert_eq!(
        result.total_size,
        test_content.len() as i64,
        "Total size should match content length"
    );

    // Verify we can get snapshot stats
    let (file_count, total_size) = service
        .get_snapshot_stats("test-job-id", 1704110400000)
        .unwrap();
    assert_eq!(file_count, 1);
    assert_eq!(total_size, test_content.len() as i64);

    // Verify directory contents are queryable
    let contents = service
        .get_directory_contents("test-job-id", 1704110400000, "")
        .unwrap();

    // Should have 1 file entry
    let files: Vec<_> = contents.iter().filter(|f| f.node_type == "file").collect();
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].name, "test.txt");
    assert_eq!(files[0].size, test_content.len() as u64);
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
fn test_index_file_type_statistics() {
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot with various file types
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Create files with different extensions
    generate::file(&snapshot_path.join("doc1.txt"), b"text content 1").unwrap();
    generate::file(&snapshot_path.join("doc2.txt"), b"text content 2").unwrap();
    generate::file(&snapshot_path.join("code.rs"), b"fn main() {}").unwrap();
    generate::file(&snapshot_path.join("data.json"), b"{}").unwrap();
    generate::file(&snapshot_path.join("image.png"), b"PNG binary data here").unwrap();

    let service = create_test_index(env.dest_path.to_str().unwrap());

    service
        .index_snapshot(
            "test-job-id",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Get file type statistics
    let stats = service
        .get_file_type_stats("test-job-id", 1704110400000, 10)
        .unwrap();

    // Should have multiple extension types
    assert!(!stats.is_empty(), "Should have file type stats");

    // Find txt extension (should have 2 files)
    let txt_stat = stats.iter().find(|s| s.extension == "txt");
    assert!(txt_stat.is_some(), "Should have .txt files");
    assert_eq!(txt_stat.unwrap().count, 2, "Should have 2 .txt files");
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
