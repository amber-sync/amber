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
        let size = if max_size > 0 {
            rng.random_range(0..=max_size)
        } else {
            0
        };
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
        "file_with_spaces.txt",
        "file-with-dashes.txt",
        "file_with_underscores.txt",
        "file.multiple.dots.txt",
        "UPPERCASE.TXT",
        "MixedCase.Txt",
        "émoji_file.txt",
        "中文文件.txt",
        "файл.txt",
        "αβγδ.txt",
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
    file(
        &code.join("lib.rs"),
        b"pub fn add(a: i32, b: i32) -> i32 { a + b }",
    )?;

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

    #[test]
    fn test_simple_backup_structure() {
        let temp = TempDir::new().unwrap();
        simple_backup_structure(temp.path()).unwrap();

        assert!(temp.path().join("documents/readme.txt").exists());
        assert!(temp.path().join("documents/notes.md").exists());
        assert!(temp.path().join("code/main.rs").exists());
        assert!(temp.path().join("code/lib.rs").exists());
        assert!(temp.path().join("config.json").exists());
    }

    #[test]
    fn test_random_files() {
        let temp = TempDir::new().unwrap();
        random_files(temp.path(), 10, 100).unwrap();

        let count = fs::read_dir(temp.path()).unwrap().count();
        assert_eq!(count, 10);
    }
}
