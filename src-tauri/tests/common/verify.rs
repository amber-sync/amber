//! Verification utilities for backup testing
//!
//! Functions to compare directories, verify backup integrity,
//! and validate file contents.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;

/// Result of comparing two directories
#[derive(Debug, Default)]
pub struct DiffResult {
    /// Files only in the first directory
    pub only_in_a: Vec<String>,
    /// Files only in the second directory
    pub only_in_b: Vec<String>,
    /// Files that differ in content
    pub different: Vec<String>,
    /// Files that are identical
    pub identical: Vec<String>,
}

impl DiffResult {
    /// Check if directories are identical
    pub fn is_identical(&self) -> bool {
        self.only_in_a.is_empty() && self.only_in_b.is_empty() && self.different.is_empty()
    }

    /// Get total number of differences
    pub fn diff_count(&self) -> usize {
        self.only_in_a.len() + self.only_in_b.len() + self.different.len()
    }
}

/// Compare two directories recursively
///
/// Returns a DiffResult showing what files differ between the directories.
/// Symlinks are compared by their target path, not content.
pub fn compare_directories(a: &Path, b: &Path) -> std::io::Result<DiffResult> {
    let mut result = DiffResult::default();

    // Collect all files from both directories
    let files_a = collect_files(a, a)?;
    let files_b = collect_files(b, b)?;

    // Find files only in A
    for rel_path in files_a.keys() {
        if !files_b.contains_key(rel_path) {
            result.only_in_a.push(rel_path.clone());
        }
    }

    // Find files only in B
    for rel_path in files_b.keys() {
        if !files_a.contains_key(rel_path) {
            result.only_in_b.push(rel_path.clone());
        }
    }

    // Compare files in both
    for (rel_path, info_a) in &files_a {
        if let Some(info_b) = files_b.get(rel_path) {
            if info_a == info_b {
                result.identical.push(rel_path.clone());
            } else {
                result.different.push(rel_path.clone());
            }
        }
    }

    // Sort for consistent output
    result.only_in_a.sort();
    result.only_in_b.sort();
    result.different.sort();
    result.identical.sort();

    Ok(result)
}

/// Information about a file for comparison
#[derive(Debug, PartialEq, Eq)]
enum FileInfo {
    File { content_hash: u64 },
    Directory,
    Symlink { target: String },
}

/// Collect all files recursively with their info
fn collect_files(root: &Path, base: &Path) -> std::io::Result<HashMap<String, FileInfo>> {
    let mut files = HashMap::new();
    collect_files_recursive(root, base, &mut files)?;
    Ok(files)
}

fn collect_files_recursive(
    current: &Path,
    base: &Path,
    files: &mut HashMap<String, FileInfo>,
) -> std::io::Result<()> {
    if !current.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        let rel_path = path
            .strip_prefix(base)
            .map_err(std::io::Error::other)?
            .to_string_lossy()
            .to_string();

        let file_type = entry.file_type()?;

        if file_type.is_symlink() {
            let target = fs::read_link(&path)?;
            files.insert(
                rel_path,
                FileInfo::Symlink {
                    target: target.to_string_lossy().to_string(),
                },
            );
        } else if file_type.is_dir() {
            files.insert(rel_path.clone(), FileInfo::Directory);
            collect_files_recursive(&path, base, files)?;
        } else if file_type.is_file() {
            let hash = hash_file(&path)?;
            files.insert(rel_path, FileInfo::File { content_hash: hash });
        }
    }

    Ok(())
}

/// Simple hash function for file content comparison
fn hash_file(path: &Path) -> std::io::Result<u64> {
    let mut file = File::open(path)?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;

    // Simple FNV-1a hash
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in buffer {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }

    Ok(hash)
}

/// Verify that a backup is a complete copy of the source
pub fn verify_backup_integrity(source: &Path, backup: &Path) -> std::io::Result<()> {
    let diff = compare_directories(source, backup)?;

    if !diff.only_in_a.is_empty() {
        return Err(std::io::Error::other(format!(
            "Backup missing {} files: {:?}",
            diff.only_in_a.len(),
            &diff.only_in_a[..diff.only_in_a.len().min(5)]
        )));
    }

    if !diff.different.is_empty() {
        return Err(std::io::Error::other(format!(
            "Backup has {} different files: {:?}",
            diff.different.len(),
            &diff.different[..diff.different.len().min(5)]
        )));
    }

    Ok(())
}

/// Count files recursively in a directory
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
        let file_type = entry.file_type()?;

        if file_type.is_file() {
            *count += 1;
        } else if file_type.is_dir() {
            count_files_recursive(&entry.path(), count)?;
        }
    }

    Ok(())
}

/// Calculate total size of all files in a directory
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
        let file_type = entry.file_type()?;

        if file_type.is_file() {
            *size += entry.metadata()?.len();
        } else if file_type.is_dir() {
            total_size_recursive(&entry.path(), size)?;
        }
    }

    Ok(())
}

/// Check if a file exists and has the expected content
pub fn file_has_content(path: &Path, expected: &[u8]) -> bool {
    if let Ok(content) = fs::read(path) {
        content == expected
    } else {
        false
    }
}

/// Check if a file exists and matches a predicate
pub fn file_matches<F>(path: &Path, predicate: F) -> bool
where
    F: FnOnce(&[u8]) -> bool,
{
    if let Ok(content) = fs::read(path) {
        predicate(&content)
    } else {
        false
    }
}

/// Verify manifest consistency with snapshot directories
pub fn verify_manifest_consistency(
    manifest_path: &Path,
    snapshots_dir: &Path,
) -> std::io::Result<()> {
    // Read and parse manifest
    let manifest_content = fs::read_to_string(manifest_path)?;
    let manifest: serde_json::Value = serde_json::from_str(&manifest_content).map_err(|e| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("Invalid JSON: {}", e),
        )
    })?;

    // Get snapshots from manifest
    let manifest_snapshots: Vec<&str> = manifest
        .get("snapshots")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.get("name").and_then(|n| n.as_str()))
                .collect()
        })
        .unwrap_or_default();

    // Get actual snapshot directories
    let mut actual_snapshots: Vec<String> = Vec::new();
    if snapshots_dir.exists() {
        for entry in fs::read_dir(snapshots_dir)? {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                // Skip .amber-meta directory
                if !name.starts_with('.') {
                    actual_snapshots.push(name);
                }
            }
        }
    }

    // Compare
    let manifest_set: std::collections::HashSet<&str> = manifest_snapshots.into_iter().collect();
    let actual_set: std::collections::HashSet<&str> =
        actual_snapshots.iter().map(|s| s.as_str()).collect();

    let missing_in_fs: Vec<_> = manifest_set.difference(&actual_set).collect();
    let missing_in_manifest: Vec<_> = actual_set.difference(&manifest_set).collect();

    if !missing_in_fs.is_empty() {
        return Err(std::io::Error::other(format!(
            "Snapshots in manifest but not on filesystem: {:?}",
            missing_in_fs
        )));
    }

    if !missing_in_manifest.is_empty() {
        return Err(std::io::Error::other(format!(
            "Snapshots on filesystem but not in manifest: {:?}",
            missing_in_manifest
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::common::generate;
    use tempfile::TempDir;

    #[test]
    fn test_compare_identical_directories() {
        let temp_a = TempDir::new().unwrap();
        let temp_b = TempDir::new().unwrap();

        generate::file(&temp_a.path().join("test.txt"), b"hello").unwrap();
        generate::file(&temp_b.path().join("test.txt"), b"hello").unwrap();

        let diff = compare_directories(temp_a.path(), temp_b.path()).unwrap();
        assert!(diff.is_identical());
        assert_eq!(diff.identical.len(), 1);
    }

    #[test]
    fn test_compare_different_content() {
        let temp_a = TempDir::new().unwrap();
        let temp_b = TempDir::new().unwrap();

        generate::file(&temp_a.path().join("test.txt"), b"hello").unwrap();
        generate::file(&temp_b.path().join("test.txt"), b"world").unwrap();

        let diff = compare_directories(temp_a.path(), temp_b.path()).unwrap();
        assert!(!diff.is_identical());
        assert_eq!(diff.different.len(), 1);
    }

    #[test]
    fn test_compare_missing_files() {
        let temp_a = TempDir::new().unwrap();
        let temp_b = TempDir::new().unwrap();

        generate::file(&temp_a.path().join("a.txt"), b"a").unwrap();
        generate::file(&temp_a.path().join("both.txt"), b"both").unwrap();
        generate::file(&temp_b.path().join("b.txt"), b"b").unwrap();
        generate::file(&temp_b.path().join("both.txt"), b"both").unwrap();

        let diff = compare_directories(temp_a.path(), temp_b.path()).unwrap();
        assert!(!diff.is_identical());
        assert_eq!(diff.only_in_a, vec!["a.txt"]);
        assert_eq!(diff.only_in_b, vec!["b.txt"]);
        assert_eq!(diff.identical, vec!["both.txt"]);
    }

    #[test]
    fn test_verify_backup_integrity_success() {
        let temp_a = TempDir::new().unwrap();
        let temp_b = TempDir::new().unwrap();

        generate::simple_backup_structure(temp_a.path()).unwrap();
        generate::simple_backup_structure(temp_b.path()).unwrap();

        assert!(verify_backup_integrity(temp_a.path(), temp_b.path()).is_ok());
    }

    #[test]
    fn test_verify_backup_integrity_failure() {
        let temp_a = TempDir::new().unwrap();
        let temp_b = TempDir::new().unwrap();

        generate::simple_backup_structure(temp_a.path()).unwrap();
        // Leave temp_b empty

        let result = verify_backup_integrity(temp_a.path(), temp_b.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_count_files() {
        let temp = TempDir::new().unwrap();
        generate::simple_backup_structure(temp.path()).unwrap();

        let count = count_files(temp.path()).unwrap();
        assert_eq!(count, 5); // readme.txt, notes.md, main.rs, lib.rs, config.json
    }

    #[test]
    fn test_file_has_content() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join("test.txt");
        generate::file(&path, b"hello world").unwrap();

        assert!(file_has_content(&path, b"hello world"));
        assert!(!file_has_content(&path, b"wrong content"));
    }

    #[test]
    fn test_file_matches() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join("test.txt");
        generate::file(&path, b"hello world").unwrap();

        assert!(file_matches(&path, |content| content.starts_with(b"hello")));
        assert!(!file_matches(&path, |content| content.starts_with(b"bye")));
    }

    #[test]
    fn test_total_size() {
        let temp = TempDir::new().unwrap();
        generate::file(&temp.path().join("a.txt"), b"12345").unwrap();
        generate::file(&temp.path().join("b.txt"), b"67890").unwrap();

        let size = total_size(temp.path()).unwrap();
        assert_eq!(size, 10);
    }
}
