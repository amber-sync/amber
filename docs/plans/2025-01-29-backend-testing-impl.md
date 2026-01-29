# TIM-222: Backend Testing System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a rigorous 3-layer testing system for the Amber backup backend to ensure data integrity and safety.

**Architecture:** Test utilities module with helpers for creating test environments, verifying backups, and generating test data. Integration tests for critical services (rsync, snapshot, manifest, restore). Property-based tests for edge case discovery.

**Tech Stack:** Rust, rstest, tempfile, proptest, mockall, assert_fs

---

## Phase 1: Test Infrastructure

### Task 1: Add Test Dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: Add dev-dependencies**

Add these to the `[dev-dependencies]` section:

```toml
[dev-dependencies]
tempfile = "3"
tokio-test = "0.4"
criterion = { version = "0.8", features = ["html_reports"] }
rstest = "0.18"
assert_fs = "1.1"
predicates = "3.1"
proptest = "1.4"
```

**Step 2: Add test binaries configuration**

Add after the `[[bench]]` sections:

```toml
[[test]]
name = "integration"
path = "tests/integration/mod.rs"

[[test]]
name = "e2e"
path = "tests/e2e/mod.rs"
```

**Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "TIM-222: Add test framework dependencies"
```

---

### Task 2: Create Test Utilities - TestBackupEnv

**Files:**
- Modify: `src-tauri/tests/common/mod.rs`

**Step 1: Expand the common module with TestBackupEnv**

Replace the entire file with:

```rust
//! Common test utilities for backup testing
//!
//! Provides TestBackupEnv for creating isolated test environments,
//! verification utilities, and file generation helpers.

use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

pub mod generate;
pub mod verify;

/// A temporary backup environment for testing
///
/// Creates isolated source and destination directories that are
/// automatically cleaned up when the struct is dropped.
pub struct TestBackupEnv {
    pub temp_dir: TempDir,
    pub source_path: PathBuf,
    pub dest_path: PathBuf,
}

impl TestBackupEnv {
    /// Create a new empty test environment
    pub fn new() -> std::io::Result<Self> {
        let temp_dir = TempDir::new()?;
        let source_path = temp_dir.path().join("source");
        let dest_path = temp_dir.path().join("dest");

        fs::create_dir_all(&source_path)?;
        fs::create_dir_all(&dest_path)?;

        Ok(Self {
            temp_dir,
            source_path,
            dest_path,
        })
    }

    /// Create environment with files from a fixture directory
    pub fn with_fixture(fixture_name: &str) -> std::io::Result<Self> {
        let env = Self::new()?;
        let fixture_path = get_fixtures_path().join(fixture_name);

        if fixture_path.exists() {
            copy_dir_recursive(&fixture_path, &env.source_path)?;
        }

        Ok(env)
    }

    /// Create environment with randomly generated files
    pub fn with_random_files(count: usize, max_size: usize) -> std::io::Result<Self> {
        let env = Self::new()?;
        generate::random_files(&env.source_path, count, max_size)?;
        Ok(env)
    }

    /// Get path to a snapshot directory within dest
    pub fn snapshot_path(&self, name: &str) -> PathBuf {
        self.dest_path.join(name)
    }

    /// Get path to .amber-meta directory
    pub fn meta_path(&self) -> PathBuf {
        self.dest_path.join(".amber-meta")
    }
}

impl Default for TestBackupEnv {
    fn default() -> Self {
        Self::new().expect("Failed to create test environment")
    }
}

/// Get the path to test fixtures directory
pub fn get_fixtures_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

/// Recursively copy a directory
pub fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if file_type.is_file() {
            fs::copy(&src_path, &dst_path)?;
        } else if file_type.is_symlink() {
            let target = fs::read_link(&src_path)?;
            #[cfg(unix)]
            std::os::unix::fs::symlink(&target, &dst_path)?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backup_env_creates_directories() {
        let env = TestBackupEnv::new().unwrap();
        assert!(env.source_path.exists());
        assert!(env.dest_path.exists());
    }

    #[test]
    fn test_backup_env_cleanup_on_drop() {
        let path;
        {
            let env = TestBackupEnv::new().unwrap();
            path = env.temp_dir.path().to_path_buf();
            assert!(path.exists());
        }
        // After drop, temp dir should be cleaned up
        assert!(!path.exists());
    }
}
```

**Step 2: Verify compilation**

Run: `cd src-tauri && cargo check --tests`
Expected: Error about missing generate and verify modules (expected)

**Step 3: Commit partial progress**

```bash
git add src-tauri/tests/common/mod.rs
git commit -m "TIM-222: Add TestBackupEnv test utility"
```

---

### Task 3: Create Generate Module

**Files:**
- Create: `src-tauri/tests/common/generate.rs`

**Step 1: Create the file generation utilities**

```rust
//! File generation utilities for testing
//!
//! Functions to create test files, directories, and edge cases.

use rand::Rng;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

/// Create a file with specific content
pub fn file(path: &Path, content: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut file = File::create(path)?;
    file.write_all(content)?;
    Ok(())
}

/// Create a file with specific content and permissions (Unix)
#[cfg(unix)]
pub fn file_with_mode(path: &Path, content: &[u8], mode: u32) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;

    file(path, content)?;
    fs::set_permissions(path, fs::Permissions::from_mode(mode))?;
    Ok(())
}

#[cfg(not(unix))]
pub fn file_with_mode(path: &Path, content: &[u8], _mode: u32) -> std::io::Result<()> {
    file(path, content)
}

/// Create random files in a directory
pub fn random_files(root: &Path, count: usize, max_size: usize) -> std::io::Result<()> {
    let mut rng = rand::rng();

    for i in 0..count {
        let size = rng.random_range(0..=max_size);
        let content: Vec<u8> = (0..size).map(|_| rng.random()).collect();
        let filename = format!("file_{:04}.dat", i);
        file(&root.join(&filename), &content)?;
    }

    Ok(())
}

/// Create a nested directory structure
pub fn nested_dirs(root: &Path, depth: usize, files_per_dir: usize) -> std::io::Result<()> {
    create_nested_recursive(root, depth, files_per_dir, 0)
}

fn create_nested_recursive(
    current: &Path,
    max_depth: usize,
    files_per_dir: usize,
    current_depth: usize,
) -> std::io::Result<()> {
    fs::create_dir_all(current)?;

    // Create files in this directory
    for i in 0..files_per_dir {
        let content = format!("File {} at depth {}", i, current_depth);
        file(&current.join(format!("file_{}.txt", i)), content.as_bytes())?;
    }

    // Recurse if not at max depth
    if current_depth < max_depth {
        for i in 0..2 {
            let subdir = current.join(format!("dir_{}", i));
            create_nested_recursive(&subdir, max_depth, files_per_dir, current_depth + 1)?;
        }
    }

    Ok(())
}

/// Create files with unicode/special character names
pub fn unicode_files(root: &Path, count: usize) -> std::io::Result<()> {
    let unicode_names = [
        "émoji_🎉.txt",
        "中文文件.txt",
        "файл.txt",
        "αβγδ.txt",
        "file with spaces.txt",
        "file-with-dashes.txt",
        "file_with_underscores.txt",
        "file.multiple.dots.txt",
        "UPPERCASE.TXT",
        "MixedCase.Txt",
    ];

    for (i, name) in unicode_names.iter().take(count).enumerate() {
        let content = format!("Unicode file {}", i);
        file(&root.join(name), content.as_bytes())?;
    }

    Ok(())
}

/// Create symlinks (valid and broken)
#[cfg(unix)]
pub fn symlinks(root: &Path, valid: usize, broken: usize) -> std::io::Result<()> {
    use std::os::unix::fs::symlink;

    // Create target files for valid symlinks
    for i in 0..valid {
        let target = root.join(format!("target_{}.txt", i));
        file(&target, format!("Target {}", i).as_bytes())?;

        let link = root.join(format!("link_{}.txt", i));
        symlink(&target, &link)?;
    }

    // Create broken symlinks
    for i in 0..broken {
        let link = root.join(format!("broken_link_{}.txt", i));
        symlink(Path::new("/nonexistent/path"), &link)?;
    }

    Ok(())
}

#[cfg(not(unix))]
pub fn symlinks(_root: &Path, _valid: usize, _broken: usize) -> std::io::Result<()> {
    Ok(()) // No-op on non-Unix
}

/// Create an empty directory
pub fn empty_dir(path: &Path) -> std::io::Result<()> {
    fs::create_dir_all(path)
}

/// Create a simple backup structure for testing
pub fn simple_backup_structure(root: &Path) -> std::io::Result<()> {
    // Documents
    let docs = root.join("documents");
    file(&docs.join("readme.txt"), b"This is a readme file.")?;
    file(&docs.join("notes.md"), b"# Notes\n\nSome notes here.")?;

    // Code
    let code = root.join("code");
    file(&code.join("main.rs"), b"fn main() { println!(\"Hello\"); }")?;
    file(&code.join("lib.rs"), b"pub fn add(a: i32, b: i32) -> i32 { a + b }")?;

    // Config
    file(&root.join("config.json"), b"{\"version\": 1}")?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_create_file() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join("test.txt");
        file(&path, b"hello").unwrap();
        assert!(path.exists());
        assert_eq!(fs::read(&path).unwrap(), b"hello");
    }

    #[test]
    fn test_nested_dirs() {
        let temp = TempDir::new().unwrap();
        nested_dirs(temp.path(), 2, 2).unwrap();

        // Check structure exists
        assert!(temp.path().join("file_0.txt").exists());
        assert!(temp.path().join("dir_0/file_0.txt").exists());
        assert!(temp.path().join("dir_0/dir_0/file_0.txt").exists());
    }

    #[test]
    fn test_unicode_files() {
        let temp = TempDir::new().unwrap();
        unicode_files(temp.path(), 5).unwrap();

        // Count created files
        let count = fs::read_dir(temp.path()).unwrap().count();
        assert_eq!(count, 5);
    }
}
```

**Step 2: Verify compilation**

Run: `cd src-tauri && cargo check --tests`
Expected: Error about missing verify module (expected)

**Step 3: Commit**

```bash
git add src-tauri/tests/common/generate.rs
git commit -m "TIM-222: Add file generation test utilities"
```

---

### Task 4: Create Verify Module

**Files:**
- Create: `src-tauri/tests/common/verify.rs`

**Step 1: Create the verification utilities**

```rust
//! Verification utilities for backup testing
//!
//! Functions to compare directories, verify backup integrity,
//! and check manifest consistency.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;

/// Result of comparing two directories
#[derive(Debug, Default)]
pub struct DiffResult {
    pub only_in_a: Vec<String>,
    pub only_in_b: Vec<String>,
    pub different: Vec<String>,
    pub identical: Vec<String>,
}

impl DiffResult {
    pub fn is_identical(&self) -> bool {
        self.only_in_a.is_empty() && self.only_in_b.is_empty() && self.different.is_empty()
    }

    pub fn total_differences(&self) -> usize {
        self.only_in_a.len() + self.only_in_b.len() + self.different.len()
    }
}

/// Compare two directories recursively
pub fn compare_directories(a: &Path, b: &Path) -> std::io::Result<DiffResult> {
    let files_a = collect_files(a, a)?;
    let files_b = collect_files(b, b)?;

    let mut result = DiffResult::default();

    // Find files only in A or different
    for (rel_path, hash_a) in &files_a {
        match files_b.get(rel_path) {
            Some(hash_b) if hash_a == hash_b => {
                result.identical.push(rel_path.clone());
            }
            Some(_) => {
                result.different.push(rel_path.clone());
            }
            None => {
                result.only_in_a.push(rel_path.clone());
            }
        }
    }

    // Find files only in B
    for rel_path in files_b.keys() {
        if !files_a.contains_key(rel_path) {
            result.only_in_b.push(rel_path.clone());
        }
    }

    Ok(result)
}

/// Collect all files in a directory with their hashes
fn collect_files(root: &Path, base: &Path) -> std::io::Result<HashMap<String, u64>> {
    let mut files = HashMap::new();
    collect_files_recursive(root, base, &mut files)?;
    Ok(files)
}

fn collect_files_recursive(
    current: &Path,
    base: &Path,
    files: &mut HashMap<String, u64>,
) -> std::io::Result<()> {
    if !current.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        let rel_path = path.strip_prefix(base).unwrap().to_string_lossy().to_string();

        if path.is_dir() {
            collect_files_recursive(&path, base, files)?;
        } else if path.is_file() {
            let hash = hash_file(&path)?;
            files.insert(rel_path, hash);
        }
    }

    Ok(())
}

/// Simple hash of file contents (not cryptographic, just for comparison)
fn hash_file(path: &Path) -> std::io::Result<u64> {
    use std::hash::{Hash, Hasher};
    use std::collections::hash_map::DefaultHasher;

    let mut file = File::open(path)?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents)?;

    let mut hasher = DefaultHasher::new();
    contents.hash(&mut hasher);
    Ok(hasher.finish())
}

/// Verify backup integrity by comparing source to backup
pub fn verify_backup_integrity(source: &Path, backup: &Path) -> std::io::Result<Result<(), String>> {
    let diff = compare_directories(source, backup)?;

    if diff.is_identical() {
        Ok(Ok(()))
    } else {
        let mut errors = Vec::new();

        if !diff.only_in_a.is_empty() {
            errors.push(format!("Missing in backup: {:?}", diff.only_in_a));
        }
        if !diff.only_in_b.is_empty() {
            errors.push(format!("Extra in backup: {:?}", diff.only_in_b));
        }
        if !diff.different.is_empty() {
            errors.push(format!("Different content: {:?}", diff.different));
        }

        Ok(Err(errors.join("\n")))
    }
}

/// Count files in a directory recursively
pub fn count_files(path: &Path) -> std::io::Result<usize> {
    let mut count = 0;
    count_files_recursive(path, &mut count)?;
    Ok(count)
}

fn count_files_recursive(path: &Path, count: &mut usize) -> std::io::Result<()> {
    if !path.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            count_files_recursive(&path, count)?;
        } else if path.is_file() {
            *count += 1;
        }
    }

    Ok(())
}

/// Calculate total size of files in a directory
pub fn total_size(path: &Path) -> std::io::Result<u64> {
    let mut size = 0;
    total_size_recursive(path, &mut size)?;
    Ok(size)
}

fn total_size_recursive(path: &Path, size: &mut u64) -> std::io::Result<()> {
    if !path.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            total_size_recursive(&path, size)?;
        } else if path.is_file() {
            *size += fs::metadata(&path)?.len();
        }
    }

    Ok(())
}

/// Check if a file exists and has expected content
pub fn file_has_content(path: &Path, expected: &[u8]) -> std::io::Result<bool> {
    if !path.exists() {
        return Ok(false);
    }

    let mut file = File::open(path)?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents)?;

    Ok(contents == expected)
}

/// Check if a directory is empty
pub fn is_empty_dir(path: &Path) -> std::io::Result<bool> {
    Ok(path.is_dir() && fs::read_dir(path)?.next().is_none())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::common::generate;
    use tempfile::TempDir;

    #[test]
    fn test_compare_identical_directories() {
        let temp = TempDir::new().unwrap();
        let dir_a = temp.path().join("a");
        let dir_b = temp.path().join("b");

        generate::simple_backup_structure(&dir_a).unwrap();
        crate::common::copy_dir_recursive(&dir_a, &dir_b).unwrap();

        let diff = compare_directories(&dir_a, &dir_b).unwrap();
        assert!(diff.is_identical());
    }

    #[test]
    fn test_compare_different_directories() {
        let temp = TempDir::new().unwrap();
        let dir_a = temp.path().join("a");
        let dir_b = temp.path().join("b");

        generate::file(&dir_a.join("same.txt"), b"same content").unwrap();
        generate::file(&dir_a.join("only_a.txt"), b"only in a").unwrap();

        generate::file(&dir_b.join("same.txt"), b"same content").unwrap();
        generate::file(&dir_b.join("only_b.txt"), b"only in b").unwrap();

        let diff = compare_directories(&dir_a, &dir_b).unwrap();
        assert!(!diff.is_identical());
        assert_eq!(diff.only_in_a.len(), 1);
        assert_eq!(diff.only_in_b.len(), 1);
    }

    #[test]
    fn test_count_files() {
        let temp = TempDir::new().unwrap();
        generate::simple_backup_structure(temp.path()).unwrap();

        let count = count_files(temp.path()).unwrap();
        assert!(count >= 5); // At least 5 files in simple structure
    }
}
```

**Step 2: Verify compilation and run tests**

Run: `cd src-tauri && cargo test --tests common`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src-tauri/tests/common/verify.rs
git commit -m "TIM-222: Add verification test utilities"
```

---

### Task 5: Create Test Fixtures

**Files:**
- Create: `src-tauri/tests/fixtures/simple_backup/`
- Create: `src-tauri/tests/fixtures/edge_cases/`

**Step 1: Create simple backup fixture**

```bash
mkdir -p src-tauri/tests/fixtures/simple_backup/documents
mkdir -p src-tauri/tests/fixtures/simple_backup/code
```

Create `src-tauri/tests/fixtures/simple_backup/documents/readme.txt`:
```
This is a test readme file for backup testing.
It contains multiple lines.
And some special characters: áéíóú
```

Create `src-tauri/tests/fixtures/simple_backup/documents/notes.md`:
```
# Test Notes

This is a markdown file for testing.

- Item 1
- Item 2
- Item 3
```

Create `src-tauri/tests/fixtures/simple_backup/code/main.rs`:
```rust
fn main() {
    println!("Hello from test fixture!");
}
```

Create `src-tauri/tests/fixtures/simple_backup/config.json`:
```json
{
    "version": 1,
    "name": "test-config",
    "enabled": true
}
```

**Step 2: Create edge cases fixture**

```bash
mkdir -p src-tauri/tests/fixtures/edge_cases/empty_dir
mkdir -p "src-tauri/tests/fixtures/edge_cases/spaces in name"
```

Create `src-tauri/tests/fixtures/edge_cases/unicode_名前.txt`:
```
File with unicode in filename
```

Create `src-tauri/tests/fixtures/edge_cases/spaces in name/file.txt`:
```
File in directory with spaces
```

**Step 3: Commit fixtures**

```bash
git add src-tauri/tests/fixtures/
git commit -m "TIM-222: Add test fixtures"
```

---

### Task 6: Create Integration Test Structure

**Files:**
- Create: `src-tauri/tests/integration/mod.rs`
- Create: `src-tauri/tests/integration/rsync_tests.rs`

**Step 1: Create integration test entry point**

`src-tauri/tests/integration/mod.rs`:

```rust
//! Integration tests for Amber backup services
//!
//! These tests use real filesystem operations but may mock
//! external commands like rsync for speed and reliability.

mod rsync_tests;

// Re-export common utilities
#[path = "../common/mod.rs"]
mod common;
```

**Step 2: Create rsync integration tests**

`src-tauri/tests/integration/rsync_tests.rs`:

```rust
//! Integration tests for rsync_service

use crate::common::{generate, verify, TestBackupEnv};
use std::process::Command;

/// Test that rsync is available on the system
#[test]
fn rsync_is_available() {
    let output = Command::new("rsync")
        .arg("--version")
        .output()
        .expect("rsync should be installed");

    assert!(output.status.success(), "rsync --version should succeed");
}

/// Test basic backup creates exact copy
#[test]
fn backup_creates_exact_copy() {
    let env = TestBackupEnv::new().unwrap();

    // Create test files
    generate::simple_backup_structure(&env.source_path).unwrap();

    // Run rsync
    let output = Command::new("rsync")
        .args([
            "-av",
            "--",
            &format!("{}/", env.source_path.display()),
            &format!("{}/", env.dest_path.display()),
        ])
        .output()
        .expect("rsync should run");

    assert!(output.status.success(), "rsync should succeed");

    // Verify identical
    let diff = verify::compare_directories(&env.source_path, &env.dest_path).unwrap();
    assert!(diff.is_identical(), "Backup should be identical to source: {:?}", diff);
}

/// Test backup preserves file content exactly
#[test]
fn backup_preserves_content() {
    let env = TestBackupEnv::new().unwrap();

    let test_content = b"This is specific test content\nWith multiple lines\n";
    generate::file(&env.source_path.join("test.txt"), test_content).unwrap();

    // Run rsync
    Command::new("rsync")
        .args([
            "-av",
            "--",
            &format!("{}/", env.source_path.display()),
            &format!("{}/", env.dest_path.display()),
        ])
        .output()
        .expect("rsync should run");

    // Verify content
    assert!(
        verify::file_has_content(&env.dest_path.join("test.txt"), test_content).unwrap(),
        "File content should be preserved exactly"
    );
}

/// Test backup handles unicode filenames
#[test]
fn backup_handles_unicode_filenames() {
    let env = TestBackupEnv::new().unwrap();

    generate::unicode_files(&env.source_path, 5).unwrap();

    let output = Command::new("rsync")
        .args([
            "-av",
            "--",
            &format!("{}/", env.source_path.display()),
            &format!("{}/", env.dest_path.display()),
        ])
        .output()
        .expect("rsync should run");

    assert!(output.status.success(), "rsync should handle unicode");

    let diff = verify::compare_directories(&env.source_path, &env.dest_path).unwrap();
    assert!(diff.is_identical(), "Unicode files should be backed up correctly");
}

/// Test backup handles nested directories
#[test]
fn backup_handles_nested_directories() {
    let env = TestBackupEnv::new().unwrap();

    generate::nested_dirs(&env.source_path, 3, 2).unwrap();

    let source_count = verify::count_files(&env.source_path).unwrap();
    assert!(source_count > 10, "Should have nested files");

    Command::new("rsync")
        .args([
            "-av",
            "--",
            &format!("{}/", env.source_path.display()),
            &format!("{}/", env.dest_path.display()),
        ])
        .output()
        .expect("rsync should run");

    let dest_count = verify::count_files(&env.dest_path).unwrap();
    assert_eq!(source_count, dest_count, "File count should match");

    let diff = verify::compare_directories(&env.source_path, &env.dest_path).unwrap();
    assert!(diff.is_identical(), "Nested structure should be identical");
}

/// Test backup handles empty directories
#[test]
fn backup_handles_empty_directories() {
    let env = TestBackupEnv::new().unwrap();

    generate::empty_dir(&env.source_path.join("empty1")).unwrap();
    generate::empty_dir(&env.source_path.join("nested/empty2")).unwrap();
    generate::file(&env.source_path.join("file.txt"), b"content").unwrap();

    Command::new("rsync")
        .args([
            "-av",
            "--",
            &format!("{}/", env.source_path.display()),
            &format!("{}/", env.dest_path.display()),
        ])
        .output()
        .expect("rsync should run");

    assert!(env.dest_path.join("empty1").exists(), "Empty dir should exist");
    assert!(env.dest_path.join("nested/empty2").exists(), "Nested empty dir should exist");
}

#[cfg(unix)]
mod unix_tests {
    use super::*;

    /// Test backup handles symlinks
    #[test]
    fn backup_handles_symlinks() {
        let env = TestBackupEnv::new().unwrap();

        generate::symlinks(&env.source_path, 2, 0).unwrap();

        let output = Command::new("rsync")
            .args([
                "-av",
                "--links",
                "--",
                &format!("{}/", env.source_path.display()),
                &format!("{}/", env.dest_path.display()),
            ])
            .output()
            .expect("rsync should run");

        assert!(output.status.success(), "rsync should handle symlinks");

        // Check symlinks exist in dest
        assert!(env.dest_path.join("link_0.txt").exists(), "Symlink should be copied");
    }

    /// Test backup preserves permissions
    #[test]
    fn backup_preserves_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let env = TestBackupEnv::new().unwrap();

        generate::file_with_mode(&env.source_path.join("executable.sh"), b"#!/bin/bash\necho hi", 0o755).unwrap();
        generate::file_with_mode(&env.source_path.join("readonly.txt"), b"read only", 0o444).unwrap();

        Command::new("rsync")
            .args([
                "-av",
                "--perms",
                "--",
                &format!("{}/", env.source_path.display()),
                &format!("{}/", env.dest_path.display()),
            ])
            .output()
            .expect("rsync should run");

        let exec_perms = std::fs::metadata(env.dest_path.join("executable.sh"))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(exec_perms & 0o777, 0o755, "Executable permission should be preserved");
    }
}
```

**Step 3: Verify tests run**

Run: `cd src-tauri && cargo test --test integration`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src-tauri/tests/integration/
git commit -m "TIM-222: Add rsync integration tests"
```

---

### Task 7: Create E2E Test Structure

**Files:**
- Create: `src-tauri/tests/e2e/mod.rs`
- Create: `src-tauri/tests/e2e/backup_restore_tests.rs`

**Step 1: Create E2E test entry point**

`src-tauri/tests/e2e/mod.rs`:

```rust
//! End-to-end tests for complete backup/restore workflows
//!
//! These tests run real rsync operations and verify full workflows.

mod backup_restore_tests;

#[path = "../common/mod.rs"]
mod common;
```

**Step 2: Create backup/restore E2E tests**

`src-tauri/tests/e2e/backup_restore_tests.rs`:

```rust
//! End-to-end backup and restore tests

use crate::common::{generate, verify, TestBackupEnv};
use std::fs;
use std::process::Command;

/// Full backup -> modify -> backup -> restore workflow
#[test]
fn full_time_machine_workflow() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot1 = env.dest_path.join("snapshot_1");
    let snapshot2 = env.dest_path.join("snapshot_2");
    let restore_target = env.temp_dir.path().join("restored");

    // Step 1: Create initial files
    generate::simple_backup_structure(&env.source_path).unwrap();
    let original_file_content = b"Original content that will be deleted";
    generate::file(&env.source_path.join("will_be_deleted.txt"), original_file_content).unwrap();

    // Step 2: First backup
    fs::create_dir_all(&snapshot1).unwrap();
    let output = Command::new("rsync")
        .args([
            "-av",
            "--",
            &format!("{}/", env.source_path.display()),
            &format!("{}/", snapshot1.display()),
        ])
        .output()
        .expect("rsync should run");
    assert!(output.status.success(), "First backup should succeed");

    // Verify first backup
    let diff1 = verify::compare_directories(&env.source_path, &snapshot1).unwrap();
    assert!(diff1.is_identical(), "First backup should be identical");

    // Step 3: Modify source - delete a file and add a new one
    fs::remove_file(env.source_path.join("will_be_deleted.txt")).unwrap();
    generate::file(&env.source_path.join("new_file.txt"), b"New file content").unwrap();

    // Modify an existing file
    generate::file(&env.source_path.join("documents/readme.txt"), b"Modified readme content").unwrap();

    // Step 4: Second backup with link-dest (incremental)
    fs::create_dir_all(&snapshot2).unwrap();
    let output = Command::new("rsync")
        .args([
            "-av",
            &format!("--link-dest={}", snapshot1.display()),
            "--",
            &format!("{}/", env.source_path.display()),
            &format!("{}/", snapshot2.display()),
        ])
        .output()
        .expect("rsync should run");
    assert!(output.status.success(), "Second backup should succeed");

    // Step 5: Verify snapshots are different
    let snap_diff = verify::compare_directories(&snapshot1, &snapshot2).unwrap();
    assert!(!snap_diff.is_identical(), "Snapshots should be different");
    assert!(snap_diff.only_in_a.iter().any(|f| f.contains("will_be_deleted")),
        "Deleted file should only be in snapshot1");
    assert!(snap_diff.only_in_b.iter().any(|f| f.contains("new_file")),
        "New file should only be in snapshot2");

    // Step 6: Restore deleted file from first snapshot
    fs::create_dir_all(&restore_target).unwrap();
    let output = Command::new("rsync")
        .args([
            "-av",
            "--",
            &format!("{}/will_be_deleted.txt", snapshot1.display()),
            &format!("{}/", restore_target.display()),
        ])
        .output()
        .expect("rsync restore should run");
    assert!(output.status.success(), "Restore should succeed");

    // Step 7: Verify restored file is identical to original
    assert!(
        verify::file_has_content(&restore_target.join("will_be_deleted.txt"), original_file_content).unwrap(),
        "Restored file should have original content"
    );
}

/// Test restore to different location
#[test]
fn restore_to_different_location() {
    let env = TestBackupEnv::new().unwrap();
    let backup_path = env.dest_path.join("backup");
    let restore_path = env.temp_dir.path().join("alternate_restore");

    // Create and backup
    generate::simple_backup_structure(&env.source_path).unwrap();

    fs::create_dir_all(&backup_path).unwrap();
    Command::new("rsync")
        .args([
            "-av",
            "--",
            &format!("{}/", env.source_path.display()),
            &format!("{}/", backup_path.display()),
        ])
        .output()
        .expect("backup should run");

    // Restore to different location
    fs::create_dir_all(&restore_path).unwrap();
    let output = Command::new("rsync")
        .args([
            "-av",
            "--",
            &format!("{}/", backup_path.display()),
            &format!("{}/", restore_path.display()),
        ])
        .output()
        .expect("restore should run");

    assert!(output.status.success(), "Restore should succeed");

    // Verify restored matches original source
    let diff = verify::compare_directories(&env.source_path, &restore_path).unwrap();
    assert!(diff.is_identical(), "Restored should match original source");
}

/// Test partial restore of specific files
#[test]
fn partial_restore() {
    let env = TestBackupEnv::new().unwrap();
    let backup_path = env.dest_path.join("backup");
    let restore_path = env.temp_dir.path().join("partial_restore");

    // Create source with multiple files
    generate::file(&env.source_path.join("file1.txt"), b"File 1").unwrap();
    generate::file(&env.source_path.join("file2.txt"), b"File 2").unwrap();
    generate::file(&env.source_path.join("file3.txt"), b"File 3").unwrap();
    generate::file(&env.source_path.join("subdir/file4.txt"), b"File 4").unwrap();

    // Backup all
    fs::create_dir_all(&backup_path).unwrap();
    Command::new("rsync")
        .args([
            "-av",
            "--",
            &format!("{}/", env.source_path.display()),
            &format!("{}/", backup_path.display()),
        ])
        .output()
        .expect("backup should run");

    // Restore only file1 and subdir
    fs::create_dir_all(&restore_path).unwrap();
    let output = Command::new("rsync")
        .args([
            "-av",
            "--",
            &format!("{}/file1.txt", backup_path.display()),
            &format!("{}/", restore_path.display()),
        ])
        .output()
        .expect("partial restore should run");

    assert!(output.status.success(), "Partial restore should succeed");
    assert!(restore_path.join("file1.txt").exists(), "file1 should be restored");
    assert!(!restore_path.join("file2.txt").exists(), "file2 should NOT be restored");
    assert!(!restore_path.join("file3.txt").exists(), "file3 should NOT be restored");
}

/// Test backup with large number of files
#[test]
fn backup_many_files() {
    let env = TestBackupEnv::new().unwrap();

    // Create 100 random files
    generate::random_files(&env.source_path, 100, 1000).unwrap();

    let source_count = verify::count_files(&env.source_path).unwrap();
    assert_eq!(source_count, 100, "Should have 100 source files");

    // Backup
    let output = Command::new("rsync")
        .args([
            "-av",
            "--",
            &format!("{}/", env.source_path.display()),
            &format!("{}/", env.dest_path.display()),
        ])
        .output()
        .expect("rsync should run");

    assert!(output.status.success(), "Backup should succeed");

    let dest_count = verify::count_files(&env.dest_path).unwrap();
    assert_eq!(dest_count, 100, "Should backup all 100 files");

    let diff = verify::compare_directories(&env.source_path, &env.dest_path).unwrap();
    assert!(diff.is_identical(), "All files should be identical");
}
```

**Step 3: Verify tests run**

Run: `cd src-tauri && cargo test --test e2e`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src-tauri/tests/e2e/
git commit -m "TIM-222: Add E2E backup/restore tests"
```

---

## Phase 2: Service-Specific Tests (Summary)

After Phase 1 is complete, we'll add:

### Task 8: Manifest Service Tests
- `manifest_write_is_atomic`
- `manifest_validates_on_load`
- `manifest_survives_corruption`

### Task 9: Snapshot Service Tests
- `delete_requires_manifest_match`
- `delete_refuses_outside_dest`
- `list_returns_chronological_order`

### Task 10: Index Service Tests
- `compare_detects_changes`
- `index_rebuilds_from_filesystem`
- `browse_any_snapshot_instantly`

### Task 11: Property-Based Tests
- `backup_restore_roundtrip`
- `unicode_paths_handled`
- `random_file_structures`

---

## Verification Commands

```bash
# Run all tests
cd src-tauri && cargo test

# Run only unit tests (fast)
cd src-tauri && cargo test --lib

# Run integration tests
cd src-tauri && cargo test --test integration

# Run E2E tests (slower)
cd src-tauri && cargo test --test e2e

# Run with output
cd src-tauri && cargo test -- --nocapture
```
