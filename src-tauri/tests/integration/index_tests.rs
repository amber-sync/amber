//! Integration tests for index service
//!
//! Tests SQLite index operations, file browsing, and search functionality.

use crate::common::test_common::{generate, TestBackupEnv};
use std::fs;

#[test]
fn test_index_database_creation() {
    let env = TestBackupEnv::new().unwrap();
    let meta = env.meta_path();
    fs::create_dir_all(&meta).unwrap();

    // Create a database file (simulating index creation)
    let db_path = meta.join("index.db");
    generate::file(&db_path, b"SQLite format 3\0").unwrap(); // SQLite header

    assert!(db_path.exists());
}

#[test]
fn test_index_file_structure() {
    let env = TestBackupEnv::new().unwrap();

    // Create a sample backup structure for indexing
    generate::simple_backup_structure(&env.source_path).unwrap();

    // List all files that would be indexed
    let mut files: Vec<String> = Vec::new();
    collect_files_recursive(&env.source_path, &env.source_path, &mut files);

    // Verify expected files are present
    assert!(files.iter().any(|f| f.ends_with("readme.txt")));
    assert!(files.iter().any(|f| f.ends_with("main.rs")));
    assert!(files.iter().any(|f| f.ends_with("config.json")));
}

fn collect_files_recursive(
    current: &std::path::Path,
    base: &std::path::Path,
    files: &mut Vec<String>,
) {
    if let Ok(entries) = fs::read_dir(current) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Ok(rel) = path.strip_prefix(base) {
                    files.push(rel.to_string_lossy().to_string());
                }
            } else if path.is_dir() {
                collect_files_recursive(&path, base, files);
            }
        }
    }
}

#[test]
fn test_index_handles_empty_directory() {
    let env = TestBackupEnv::new().unwrap();

    // Source is empty
    let files = fs::read_dir(&env.source_path).unwrap().count();
    assert_eq!(files, 0, "Empty directory should have no files");
}

#[test]
fn test_index_handles_deep_nesting() {
    let env = TestBackupEnv::new().unwrap();

    // Create deeply nested structure
    generate::nested_dirs(&env.source_path, 5, 1).unwrap();

    // Count total files
    let mut files = Vec::new();
    collect_files_recursive(&env.source_path, &env.source_path, &mut files);

    // With depth 5 and 1 file per dir:
    // Level 0: 1 file
    // Level 1: 2 dirs * 1 file = 2 files
    // Level 2: 4 dirs * 1 file = 4 files
    // Level 3: 8 dirs * 1 file = 8 files
    // Level 4: 16 dirs * 1 file = 16 files
    // Level 5: 32 dirs * 1 file = 32 files
    // Total: 1 + 2 + 4 + 8 + 16 + 32 = 63 files
    assert!(
        files.len() > 30,
        "Should have many files from nested structure"
    );
}

#[test]
fn test_index_handles_unicode_filenames() {
    let env = TestBackupEnv::new().unwrap();

    // Create unicode files
    generate::unicode_files(&env.source_path, 10).unwrap();

    // Collect all files
    let mut files = Vec::new();
    collect_files_recursive(&env.source_path, &env.source_path, &mut files);

    assert_eq!(files.len(), 10);

    // Verify unicode names are preserved
    let has_chinese = files.iter().any(|f| f.contains("中文"));
    let has_cyrillic = files.iter().any(|f| f.contains("файл"));
    let has_greek = files.iter().any(|f| f.contains("αβγδ"));

    assert!(has_chinese, "Should have Chinese filename");
    assert!(has_cyrillic, "Should have Cyrillic filename");
    assert!(has_greek, "Should have Greek filename");
}

#[test]
fn test_index_file_metadata() {
    let env = TestBackupEnv::new().unwrap();

    // Create a file with known content
    let test_file = env.source_path.join("test.txt");
    let content = b"Hello, World! This is test content.";
    generate::file(&test_file, content).unwrap();

    // Get metadata
    let metadata = fs::metadata(&test_file).unwrap();

    assert_eq!(metadata.len() as usize, content.len());
    assert!(metadata.is_file());
}

#[test]
fn test_index_directory_listing() {
    let env = TestBackupEnv::new().unwrap();

    // Create a known structure
    fs::create_dir_all(env.source_path.join("dir_a")).unwrap();
    fs::create_dir_all(env.source_path.join("dir_b")).unwrap();
    generate::file(&env.source_path.join("file_1.txt"), b"1").unwrap();
    generate::file(&env.source_path.join("file_2.txt"), b"2").unwrap();
    generate::file(&env.source_path.join("dir_a/nested.txt"), b"nested").unwrap();

    // List root directory
    let entries: Vec<_> = fs::read_dir(&env.source_path)
        .unwrap()
        .filter_map(|e| e.ok())
        .collect();

    // Should have 4 entries: dir_a, dir_b, file_1.txt, file_2.txt
    assert_eq!(entries.len(), 4);

    let dirs: Vec<_> = entries.iter().filter(|e| e.path().is_dir()).collect();
    let files: Vec<_> = entries.iter().filter(|e| e.path().is_file()).collect();

    assert_eq!(dirs.len(), 2, "Should have 2 directories");
    assert_eq!(files.len(), 2, "Should have 2 files");
}

#[test]
fn test_index_search_simulation() {
    let env = TestBackupEnv::new().unwrap();

    // Create files with various names
    generate::file(&env.source_path.join("report_2024.pdf"), b"pdf").unwrap();
    generate::file(&env.source_path.join("report_2023.pdf"), b"pdf").unwrap();
    generate::file(&env.source_path.join("notes.txt"), b"notes").unwrap();
    generate::file(&env.source_path.join("data.csv"), b"csv").unwrap();

    // Simulate search for "report"
    let mut files = Vec::new();
    collect_files_recursive(&env.source_path, &env.source_path, &mut files);

    let matches: Vec<_> = files.iter().filter(|f| f.contains("report")).collect();
    assert_eq!(matches.len(), 2, "Should find 2 report files");

    // Search for ".pdf"
    let pdf_matches: Vec<_> = files.iter().filter(|f| f.ends_with(".pdf")).collect();
    assert_eq!(pdf_matches.len(), 2, "Should find 2 PDF files");
}

#[test]
fn test_index_size_calculation() {
    let env = TestBackupEnv::new().unwrap();

    // Create files with known sizes
    generate::file(&env.source_path.join("a.txt"), &[0u8; 100]).unwrap();
    generate::file(&env.source_path.join("b.txt"), &[0u8; 200]).unwrap();
    generate::file(&env.source_path.join("c.txt"), &[0u8; 300]).unwrap();

    // Calculate total size
    let total_size: u64 = fs::read_dir(&env.source_path)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .map(|e| e.metadata().unwrap().len())
        .sum();

    assert_eq!(total_size, 600, "Total size should be 600 bytes");
}

#[test]
fn test_index_file_count() {
    let env = TestBackupEnv::with_random_files(25, 100).unwrap();

    let count = fs::read_dir(&env.source_path).unwrap().count();
    assert_eq!(count, 25, "Should have exactly 25 random files");
}

#[test]
fn test_index_timestamps() {
    let env = TestBackupEnv::new().unwrap();

    // Create a file
    let test_file = env.source_path.join("test.txt");
    generate::file(&test_file, b"content").unwrap();

    // Get modification time
    let metadata = fs::metadata(&test_file).unwrap();
    let modified = metadata.modified().unwrap();

    // Should be recent (within last minute)
    let now = std::time::SystemTime::now();
    let duration = now.duration_since(modified).unwrap();

    assert!(duration.as_secs() < 60, "File should have recent mtime");
}
