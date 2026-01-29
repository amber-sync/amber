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
