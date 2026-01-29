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
            #[cfg(windows)]
            {
                if src_path.is_dir() {
                    std::os::windows::fs::symlink_dir(&target, &dst_path)?;
                } else {
                    std::os::windows::fs::symlink_file(&target, &dst_path)?;
                }
            }
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

    #[test]
    fn test_snapshot_path() {
        let env = TestBackupEnv::new().unwrap();
        let snap_path = env.snapshot_path("2024-01-01_120000");
        assert!(snap_path.ends_with("dest/2024-01-01_120000"));
    }
}
