//! Path traversal protection for filesystem operations
//!
//! This module prevents path traversal attacks by validating that requested paths
//! are within allowed directories. It handles:
//! - Path canonicalization (resolving `..`, `.`, symlinks)
//! - URL-encoded paths
//! - Null byte injection
//! - Various path manipulation techniques

use crate::error::{AmberError, Result};
use crate::types::job::SyncJob;
use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};

/// Path validator that maintains a list of allowed root directories
pub struct PathValidator {
    allowed_roots: HashSet<PathBuf>,
}

impl PathValidator {
    /// Create a new path validator with no allowed roots
    pub fn new() -> Self {
        Self {
            allowed_roots: HashSet::new(),
        }
    }

    /// Create a path validator with standard allowed directories
    ///
    /// This includes:
    /// - User's home directory
    /// - External volumes (/Volumes/*)
    /// - Application data directory
    pub fn with_standard_roots(app_data_dir: &Path) -> Result<Self> {
        let mut validator = Self::new();

        // Add home directory
        if let Some(home) = dirs::home_dir() {
            validator.add_root(&home)?;
        }

        // Add external volumes directory
        validator.add_root(Path::new("/Volumes"))?;

        // Add application data directory
        validator.add_root(app_data_dir)?;

        Ok(validator)
    }

    /// Create a path validator with job-specific roots
    ///
    /// Includes standard roots plus job source and destination paths
    pub fn with_job_roots(app_data_dir: &Path, jobs: &[SyncJob]) -> Result<Self> {
        let mut validator = Self::with_standard_roots(app_data_dir)?;

        // Add all job source and destination paths
        for job in jobs {
            // Only add local paths (skip SSH remotes)
            if !crate::utils::is_ssh_remote(&job.source_path) {
                if let Ok(canonical) = Path::new(&job.source_path).canonicalize() {
                    validator.allowed_roots.insert(canonical);
                }
            }

            if !crate::utils::is_ssh_remote(&job.dest_path) {
                if let Ok(canonical) = Path::new(&job.dest_path).canonicalize() {
                    validator.allowed_roots.insert(canonical);
                }
            }
        }

        Ok(validator)
    }

    /// Add an allowed root directory
    pub fn add_root(&mut self, path: &Path) -> Result<()> {
        let canonical = path.canonicalize().map_err(|e| {
            AmberError::InvalidPath(format!(
                "Cannot canonicalize root {}: {}",
                path.display(),
                e
            ))
        })?;

        self.allowed_roots.insert(canonical);
        Ok(())
    }

    /// Validate that a path is within allowed directories
    ///
    /// Returns the canonicalized path if valid, or an error if:
    /// - The path contains null bytes
    /// - The path cannot be canonicalized
    /// - The path is outside all allowed roots
    pub fn validate(&self, path: &str) -> Result<PathBuf> {
        let decoded = Self::decode_path(path)?;
        let path_obj = Path::new(decoded.as_ref());
        Self::ensure_absolute_and_clean(path_obj)?;

        let canonical = path_obj
            .canonicalize()
            .map_err(|e| AmberError::InvalidPath(format!("Cannot access path: {}", e)))?;

        self.ensure_allowed(&canonical)?;
        Ok(canonical)
    }

    /// Validate a target path that may not exist yet
    /// Ensures the nearest existing parent is within allowed roots
    pub fn validate_for_create(&self, path: &str) -> Result<PathBuf> {
        let decoded = Self::decode_path(path)?;
        let path_obj = Path::new(decoded.as_ref());
        Self::ensure_absolute_and_clean(path_obj)?;

        if path_obj.exists() {
            return self.validate(path);
        }

        let mut current = path_obj.to_path_buf();
        let mut missing_parts: Vec<String> = Vec::new();

        while !current.exists() {
            if let Some(name) = current.file_name() {
                missing_parts.push(name.to_string_lossy().to_string());
            }
            if !current.pop() {
                return Err(AmberError::InvalidPath(
                    "No existing parent directory for path".to_string(),
                ));
            }
        }

        let canonical_parent = current
            .canonicalize()
            .map_err(|e| AmberError::InvalidPath(format!("Cannot access parent path: {}", e)))?;
        self.ensure_allowed(&canonical_parent)?;

        let mut rebuilt = canonical_parent;
        for part in missing_parts.iter().rev() {
            rebuilt = rebuilt.join(part);
        }

        Ok(rebuilt)
    }

    /// Validate a path and return it as a string
    pub fn validate_str(&self, path: &str) -> Result<String> {
        self.validate(path).map(|p| p.to_string_lossy().to_string())
    }

    /// Validate a path for creation and return it as a string
    pub fn validate_str_for_create(&self, path: &str) -> Result<String> {
        self.validate_for_create(path)
            .map(|p| p.to_string_lossy().to_string())
    }

    fn decode_path(path: &str) -> Result<std::borrow::Cow<'_, str>> {
        if path.contains('\0') {
            return Err(AmberError::InvalidPath(
                "Path contains null byte".to_string(),
            ));
        }

        urlencoding::decode(path)
            .map_err(|e| AmberError::InvalidPath(format!("Invalid URL encoding: {}", e)))
    }

    fn ensure_absolute_and_clean(path: &Path) -> Result<()> {
        if !path.is_absolute() {
            return Err(AmberError::InvalidPath("Path must be absolute".to_string()));
        }

        for component in path.components() {
            match component {
                Component::ParentDir | Component::CurDir => {
                    return Err(AmberError::InvalidPath(
                        "Path contains relative components".to_string(),
                    ));
                }
                _ => {}
            }
        }

        Ok(())
    }

    fn ensure_allowed(&self, canonical: &Path) -> Result<()> {
        let is_allowed = self
            .allowed_roots
            .iter()
            .any(|root| canonical.starts_with(root));

        if !is_allowed {
            let allowed_list: Vec<String> = self
                .allowed_roots
                .iter()
                .map(|p| p.display().to_string())
                .collect();

            return Err(AmberError::PermissionDenied(format!(
                "Path '{}' is outside allowed directories. Allowed roots: {}",
                canonical.display(),
                allowed_list.join(", ")
            )));
        }

        Ok(())
    }
}

impl Default for PathValidator {
    fn default() -> Self {
        Self::new()
    }
}

/// Validate a path against allowed roots
///
/// This is a convenience function that creates a validator and validates the path.
/// For repeated validation, use `PathValidator` directly for better performance.
pub fn validate_path(path: &str, allowed_roots: &[&Path]) -> Result<PathBuf> {
    let mut validator = PathValidator::new();

    for root in allowed_roots {
        validator.add_root(root)?;
    }

    validator.validate(path)
}

/// Validate a target path against allowed roots (path may not exist yet)
pub fn validate_path_for_create(path: &str, allowed_roots: &[&Path]) -> Result<PathBuf> {
    let mut validator = PathValidator::new();

    for root in allowed_roots {
        validator.add_root(root)?;
    }

    validator.validate_for_create(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn setup_test_dir() -> PathBuf {
        // Use unique directory per test to avoid parallel test conflicts
        let id = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let thread_id = std::thread::current().id();
        let test_dir = std::env::temp_dir().join(format!("amber_path_test_{:?}_{}", thread_id, id));
        // Clean up first, ignore errors if doesn't exist
        let _ = fs::remove_dir_all(&test_dir);
        fs::create_dir_all(&test_dir).unwrap();
        test_dir
    }

    #[test]
    fn test_validate_valid_path() {
        let test_dir = setup_test_dir();
        let test_file = test_dir.join("test.txt");
        fs::write(&test_file, "test").unwrap();

        let mut validator = PathValidator::new();
        validator.add_root(&test_dir).unwrap();

        let result = validator.validate(test_file.to_str().unwrap());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_path_traversal() {
        let test_dir = setup_test_dir();
        let mut validator = PathValidator::new();
        validator.add_root(&test_dir).unwrap();

        // Try to access parent directory
        let evil_path = format!("{}/../../../etc/passwd", test_dir.display());
        let result = validator.validate(&evil_path);

        // Should fail because /etc/passwd is outside test_dir
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_null_byte() {
        let test_dir = setup_test_dir();
        let mut validator = PathValidator::new();
        validator.add_root(&test_dir).unwrap();

        let evil_path = format!("{}/test\0secret", test_dir.display());
        let result = validator.validate(&evil_path);

        assert!(matches!(result, Err(AmberError::InvalidPath(_))));
    }

    #[test]
    fn test_validate_url_encoded_traversal() {
        let test_dir = setup_test_dir();
        let mut validator = PathValidator::new();
        validator.add_root(&test_dir).unwrap();

        // %2e%2e = ".."
        let evil_path = format!("{}/%2e%2e/%2e%2e/etc/passwd", test_dir.display());
        let result = validator.validate(&evil_path);

        // Should fail after decoding
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_nonexistent_path() {
        let test_dir = setup_test_dir();
        let mut validator = PathValidator::new();
        validator.add_root(&test_dir).unwrap();

        let nonexistent = test_dir.join("does_not_exist.txt");
        let result = validator.validate(nonexistent.to_str().unwrap());

        // Should fail because path doesn't exist (can't canonicalize)
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_for_create_allows_missing_path() {
        let test_dir = setup_test_dir();
        let mut validator = PathValidator::new();
        validator.add_root(&test_dir).unwrap();

        let new_path = test_dir.join("new-folder/child");
        let result = validator.validate_for_create(new_path.to_str().unwrap());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_rejects_relative_path() {
        let test_dir = setup_test_dir();
        let mut validator = PathValidator::new();
        validator.add_root(&test_dir).unwrap();

        let result = validator.validate("relative/path");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_rejects_parent_components() {
        let test_dir = setup_test_dir();
        let mut validator = PathValidator::new();
        validator.add_root(&test_dir).unwrap();

        let path = format!("{}/../secret", test_dir.display());
        let result = validator.validate(&path);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_symlink_outside_root() {
        let test_dir = setup_test_dir();
        let outside_dir = std::env::temp_dir().join("amber_outside");
        let _ = fs::remove_dir_all(&outside_dir);
        fs::create_dir_all(&outside_dir).unwrap();

        let outside_file = outside_dir.join("secret.txt");
        fs::write(&outside_file, "secret").unwrap();

        let symlink_path = test_dir.join("symlink");
        // Clean up any existing symlink from previous test runs
        let _ = fs::remove_file(&symlink_path);

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            symlink(&outside_file, &symlink_path).unwrap();

            let mut validator = PathValidator::new();
            validator.add_root(&test_dir).unwrap();

            // Should fail because symlink points outside allowed root
            let result = validator.validate(symlink_path.to_str().unwrap());
            assert!(result.is_err());
        }

        // Cleanup
        let _ = fs::remove_file(&symlink_path);
        let _ = fs::remove_dir_all(&outside_dir);
    }

    #[test]
    fn test_validate_symlink_inside_root() {
        let test_dir = setup_test_dir();
        let target_file = test_dir.join("target.txt");
        fs::write(&target_file, "target").unwrap();

        let symlink_path = test_dir.join("symlink_inside");
        // Clean up any existing symlink from previous test runs
        let _ = fs::remove_file(&symlink_path);

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            symlink(&target_file, &symlink_path).unwrap();

            let mut validator = PathValidator::new();
            validator.add_root(&test_dir).unwrap();

            // Should succeed because symlink points inside allowed root
            let result = validator.validate(symlink_path.to_str().unwrap());
            assert!(result.is_ok());

            // Cleanup
            let _ = fs::remove_file(&symlink_path);
        }
    }

    #[test]
    fn test_validate_with_standard_roots() {
        let test_dir = setup_test_dir();
        let validator = PathValidator::with_standard_roots(&test_dir).unwrap();

        // Should allow home directory
        if let Some(home) = dirs::home_dir() {
            let home_file = home.join(".bashrc");
            // Only test if file exists
            if home_file.exists() {
                assert!(validator.validate(home_file.to_str().unwrap()).is_ok());
            }
        }
    }

    #[test]
    fn test_multiple_allowed_roots() {
        // Use unique directories to avoid parallel test conflicts
        let id = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let test_dir1 = std::env::temp_dir().join(format!("amber_multi_test1_{}", id));
        let test_dir2 = std::env::temp_dir().join(format!("amber_multi_test2_{}", id));

        let _ = fs::remove_dir_all(&test_dir1);
        let _ = fs::remove_dir_all(&test_dir2);
        fs::create_dir_all(&test_dir1).unwrap();
        fs::create_dir_all(&test_dir2).unwrap();

        let file1 = test_dir1.join("file1.txt");
        let file2 = test_dir2.join("file2.txt");

        fs::write(&file1, "test1").unwrap();
        fs::write(&file2, "test2").unwrap();

        let mut validator = PathValidator::new();
        validator.add_root(&test_dir1).unwrap();
        validator.add_root(&test_dir2).unwrap();

        // Both files should be accessible
        assert!(validator.validate(file1.to_str().unwrap()).is_ok());
        assert!(validator.validate(file2.to_str().unwrap()).is_ok());

        // Cleanup
        let _ = fs::remove_dir_all(&test_dir1);
        let _ = fs::remove_dir_all(&test_dir2);
    }

    #[test]
    fn test_quadruple_dots() {
        let test_dir = setup_test_dir();
        let mut validator = PathValidator::new();
        validator.add_root(&test_dir).unwrap();

        // Some systems handle "....", this should be caught by canonicalization
        let evil_path = format!("{}/..../..../etc/passwd", test_dir.display());
        let result = validator.validate(&evil_path);

        // Should fail - either doesn't exist or outside root
        assert!(result.is_err());
    }
}
