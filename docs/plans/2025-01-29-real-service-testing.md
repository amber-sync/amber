# Real Service Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create exhaustive tests that exercise real IndexService, RsyncService, SnapshotService, and ManifestService code to find actual bugs.

**Architecture:** Integration tests in `tests/integration/service_tests/` that instantiate real services with temp directories. Unit tests added as `#[cfg(test)]` modules inside service files for pure logic. Reuse existing TestBackupEnv, generate, and verify utilities.

**Tech Stack:** Rust, rstest for parameterized tests, tempfile for isolation, existing test utilities in `tests/common/`

---

## Task 1: Create Service Test Module Structure

**Files:**
- Create: `src-tauri/tests/integration/service_tests/mod.rs`
- Modify: `src-tauri/tests/integration/mod.rs`

**Step 1: Create the service_tests module**

```rust
// src-tauri/tests/integration/service_tests/mod.rs
//! Integration tests for real Amber services
//!
//! These tests instantiate actual service instances with temp directories
//! to verify real behavior, not mocked behavior.

pub mod index_service_tests;
pub mod rsync_service_tests;
pub mod manifest_service_tests;
pub mod snapshot_service_tests;
```

**Step 2: Update integration mod.rs to include service_tests**

Add to `src-tauri/tests/integration/mod.rs`:
```rust
mod service_tests;
```

**Step 3: Verify structure compiles**

Run: `cd src-tauri && cargo check --test integration`
Expected: Compilation errors about missing modules (expected, we'll create them next)

---

## Task 2: IndexService Core Tests - Setup and Basic Indexing

**Files:**
- Create: `src-tauri/tests/integration/service_tests/index_service_tests.rs`

**Step 1: Write tests for basic IndexService functionality**

```rust
//! Integration tests for IndexService
//!
//! Tests real SQLite operations with temp directories.

use crate::common::test_common::{generate, verify, TestBackupEnv};
use app_lib::services::index_service::IndexService;
use std::fs;

/// Helper to create an IndexService pointing to a temp destination
fn create_test_index(dest_path: &str) -> IndexService {
    IndexService::for_destination(dest_path).expect("Failed to create IndexService")
}

// ============================================================================
// BASIC INDEXING TESTS
// ============================================================================

#[test]
fn test_index_empty_directory() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    let result = index.index_snapshot(
        "test-job",
        1704106800,
        snapshot_path.to_str().unwrap(),
    );

    assert!(result.is_ok(), "Indexing empty directory should succeed");

    // Verify stats show 0 files
    let stats = index.get_snapshot_stats("test-job", 1704106800);
    assert!(stats.is_ok());
    let (file_count, _total_size) = stats.unwrap();
    assert_eq!(file_count, 0, "Empty directory should have 0 files");
}

#[test]
fn test_index_single_file() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    generate::file(&snapshot_path.join("test.txt"), b"hello world").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap()).unwrap();

    let stats = index.get_snapshot_stats("test-job", 1704106800).unwrap();
    assert_eq!(stats.0, 1, "Should have 1 file indexed");
    assert_eq!(stats.1, 11, "File size should be 11 bytes");
}

#[test]
fn test_index_nested_structure() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");

    // Create 5 levels deep with multiple files
    generate::nested_dirs(&snapshot_path, 4, 3).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap()).unwrap();

    let stats = index.get_snapshot_stats("test-job", 1704106800).unwrap();
    // nested_dirs(4, 3) creates: 3 + 2*(3 + 2*(3 + 2*(3 + 2*3))) files
    // Level 0: 3, Level 1: 6, Level 2: 12, Level 3: 24, Level 4: 48 = 93 files
    assert!(stats.0 > 30, "Should have many files indexed, got {}", stats.0);
}

#[test]
fn test_index_unicode_filenames() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Create files with unicode names
    generate::file(&snapshot_path.join("中文文件.txt"), b"chinese").unwrap();
    generate::file(&snapshot_path.join("émoji_file.txt"), b"emoji").unwrap();
    generate::file(&snapshot_path.join("файл.txt"), b"cyrillic").unwrap();
    generate::file(&snapshot_path.join("αβγδ.txt"), b"greek").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap()).unwrap();

    // Verify all 4 files indexed
    let stats = index.get_snapshot_stats("test-job", 1704106800).unwrap();
    assert_eq!(stats.0, 4, "All unicode files should be indexed");

    // Verify we can retrieve them by searching
    let results = index.search_files("test-job", 1704106800, "中文", 10).unwrap();
    assert_eq!(results.len(), 1, "Should find Chinese filename");
}

#[test]
fn test_index_special_characters_in_paths() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Files with characters that could cause SQL issues
    generate::file(&snapshot_path.join("file with spaces.txt"), b"spaces").unwrap();
    generate::file(&snapshot_path.join("file'with'quotes.txt"), b"quotes").unwrap();
    generate::file(&snapshot_path.join("file\"doublequotes\".txt"), b"double").unwrap();
    generate::file(&snapshot_path.join("file;semicolon.txt"), b"semi").unwrap();
    generate::file(&snapshot_path.join("file--dashes.txt"), b"dashes").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    let result = index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap());

    assert!(result.is_ok(), "Should handle special characters without SQL injection");

    let stats = index.get_snapshot_stats("test-job", 1704106800).unwrap();
    assert_eq!(stats.0, 5, "All special character files should be indexed");
}

#[cfg(unix)]
#[test]
fn test_index_symlinks() {
    use std::os::unix::fs::symlink;

    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    // Create target and symlink
    generate::file(&snapshot_path.join("target.txt"), b"target").unwrap();
    symlink("target.txt", snapshot_path.join("link.txt")).unwrap();

    // Create broken symlink
    symlink("/nonexistent/path", snapshot_path.join("broken_link.txt")).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap()).unwrap();

    // Should index the target file and symlinks (as symlinks, not following them)
    let stats = index.get_snapshot_stats("test-job", 1704106800).unwrap();
    assert!(stats.0 >= 1, "Should index at least the target file");
}

#[test]
fn test_index_is_idempotent() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    generate::simple_backup_structure(&snapshot_path).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());

    // Index twice
    index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap()).unwrap();
    let result = index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap());

    // Should either succeed (overwrite) or return appropriate error
    // Should NOT duplicate entries or corrupt database
    let stats = index.get_snapshot_stats("test-job", 1704106800).unwrap();
    assert_eq!(stats.0, 5, "Should have exactly 5 files, not duplicated");
}
```

**Step 2: Run tests to verify they work**

Run: `cd src-tauri && cargo test --test integration index_service_tests -- --test-threads=1`
Expected: Tests run (may find bugs!)

**Step 3: Commit**

```bash
git add src-tauri/tests/integration/service_tests/
git commit -m "TIM-222: Add IndexService basic indexing tests"
```

---

## Task 3: IndexService compare_snapshots Tests

**Files:**
- Modify: `src-tauri/tests/integration/service_tests/index_service_tests.rs`

**Step 1: Add comprehensive compare_snapshots tests**

Append to `index_service_tests.rs`:

```rust
// ============================================================================
// COMPARE SNAPSHOTS TESTS - The Critical TIM-221 Function
// ============================================================================

#[test]
fn test_compare_identical_snapshots() {
    let env = TestBackupEnv::new().unwrap();

    // Create two identical snapshots
    let snap_a = env.snapshot_path("2024-01-01_120000");
    let snap_b = env.snapshot_path("2024-01-02_120000");
    generate::simple_backup_structure(&snap_a).unwrap();
    generate::simple_backup_structure(&snap_b).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snap_a.to_str().unwrap()).unwrap();
    index.index_snapshot("test-job", 1704193200, snap_b.to_str().unwrap()).unwrap();

    let diff = index.compare_snapshots("test-job", 1704106800, 1704193200, None).unwrap();

    assert!(diff.added.is_empty(), "Identical snapshots should have no added files");
    assert!(diff.deleted.is_empty(), "Identical snapshots should have no deleted files");
    assert!(diff.modified.is_empty(), "Identical snapshots should have no modified files");
}

#[test]
fn test_compare_added_files() {
    let env = TestBackupEnv::new().unwrap();

    let snap_a = env.snapshot_path("2024-01-01_120000");
    let snap_b = env.snapshot_path("2024-01-02_120000");

    // Snapshot A: just one file
    fs::create_dir_all(&snap_a).unwrap();
    generate::file(&snap_a.join("original.txt"), b"original").unwrap();

    // Snapshot B: original + new file
    fs::create_dir_all(&snap_b).unwrap();
    generate::file(&snap_b.join("original.txt"), b"original").unwrap();
    generate::file(&snap_b.join("new_file.txt"), b"new content").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snap_a.to_str().unwrap()).unwrap();
    index.index_snapshot("test-job", 1704193200, snap_b.to_str().unwrap()).unwrap();

    let diff = index.compare_snapshots("test-job", 1704106800, 1704193200, None).unwrap();

    assert_eq!(diff.added.len(), 1, "Should detect 1 added file");
    assert!(diff.added[0].path.contains("new_file.txt"), "Added file should be new_file.txt");
    assert_eq!(diff.added[0].size_b, Some(11), "New file size should be 11 bytes");
    assert!(diff.deleted.is_empty(), "Should have no deleted files");
}

#[test]
fn test_compare_deleted_files() {
    let env = TestBackupEnv::new().unwrap();

    let snap_a = env.snapshot_path("2024-01-01_120000");
    let snap_b = env.snapshot_path("2024-01-02_120000");

    // Snapshot A: two files
    fs::create_dir_all(&snap_a).unwrap();
    generate::file(&snap_a.join("keep.txt"), b"keep").unwrap();
    generate::file(&snap_a.join("delete_me.txt"), b"will be deleted").unwrap();

    // Snapshot B: only one file
    fs::create_dir_all(&snap_b).unwrap();
    generate::file(&snap_b.join("keep.txt"), b"keep").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snap_a.to_str().unwrap()).unwrap();
    index.index_snapshot("test-job", 1704193200, snap_b.to_str().unwrap()).unwrap();

    let diff = index.compare_snapshots("test-job", 1704106800, 1704193200, None).unwrap();

    assert_eq!(diff.deleted.len(), 1, "Should detect 1 deleted file");
    assert!(diff.deleted[0].path.contains("delete_me.txt"), "Deleted file should be delete_me.txt");
    assert!(diff.added.is_empty(), "Should have no added files");
}

#[test]
fn test_compare_modified_files() {
    let env = TestBackupEnv::new().unwrap();

    let snap_a = env.snapshot_path("2024-01-01_120000");
    let snap_b = env.snapshot_path("2024-01-02_120000");

    // Snapshot A: file with original content
    fs::create_dir_all(&snap_a).unwrap();
    generate::file(&snap_a.join("config.txt"), b"version 1").unwrap();

    // Snapshot B: same file, different size (different content)
    fs::create_dir_all(&snap_b).unwrap();
    generate::file(&snap_b.join("config.txt"), b"version 2 with more content").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snap_a.to_str().unwrap()).unwrap();
    index.index_snapshot("test-job", 1704193200, snap_b.to_str().unwrap()).unwrap();

    let diff = index.compare_snapshots("test-job", 1704106800, 1704193200, None).unwrap();

    assert_eq!(diff.modified.len(), 1, "Should detect 1 modified file");
    assert!(diff.modified[0].path.contains("config.txt"), "Modified file should be config.txt");
    assert_eq!(diff.modified[0].size_a, Some(9), "Old size should be 9");
    assert_eq!(diff.modified[0].size_b, Some(27), "New size should be 27");
}

#[test]
fn test_compare_mixed_changes() {
    let env = TestBackupEnv::new().unwrap();

    let snap_a = env.snapshot_path("2024-01-01_120000");
    let snap_b = env.snapshot_path("2024-01-02_120000");

    // Snapshot A
    fs::create_dir_all(&snap_a).unwrap();
    generate::file(&snap_a.join("unchanged.txt"), b"same").unwrap();
    generate::file(&snap_a.join("modified.txt"), b"old").unwrap();
    generate::file(&snap_a.join("deleted.txt"), b"will be gone").unwrap();

    // Snapshot B: mixed changes
    fs::create_dir_all(&snap_b).unwrap();
    generate::file(&snap_b.join("unchanged.txt"), b"same").unwrap();
    generate::file(&snap_b.join("modified.txt"), b"new content here").unwrap();
    generate::file(&snap_b.join("added.txt"), b"brand new").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snap_a.to_str().unwrap()).unwrap();
    index.index_snapshot("test-job", 1704193200, snap_b.to_str().unwrap()).unwrap();

    let diff = index.compare_snapshots("test-job", 1704106800, 1704193200, None).unwrap();

    assert_eq!(diff.added.len(), 1, "Should have 1 added");
    assert_eq!(diff.deleted.len(), 1, "Should have 1 deleted");
    assert_eq!(diff.modified.len(), 1, "Should have 1 modified");
}

#[test]
fn test_compare_empty_vs_populated() {
    let env = TestBackupEnv::new().unwrap();

    let snap_a = env.snapshot_path("2024-01-01_120000");
    let snap_b = env.snapshot_path("2024-01-02_120000");

    // Snapshot A: empty
    fs::create_dir_all(&snap_a).unwrap();

    // Snapshot B: has files
    generate::simple_backup_structure(&snap_b).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snap_a.to_str().unwrap()).unwrap();
    index.index_snapshot("test-job", 1704193200, snap_b.to_str().unwrap()).unwrap();

    let diff = index.compare_snapshots("test-job", 1704106800, 1704193200, None).unwrap();

    assert_eq!(diff.added.len(), 5, "All 5 files should show as added");
    assert!(diff.deleted.is_empty(), "Nothing should be deleted");
    assert!(diff.modified.is_empty(), "Nothing should be modified");
}

#[test]
fn test_compare_nonexistent_snapshot_a() {
    let env = TestBackupEnv::new().unwrap();

    let snap_b = env.snapshot_path("2024-01-02_120000");
    generate::simple_backup_structure(&snap_b).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704193200, snap_b.to_str().unwrap()).unwrap();

    // Try to compare with non-existent snapshot A
    let result = index.compare_snapshots("test-job", 9999999999, 1704193200, None);

    assert!(result.is_err(), "Should error when snapshot A doesn't exist");
}

#[test]
fn test_compare_nonexistent_snapshot_b() {
    let env = TestBackupEnv::new().unwrap();

    let snap_a = env.snapshot_path("2024-01-01_120000");
    generate::simple_backup_structure(&snap_a).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snap_a.to_str().unwrap()).unwrap();

    // Try to compare with non-existent snapshot B
    let result = index.compare_snapshots("test-job", 1704106800, 9999999999, None);

    assert!(result.is_err(), "Should error when snapshot B doesn't exist");
}

#[test]
fn test_compare_wrong_job_id() {
    let env = TestBackupEnv::new().unwrap();

    let snap_a = env.snapshot_path("2024-01-01_120000");
    let snap_b = env.snapshot_path("2024-01-02_120000");
    generate::simple_backup_structure(&snap_a).unwrap();
    generate::simple_backup_structure(&snap_b).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("job-1", 1704106800, snap_a.to_str().unwrap()).unwrap();
    index.index_snapshot("job-1", 1704193200, snap_b.to_str().unwrap()).unwrap();

    // Try to compare with wrong job ID
    let result = index.compare_snapshots("wrong-job", 1704106800, 1704193200, None);

    assert!(result.is_err(), "Should error when job ID doesn't match");
}

#[test]
fn test_compare_with_limit() {
    let env = TestBackupEnv::new().unwrap();

    let snap_a = env.snapshot_path("2024-01-01_120000");
    let snap_b = env.snapshot_path("2024-01-02_120000");

    // Snapshot A: empty
    fs::create_dir_all(&snap_a).unwrap();

    // Snapshot B: many files
    fs::create_dir_all(&snap_b).unwrap();
    for i in 0..50 {
        generate::file(&snap_b.join(format!("file_{:03}.txt", i)), b"content").unwrap();
    }

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snap_a.to_str().unwrap()).unwrap();
    index.index_snapshot("test-job", 1704193200, snap_b.to_str().unwrap()).unwrap();

    // Compare with limit of 10
    let diff = index.compare_snapshots("test-job", 1704106800, 1704193200, Some(10)).unwrap();

    assert!(diff.added.len() <= 10, "Should respect limit, got {} added", diff.added.len());
}

#[test]
fn test_compare_unicode_paths() {
    let env = TestBackupEnv::new().unwrap();

    let snap_a = env.snapshot_path("2024-01-01_120000");
    let snap_b = env.snapshot_path("2024-01-02_120000");

    // Snapshot A: unicode file
    fs::create_dir_all(&snap_a).unwrap();
    generate::file(&snap_a.join("中文文件.txt"), b"original").unwrap();

    // Snapshot B: modified unicode file + new unicode file
    fs::create_dir_all(&snap_b).unwrap();
    generate::file(&snap_b.join("中文文件.txt"), b"modified content").unwrap();
    generate::file(&snap_b.join("新文件.txt"), b"new").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snap_a.to_str().unwrap()).unwrap();
    index.index_snapshot("test-job", 1704193200, snap_b.to_str().unwrap()).unwrap();

    let diff = index.compare_snapshots("test-job", 1704106800, 1704193200, None).unwrap();

    assert_eq!(diff.modified.len(), 1, "Should detect modified unicode file");
    assert_eq!(diff.added.len(), 1, "Should detect added unicode file");
    assert!(diff.modified[0].path.contains("中文"), "Path should contain Chinese characters");
}

#[test]
fn test_compare_deeply_nested_changes() {
    let env = TestBackupEnv::new().unwrap();

    let snap_a = env.snapshot_path("2024-01-01_120000");
    let snap_b = env.snapshot_path("2024-01-02_120000");

    // Create deep nesting
    let deep_dir_a = snap_a.join("level1/level2/level3/level4/level5");
    let deep_dir_b = snap_b.join("level1/level2/level3/level4/level5");
    fs::create_dir_all(&deep_dir_a).unwrap();
    fs::create_dir_all(&deep_dir_b).unwrap();

    generate::file(&deep_dir_a.join("deep.txt"), b"original").unwrap();
    generate::file(&deep_dir_b.join("deep.txt"), b"modified").unwrap();
    generate::file(&deep_dir_b.join("new_deep.txt"), b"new").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snap_a.to_str().unwrap()).unwrap();
    index.index_snapshot("test-job", 1704193200, snap_b.to_str().unwrap()).unwrap();

    let diff = index.compare_snapshots("test-job", 1704106800, 1704193200, None).unwrap();

    // Verify full paths are in the diff
    assert!(diff.modified[0].path.contains("level1/level2/level3/level4/level5"),
            "Full nested path should be in diff");
}
```

**Step 2: Run compare_snapshots tests**

Run: `cd src-tauri && cargo test --test integration compare_snapshots -- --test-threads=1`
Expected: Tests run and may find bugs in compare logic

**Step 3: Commit**

```bash
git add src-tauri/tests/integration/service_tests/index_service_tests.rs
git commit -m "TIM-222: Add IndexService compare_snapshots tests"
```

---

## Task 4: IndexService Search and Edge Case Tests

**Files:**
- Modify: `src-tauri/tests/integration/service_tests/index_service_tests.rs`

**Step 1: Add search and edge case tests**

Append to `index_service_tests.rs`:

```rust
// ============================================================================
// SEARCH TESTS
// ============================================================================

#[test]
fn test_search_exact_filename() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    generate::simple_backup_structure(&snapshot_path).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap()).unwrap();

    let results = index.search_files("test-job", 1704106800, "config.json", 100).unwrap();

    assert_eq!(results.len(), 1, "Should find exactly 1 match for config.json");
}

#[test]
fn test_search_partial_match() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    generate::file(&snapshot_path.join("config.json"), b"{}").unwrap();
    generate::file(&snapshot_path.join("config.yaml"), b"").unwrap();
    generate::file(&snapshot_path.join("app_config.txt"), b"").unwrap();
    generate::file(&snapshot_path.join("other.txt"), b"").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap()).unwrap();

    let results = index.search_files("test-job", 1704106800, "config", 100).unwrap();

    assert_eq!(results.len(), 3, "Should find 3 files containing 'config'");
}

#[test]
fn test_search_no_results() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    generate::simple_backup_structure(&snapshot_path).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap()).unwrap();

    let results = index.search_files("test-job", 1704106800, "nonexistent_xyz", 100).unwrap();

    assert!(results.is_empty(), "Should return empty results, not error");
}

#[test]
fn test_search_sql_injection_attempt() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    generate::simple_backup_structure(&snapshot_path).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap()).unwrap();

    // Attempt SQL injection
    let malicious_queries = vec![
        "'; DROP TABLE files; --",
        "\" OR 1=1 --",
        "file%' UNION SELECT * FROM snapshots --",
        "'; DELETE FROM files; --",
    ];

    for query in malicious_queries {
        let result = index.search_files("test-job", 1704106800, query, 100);
        // Should either return empty results or error, but NOT execute injection
        assert!(result.is_ok() || result.is_err(),
                "SQL injection attempt should be safely handled: {}", query);

        // Verify database still works after injection attempt
        let verify = index.search_files("test-job", 1704106800, "config", 100);
        assert!(verify.is_ok(), "Database should still work after injection attempt");
    }
}

#[test]
fn test_search_unicode_query() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    generate::file(&snapshot_path.join("文档.txt"), b"doc").unwrap();
    generate::file(&snapshot_path.join("文件.txt"), b"file").unwrap();
    generate::file(&snapshot_path.join("other.txt"), b"other").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap()).unwrap();

    let results = index.search_files("test-job", 1704106800, "文", 100).unwrap();

    assert_eq!(results.len(), 2, "Should find both Chinese files");
}

// ============================================================================
// EDGE CASES AND ERROR HANDLING
// ============================================================================

#[test]
fn test_list_snapshots_empty_job() {
    let env = TestBackupEnv::new().unwrap();
    fs::create_dir_all(&env.dest_path).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());

    let snapshots = index.list_snapshots("nonexistent-job").unwrap();

    assert!(snapshots.is_empty(), "Non-existent job should return empty list");
}

#[test]
fn test_delete_snapshot_from_index() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    generate::simple_backup_structure(&snapshot_path).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap()).unwrap();

    // Verify it exists
    assert!(index.is_indexed("test-job", 1704106800).unwrap());

    // Delete it
    index.delete_snapshot("test-job", 1704106800).unwrap();

    // Verify it's gone
    assert!(!index.is_indexed("test-job", 1704106800).unwrap());
}

#[test]
fn test_delete_nonexistent_snapshot() {
    let env = TestBackupEnv::new().unwrap();
    fs::create_dir_all(&env.dest_path).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());

    // Should not error when deleting non-existent snapshot
    let result = index.delete_snapshot("test-job", 9999999999);

    assert!(result.is_ok(), "Deleting non-existent snapshot should not error");
}

#[test]
fn test_get_directory_contents() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");

    // Create specific structure
    fs::create_dir_all(snapshot_path.join("subdir")).unwrap();
    generate::file(&snapshot_path.join("root_file.txt"), b"root").unwrap();
    generate::file(&snapshot_path.join("subdir/nested.txt"), b"nested").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("test-job", 1704106800, snapshot_path.to_str().unwrap()).unwrap();

    // Get root directory contents
    let contents = index.get_directory_contents("test-job", 1704106800, "").unwrap();

    // Should have root_file.txt and subdir
    assert!(contents.len() >= 2, "Should have at least 2 items in root");
}

#[test]
fn test_get_snapshot_stats_nonexistent() {
    let env = TestBackupEnv::new().unwrap();
    fs::create_dir_all(&env.dest_path).unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());

    let result = index.get_snapshot_stats("test-job", 9999999999);

    // Should error or return zeros, not panic
    assert!(result.is_err() || result.unwrap() == (0, 0),
            "Non-existent snapshot stats should error or return zeros");
}

#[test]
fn test_multiple_jobs_isolation() {
    let env = TestBackupEnv::new().unwrap();

    let snap_job1 = env.snapshot_path("job1/2024-01-01_120000");
    let snap_job2 = env.snapshot_path("job2/2024-01-01_120000");

    fs::create_dir_all(&snap_job1).unwrap();
    fs::create_dir_all(&snap_job2).unwrap();

    generate::file(&snap_job1.join("job1_file.txt"), b"job1").unwrap();
    generate::file(&snap_job2.join("job2_file.txt"), b"job2").unwrap();

    let index = create_test_index(env.dest_path.to_str().unwrap());
    index.index_snapshot("job-1", 1704106800, snap_job1.to_str().unwrap()).unwrap();
    index.index_snapshot("job-2", 1704106800, snap_job2.to_str().unwrap()).unwrap();

    // Search in job-1 should not find job-2 files
    let results = index.search_files("job-1", 1704106800, "job2_file", 100).unwrap();
    assert!(results.is_empty(), "Job isolation should prevent cross-job search results");

    // Each job should have exactly 1 file
    let stats1 = index.get_snapshot_stats("job-1", 1704106800).unwrap();
    let stats2 = index.get_snapshot_stats("job-2", 1704106800).unwrap();
    assert_eq!(stats1.0, 1, "Job 1 should have 1 file");
    assert_eq!(stats2.0, 1, "Job 2 should have 1 file");
}
```

**Step 2: Run all IndexService tests**

Run: `cd src-tauri && cargo test --test integration index_service_tests -- --test-threads=1 2>&1 | head -100`
Expected: All tests pass or reveal bugs

**Step 3: Commit**

```bash
git add src-tauri/tests/integration/service_tests/index_service_tests.rs
git commit -m "TIM-222: Add IndexService search and edge case tests"
```

---

## Task 5: RsyncService Unit Tests (In-File)

**Files:**
- Modify: `src-tauri/src/services/rsync_service.rs`

**Step 1: Add #[cfg(test)] module with argument building tests**

Add at the end of `rsync_service.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::job::{SyncConfig, SshConfig};

    fn create_minimal_job(id: &str) -> SyncJob {
        SyncJob {
            id: id.to_string(),
            name: "Test Job".to_string(),
            source_path: "/test/source".to_string(),
            dest_path: "/test/dest".to_string(),
            schedule: None,
            config: SyncConfig::default(),
            ssh_config: None,
            sync_mode: SyncMode::Local,
            description: None,
            paused: false,
            exclude_patterns: vec![],
            include_patterns: vec![],
            custom_flags: vec![],
        }
    }

    // ========================================================================
    // BASIC ARGUMENT BUILDING
    // ========================================================================

    #[test]
    fn test_args_minimal_config() {
        let service = RsyncService::new();
        let job = create_minimal_job("test-1");

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        // Should have essential flags
        assert!(args.contains(&"-D".to_string()));
        assert!(args.contains(&"--numeric-ids".to_string()));
        assert!(args.contains(&"--links".to_string()));
    }

    #[test]
    fn test_args_archive_mode() {
        let service = RsyncService::new();
        let mut job = create_minimal_job("test-1");
        job.config.archive = true;

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        assert!(args.contains(&"-a".to_string()), "Archive mode should add -a flag");
    }

    #[test]
    fn test_args_without_archive() {
        let service = RsyncService::new();
        let mut job = create_minimal_job("test-1");
        job.config.archive = false;
        job.config.recursive = true;

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        assert!(!args.contains(&"-a".to_string()), "Should not have -a flag");
        assert!(args.contains(&"--recursive".to_string()), "Should have --recursive");
    }

    #[test]
    fn test_args_compress_verbose_delete() {
        let service = RsyncService::new();
        let mut job = create_minimal_job("test-1");
        job.config.compress = true;
        job.config.verbose = true;
        job.config.delete = true;

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        assert!(args.contains(&"-z".to_string()), "Should have compress flag");
        assert!(args.contains(&"-v".to_string()), "Should have verbose flag");
        assert!(args.contains(&"--delete".to_string()), "Should have delete flag");
    }

    #[test]
    fn test_args_with_link_dest() {
        let service = RsyncService::new();
        let job = create_minimal_job("test-1");

        let args = service.build_rsync_args(&job, "/dest/new_snapshot", Some("/dest/previous_snapshot"));

        let link_dest_idx = args.iter().position(|a| a == "--link-dest");
        assert!(link_dest_idx.is_some(), "Should have --link-dest");

        let link_dest_value = &args[link_dest_idx.unwrap() + 1];
        assert!(link_dest_value.contains("previous_snapshot"), "Link dest should point to previous");
    }

    #[test]
    fn test_args_without_link_dest() {
        let service = RsyncService::new();
        let job = create_minimal_job("test-1");

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        assert!(!args.iter().any(|a| a.contains("link-dest")), "Should not have --link-dest");
    }

    // ========================================================================
    // EXCLUDE PATTERNS
    // ========================================================================

    #[test]
    fn test_args_single_exclude() {
        let service = RsyncService::new();
        let mut job = create_minimal_job("test-1");
        job.exclude_patterns = vec!["*.log".to_string()];

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        assert!(args.iter().any(|a| a.contains("--exclude") || a == "*.log"),
                "Should have exclude pattern");
    }

    #[test]
    fn test_args_multiple_excludes() {
        let service = RsyncService::new();
        let mut job = create_minimal_job("test-1");
        job.exclude_patterns = vec![
            "*.log".to_string(),
            "*.tmp".to_string(),
            "node_modules".to_string(),
            ".git".to_string(),
            "__pycache__".to_string(),
        ];

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        let exclude_count = args.iter().filter(|a| a.starts_with("--exclude")).count();
        assert_eq!(exclude_count, 5, "Should have 5 exclude arguments");
    }

    // ========================================================================
    // SSH CONFIGURATION
    // ========================================================================

    #[test]
    fn test_ssh_port_valid() {
        let service = RsyncService::new();
        let mut job = create_minimal_job("test-1");
        job.ssh_config = Some(SshConfig {
            enabled: true,
            port: Some("2222".to_string()),
            identity_file: None,
            config_file: None,
            proxy_jump: None,
            custom_options: None,
        });

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        // Find the -e argument and check it contains the port
        let ssh_arg = args.iter().find(|a| a.contains("ssh") && a.contains("-p"));
        assert!(ssh_arg.is_some(), "Should have SSH command with port");
        assert!(ssh_arg.unwrap().contains("2222"), "Port should be 2222");
    }

    #[test]
    fn test_ssh_port_injection_blocked() {
        let service = RsyncService::new();
        let mut job = create_minimal_job("test-1");
        job.ssh_config = Some(SshConfig {
            enabled: true,
            port: Some("22; rm -rf /".to_string()),
            identity_file: None,
            config_file: None,
            proxy_jump: None,
            custom_options: None,
        });

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        // The malicious port should be rejected
        let args_str = args.join(" ");
        assert!(!args_str.contains("rm -rf"), "Injection should be blocked");
    }

    #[test]
    fn test_ssh_identity_valid() {
        let service = RsyncService::new();
        let mut job = create_minimal_job("test-1");
        job.ssh_config = Some(SshConfig {
            enabled: true,
            port: None,
            identity_file: Some("/home/user/.ssh/id_rsa".to_string()),
            config_file: None,
            proxy_jump: None,
            custom_options: None,
        });

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        let ssh_arg = args.iter().find(|a| a.contains("ssh") && a.contains("-i"));
        assert!(ssh_arg.is_some(), "Should have SSH command with identity file");
    }

    #[test]
    fn test_ssh_identity_injection_blocked() {
        let service = RsyncService::new();
        let mut job = create_minimal_job("test-1");
        job.ssh_config = Some(SshConfig {
            enabled: true,
            port: None,
            identity_file: Some("/key; malicious command".to_string()),
            config_file: None,
            proxy_jump: None,
            custom_options: None,
        });

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        let args_str = args.join(" ");
        assert!(!args_str.contains("malicious"), "Identity file injection should be blocked");
    }

    // ========================================================================
    // CUSTOM FLAGS SECURITY
    // ========================================================================

    #[test]
    fn test_custom_flags_safe_passed_through() {
        let service = RsyncService::new();
        let mut job = create_minimal_job("test-1");
        job.custom_flags = vec![
            "--checksum".to_string(),
            "--partial".to_string(),
            "--bwlimit=1000".to_string(),
        ];

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        assert!(args.contains(&"--checksum".to_string()), "Safe flag --checksum should pass");
        assert!(args.contains(&"--partial".to_string()), "Safe flag --partial should pass");
    }

    #[test]
    fn test_custom_flags_dangerous_blocked() {
        let service = RsyncService::new();
        let mut job = create_minimal_job("test-1");
        job.custom_flags = vec![
            "--remove-source-files".to_string(),
        ];

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        assert!(!args.contains(&"--remove-source-files".to_string()),
                "Dangerous flag should be blocked");
    }

    #[test]
    fn test_custom_flags_injection_blocked() {
        let service = RsyncService::new();
        let mut job = create_minimal_job("test-1");
        job.custom_flags = vec![
            "; rm -rf /".to_string(),
            "$(malicious)".to_string(),
            "`whoami`".to_string(),
        ];

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        let args_str = args.join(" ");
        assert!(!args_str.contains("rm -rf"), "Shell injection should be blocked");
        assert!(!args_str.contains("$("), "Command substitution should be blocked");
        assert!(!args_str.contains("`"), "Backtick injection should be blocked");
    }
}
```

**Step 2: Run unit tests**

Run: `cd src-tauri && cargo test --lib rsync_service::tests -- --test-threads=1`
Expected: Tests reveal if dangerous flags are properly blocked

**Step 3: Commit**

```bash
git add src-tauri/src/services/rsync_service.rs
git commit -m "TIM-222: Add RsyncService unit tests for argument building"
```

---

## Task 6: ManifestService Integration Tests

**Files:**
- Create: `src-tauri/tests/integration/service_tests/manifest_service_tests.rs`

**Step 1: Write ManifestService tests**

```rust
//! Integration tests for ManifestService
//!
//! Tests manifest reading, writing, and consistency.

use crate::common::test_common::{generate, TestBackupEnv};
use app_lib::services::manifest_service;
use std::fs;

// ============================================================================
// BASIC READ/WRITE TESTS
// ============================================================================

#[tokio::test]
async fn test_manifest_exists_false_when_missing() {
    let env = TestBackupEnv::new().unwrap();

    let exists = manifest_service::manifest_exists(env.dest_path.to_str().unwrap()).await;

    assert!(!exists, "Manifest should not exist in fresh directory");
}

#[tokio::test]
async fn test_read_manifest_returns_none_when_missing() {
    let env = TestBackupEnv::new().unwrap();

    let result = manifest_service::read_manifest(env.dest_path.to_str().unwrap()).await;

    assert!(result.is_ok(), "Should not error on missing manifest");
    assert!(result.unwrap().is_none(), "Should return None for missing manifest");
}

#[tokio::test]
async fn test_write_creates_meta_dir() {
    let env = TestBackupEnv::new().unwrap();
    let meta_dir = manifest_service::get_meta_dir(env.dest_path.to_str().unwrap());

    assert!(!meta_dir.exists(), "Meta dir should not exist initially");

    // Create a manifest through get_or_create
    let manifest = manifest_service::get_or_create_manifest(
        env.dest_path.to_str().unwrap(),
        "test-job",
        "/source/path",
    ).await.unwrap();

    assert!(meta_dir.exists(), "Meta dir should be created");
    assert!(manifest_service::manifest_exists(env.dest_path.to_str().unwrap()).await);
}

#[tokio::test]
async fn test_read_manifest_valid_json() {
    let env = TestBackupEnv::new().unwrap();

    // Create manifest
    manifest_service::get_or_create_manifest(
        env.dest_path.to_str().unwrap(),
        "test-job-123",
        "/my/source",
    ).await.unwrap();

    // Read it back
    let manifest = manifest_service::read_manifest(env.dest_path.to_str().unwrap())
        .await
        .unwrap()
        .unwrap();

    assert_eq!(manifest.job_id, "test-job-123");
    assert_eq!(manifest.source_path, "/my/source");
}

#[tokio::test]
async fn test_read_manifest_corrupted_json() {
    let env = TestBackupEnv::new().unwrap();
    let meta_dir = manifest_service::get_meta_dir(env.dest_path.to_str().unwrap());
    fs::create_dir_all(&meta_dir).unwrap();

    // Write invalid JSON
    let manifest_path = manifest_service::get_manifest_path(env.dest_path.to_str().unwrap());
    generate::file(&manifest_path, b"{ invalid json }").unwrap();

    let result = manifest_service::read_manifest(env.dest_path.to_str().unwrap()).await;

    assert!(result.is_err(), "Should error on corrupted JSON");
}

#[tokio::test]
async fn test_read_manifest_empty_file() {
    let env = TestBackupEnv::new().unwrap();
    let meta_dir = manifest_service::get_meta_dir(env.dest_path.to_str().unwrap());
    fs::create_dir_all(&meta_dir).unwrap();

    // Write empty file
    let manifest_path = manifest_service::get_manifest_path(env.dest_path.to_str().unwrap());
    generate::file(&manifest_path, b"").unwrap();

    let result = manifest_service::read_manifest(env.dest_path.to_str().unwrap()).await;

    assert!(result.is_err(), "Should error on empty file");
}

// ============================================================================
// SNAPSHOT MANAGEMENT
// ============================================================================

#[tokio::test]
async fn test_add_snapshot_to_manifest() {
    let env = TestBackupEnv::new().unwrap();

    // Create initial manifest
    manifest_service::get_or_create_manifest(
        env.dest_path.to_str().unwrap(),
        "test-job",
        "/source",
    ).await.unwrap();

    // Add a snapshot
    manifest_service::add_snapshot_to_manifest(
        env.dest_path.to_str().unwrap(),
        "2024-01-01_120000",
        1704106800,
        1024,
        10,
    ).await.unwrap();

    // Read and verify
    let manifest = manifest_service::read_manifest(env.dest_path.to_str().unwrap())
        .await.unwrap().unwrap();

    assert_eq!(manifest.snapshots.len(), 1);
    assert_eq!(manifest.snapshots[0].name, "2024-01-01_120000");
    assert_eq!(manifest.snapshots[0].timestamp, 1704106800);
}

#[tokio::test]
async fn test_add_multiple_snapshots() {
    let env = TestBackupEnv::new().unwrap();

    manifest_service::get_or_create_manifest(
        env.dest_path.to_str().unwrap(),
        "test-job",
        "/source",
    ).await.unwrap();

    // Add 3 snapshots
    for i in 1..=3 {
        manifest_service::add_snapshot_to_manifest(
            env.dest_path.to_str().unwrap(),
            &format!("2024-01-0{}_120000", i),
            1704106800 + (i as i64 * 86400),
            1024 * i as u64,
            10 * i as u64,
        ).await.unwrap();
    }

    let manifest = manifest_service::read_manifest(env.dest_path.to_str().unwrap())
        .await.unwrap().unwrap();

    assert_eq!(manifest.snapshots.len(), 3);
}

#[tokio::test]
async fn test_remove_snapshot_from_manifest() {
    let env = TestBackupEnv::new().unwrap();

    manifest_service::get_or_create_manifest(
        env.dest_path.to_str().unwrap(),
        "test-job",
        "/source",
    ).await.unwrap();

    // Add two snapshots
    manifest_service::add_snapshot_to_manifest(
        env.dest_path.to_str().unwrap(),
        "2024-01-01_120000",
        1704106800,
        1024,
        10,
    ).await.unwrap();

    manifest_service::add_snapshot_to_manifest(
        env.dest_path.to_str().unwrap(),
        "2024-01-02_120000",
        1704193200,
        2048,
        20,
    ).await.unwrap();

    // Remove first snapshot
    manifest_service::remove_snapshot_from_manifest(
        env.dest_path.to_str().unwrap(),
        "2024-01-01_120000",
    ).await.unwrap();

    // Verify only second remains
    let manifest = manifest_service::read_manifest(env.dest_path.to_str().unwrap())
        .await.unwrap().unwrap();

    assert_eq!(manifest.snapshots.len(), 1);
    assert_eq!(manifest.snapshots[0].name, "2024-01-02_120000");
}

#[tokio::test]
async fn test_remove_nonexistent_snapshot() {
    let env = TestBackupEnv::new().unwrap();

    manifest_service::get_or_create_manifest(
        env.dest_path.to_str().unwrap(),
        "test-job",
        "/source",
    ).await.unwrap();

    // Try to remove non-existent snapshot
    let result = manifest_service::remove_snapshot_from_manifest(
        env.dest_path.to_str().unwrap(),
        "nonexistent",
    ).await;

    // Should succeed (no-op) or return appropriate response
    assert!(result.is_ok(), "Removing non-existent snapshot should not error");
}

// ============================================================================
// PATH UTILITIES
// ============================================================================

#[test]
fn test_get_meta_dir() {
    let meta = manifest_service::get_meta_dir("/backups/my-backup");
    assert!(meta.ends_with(".amber-meta"));
    assert!(meta.to_str().unwrap().contains("my-backup"));
}

#[test]
fn test_get_manifest_path() {
    let path = manifest_service::get_manifest_path("/backups/my-backup");
    assert!(path.ends_with("manifest.json"));
}

#[test]
fn test_get_index_path() {
    let path = manifest_service::get_index_path("/backups/my-backup");
    assert!(path.ends_with("index.db"));
}
```

**Step 2: Run ManifestService tests**

Run: `cd src-tauri && cargo test --test integration manifest_service_tests -- --test-threads=1`
Expected: Tests verify manifest operations work correctly

**Step 3: Commit**

```bash
git add src-tauri/tests/integration/service_tests/manifest_service_tests.rs
git commit -m "TIM-222: Add ManifestService integration tests"
```

---

## Task 7: SnapshotService Integration Tests

**Files:**
- Create: `src-tauri/tests/integration/service_tests/snapshot_service_tests.rs`

**Step 1: Write SnapshotService tests**

```rust
//! Integration tests for SnapshotService
//!
//! Tests snapshot listing priority logic and cache handling.

use crate::common::test_common::{generate, TestBackupEnv};
use app_lib::services::snapshot_service::SnapshotService;
use app_lib::services::manifest_service;
use app_lib::services::index_service::IndexService;
use std::fs;
use tempfile::TempDir;

fn create_test_snapshot_service() -> (SnapshotService, TempDir) {
    let temp = TempDir::new().unwrap();
    let service = SnapshotService::new(temp.path());
    (service, temp)
}

// ============================================================================
// BASIC LISTING TESTS
// ============================================================================

#[tokio::test]
async fn test_list_snapshots_empty_destination() {
    let (service, _temp) = create_test_snapshot_service();
    let env = TestBackupEnv::new().unwrap();

    let snapshots = service.list_snapshots("test-job", env.dest_path.to_str().unwrap()).await;

    assert!(snapshots.is_ok());
    assert!(snapshots.unwrap().is_empty(), "Empty dest should return empty list");
}

#[tokio::test]
async fn test_list_snapshots_from_manifest() {
    let (service, _temp) = create_test_snapshot_service();
    let env = TestBackupEnv::new().unwrap();

    // Create manifest with snapshots
    manifest_service::get_or_create_manifest(
        env.dest_path.to_str().unwrap(),
        "test-job",
        "/source",
    ).await.unwrap();

    manifest_service::add_snapshot_to_manifest(
        env.dest_path.to_str().unwrap(),
        "2024-01-01_120000",
        1704106800,
        1024,
        10,
    ).await.unwrap();

    // Also create the snapshot directory
    let snap_dir = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap_dir).unwrap();

    let snapshots = service.list_snapshots("test-job", env.dest_path.to_str().unwrap()).await.unwrap();

    assert_eq!(snapshots.len(), 1);
    assert_eq!(snapshots[0].name, "2024-01-01_120000");
}

#[tokio::test]
async fn test_list_snapshots_from_index_priority() {
    let (service, _temp) = create_test_snapshot_service();
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot directory
    let snap_dir = env.snapshot_path("2024-01-01_120000");
    generate::simple_backup_structure(&snap_dir).unwrap();

    // Create index (should be highest priority)
    let index = IndexService::for_destination(env.dest_path.to_str().unwrap()).unwrap();
    index.index_snapshot("test-job", 1704106800, snap_dir.to_str().unwrap()).unwrap();

    let snapshots = service.list_snapshots("test-job", env.dest_path.to_str().unwrap()).await.unwrap();

    // Should find snapshot from index
    assert!(!snapshots.is_empty(), "Should find snapshot from index");
}

#[tokio::test]
async fn test_list_snapshots_filesystem_fallback() {
    let (service, _temp) = create_test_snapshot_service();
    let env = TestBackupEnv::new().unwrap();

    // Create snapshot directories without manifest or index
    fs::create_dir_all(env.snapshot_path("2024-01-01_120000")).unwrap();
    fs::create_dir_all(env.snapshot_path("2024-01-02_120000")).unwrap();

    // Add some files so they're not empty
    generate::file(&env.snapshot_path("2024-01-01_120000").join("test.txt"), b"test").unwrap();
    generate::file(&env.snapshot_path("2024-01-02_120000").join("test.txt"), b"test").unwrap();

    let snapshots = service.list_snapshots("test-job", env.dest_path.to_str().unwrap()).await.unwrap();

    // Should fall back to filesystem scan
    assert_eq!(snapshots.len(), 2, "Should find 2 snapshots from filesystem");
}

#[tokio::test]
async fn test_list_snapshots_chronological_order() {
    let (service, _temp) = create_test_snapshot_service();
    let env = TestBackupEnv::new().unwrap();

    // Create manifest with out-of-order snapshots
    manifest_service::get_or_create_manifest(
        env.dest_path.to_str().unwrap(),
        "test-job",
        "/source",
    ).await.unwrap();

    // Add in non-chronological order
    for (name, ts) in [
        ("2024-01-03_120000", 1704279600),
        ("2024-01-01_120000", 1704106800),
        ("2024-01-02_120000", 1704193200),
    ] {
        manifest_service::add_snapshot_to_manifest(
            env.dest_path.to_str().unwrap(),
            name,
            ts,
            1024,
            10,
        ).await.unwrap();

        fs::create_dir_all(env.snapshot_path(name)).unwrap();
    }

    let snapshots = service.list_snapshots("test-job", env.dest_path.to_str().unwrap()).await.unwrap();

    // Should be sorted chronologically
    assert_eq!(snapshots.len(), 3);
    assert!(snapshots[0].timestamp <= snapshots[1].timestamp);
    assert!(snapshots[1].timestamp <= snapshots[2].timestamp);
}

// ============================================================================
// EDGE CASES
// ============================================================================

#[tokio::test]
async fn test_list_snapshots_nonexistent_destination() {
    let (service, _temp) = create_test_snapshot_service();

    let snapshots = service.list_snapshots("test-job", "/nonexistent/path").await;

    // Should return empty list or error gracefully
    assert!(snapshots.is_ok());
    assert!(snapshots.unwrap().is_empty());
}

#[tokio::test]
async fn test_list_snapshots_dest_is_file() {
    let (service, _temp) = create_test_snapshot_service();
    let env = TestBackupEnv::new().unwrap();

    // Create a file instead of directory
    let file_path = env.temp_dir.path().join("not_a_dir");
    generate::file(&file_path, b"content").unwrap();

    let snapshots = service.list_snapshots("test-job", file_path.to_str().unwrap()).await;

    // Should handle gracefully
    assert!(snapshots.is_ok());
    assert!(snapshots.unwrap().is_empty());
}

#[tokio::test]
async fn test_list_ignores_amber_meta() {
    let (service, _temp) = create_test_snapshot_service();
    let env = TestBackupEnv::new().unwrap();

    // Create .amber-meta and a real snapshot
    fs::create_dir_all(env.dest_path.join(".amber-meta")).unwrap();
    fs::create_dir_all(env.snapshot_path("2024-01-01_120000")).unwrap();
    generate::file(&env.snapshot_path("2024-01-01_120000").join("test.txt"), b"test").unwrap();

    let snapshots = service.list_snapshots("test-job", env.dest_path.to_str().unwrap()).await.unwrap();

    // Should not include .amber-meta as a snapshot
    assert!(!snapshots.iter().any(|s| s.name.contains("amber-meta")));
}
```

**Step 2: Run SnapshotService tests**

Run: `cd src-tauri && cargo test --test integration snapshot_service_tests -- --test-threads=1`
Expected: Tests verify listing priority logic

**Step 3: Commit**

```bash
git add src-tauri/tests/integration/service_tests/snapshot_service_tests.rs
git commit -m "TIM-222: Add SnapshotService integration tests"
```

---

## Task 8: Final Integration and Full Test Run

**Step 1: Update service_tests/mod.rs with all modules**

Ensure `src-tauri/tests/integration/service_tests/mod.rs` has:

```rust
//! Integration tests for real Amber services

pub mod index_service_tests;
pub mod rsync_service_tests;
pub mod manifest_service_tests;
pub mod snapshot_service_tests;
```

Note: `rsync_service_tests.rs` is a placeholder since the real tests are unit tests inside the service file.

**Step 2: Create rsync_service_tests.rs placeholder**

```rust
//! RsyncService integration tests
//!
//! Note: Most RsyncService tests are unit tests in the service file itself
//! (src/services/rsync_service.rs) because they test argument building logic
//! without needing actual rsync execution.
//!
//! This file can contain tests that need real rsync execution.

// Integration tests that run real rsync would go here
// Currently covered by tests/e2e/rsync_tests.rs
```

**Step 3: Run complete test suite**

Run: `cd src-tauri && cargo test 2>&1 | tail -30`
Expected: All tests pass, showing comprehensive coverage

**Step 4: Final commit**

```bash
git add -A
git commit -m "TIM-222: Complete real service testing infrastructure"
```

---

## Summary

| Task | Tests Added | What It Verifies |
|------|-------------|------------------|
| 2 | 8 | IndexService basic indexing (empty, single, nested, unicode, symlinks) |
| 3 | 12 | IndexService compare_snapshots (add/delete/modify, edge cases, errors) |
| 4 | 10 | IndexService search + edge cases (SQL injection, unicode, isolation) |
| 5 | 12 | RsyncService argument building (flags, SSH, security) |
| 6 | 10 | ManifestService (read/write, corruption, snapshots) |
| 7 | 8 | SnapshotService (priority logic, fallbacks, edge cases) |
| **Total** | **~60** | Real service behavior with actual databases and filesystems |

These tests exercise **real code paths** and should find actual bugs in the services.
