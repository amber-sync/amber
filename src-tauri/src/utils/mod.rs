//! Shared utility functions
//!
//! ## Path Conventions
//!
//! This module provides centralized path handling with consistent conventions:
//! - **ABSOLUTE**: Full filesystem path (e.g., `/Volumes/Backup/snap-2024-01-01/Users/john`)
//! - **RELATIVE**: Path relative to snapshot root (e.g., `Users/john`)
//! - **SSH_REMOTE**: user@host:/path format
//!
//! ## Storage Conventions
//!
//! - SQLite `files.path`: ABSOLUTE paths
//! - SQLite `files.parent_path`: RELATIVE paths (from snapshot root)
//! - SQLite `files.mtime`: Unix SECONDS (converted at API boundary)
//! - SQLite `snapshots.timestamp`: Unix MILLISECONDS
//! - Manifest timestamps: Unix MILLISECONDS

pub mod validation;

use std::path::Path;

// ============================================================================
// Path Utilities (TIM-122)
// ============================================================================

/// Check if a path is an SSH remote (user@host:/path format)
pub fn is_ssh_remote(path: &str) -> bool {
    !path.starts_with('/') && path.contains('@') && path.contains(':')
}

/// Extract the local path part from an SSH remote path
/// Returns `None` if the path is not an SSH remote
///
/// Example: `"user@host:/var/www"` -> `Some("/var/www")`
pub fn ssh_local_part(path: &str) -> Option<&str> {
    if is_ssh_remote(path) {
        path.split_once(':').map(|(_, local)| local)
    } else {
        None
    }
}

/// Make a path relative to a root directory
///
/// # Example
/// ```ignore
/// use std::path::Path;
/// assert_eq!(make_relative(Path::new("/a/b/c"), Path::new("/a/b")), "c");
/// assert_eq!(make_relative(Path::new("/a/b"), Path::new("/a/b")), "");
/// ```
pub fn make_relative(path: &Path, root: &Path) -> String {
    path.strip_prefix(root)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.to_string_lossy().to_string())
}

/// Reconstruct an absolute path from a relative path and root
///
/// # Example
/// ```ignore
/// assert_eq!(make_absolute("Users/john", "/Volumes/Backup"), "/Volumes/Backup/Users/john");
/// assert_eq!(make_absolute("", "/Volumes/Backup"), "/Volumes/Backup");
/// ```
pub fn make_absolute(relative: &str, root: &str) -> String {
    if relative.is_empty() {
        root.to_string()
    } else {
        format!("{}/{}", root.trim_end_matches('/'), relative)
    }
}

/// Join path segments, handling trailing slashes correctly
pub fn join_paths(base: &str, segment: &str) -> String {
    if segment.is_empty() {
        base.to_string()
    } else if base.ends_with('/') {
        format!("{}{}", base, segment)
    } else {
        format!("{}/{}", base, segment)
    }
}

// ============================================================================
// Machine ID
// ============================================================================

/// Get a unique machine identifier
/// Combines hostname with a hardware-based ID when available
pub fn get_machine_id() -> String {
    let hostname = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "unknown".to_string());

    // Try to get a hardware UUID on macOS
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
        {
            if let Ok(stdout) = String::from_utf8(output.stdout) {
                // Look for IOPlatformUUID
                for line in stdout.lines() {
                    if line.contains("IOPlatformUUID") {
                        if let Some(uuid) = line.split('"').nth(3) {
                            return format!("{}-{}", hostname, &uuid[..8.min(uuid.len())]);
                        }
                    }
                }
            }
        }
    }

    // Fallback: just use hostname
    hostname
}

/// Information about a volume/mount point
#[derive(Debug, Clone)]
pub struct VolumeInfo {
    /// Whether the path is on an external volume
    pub is_external: bool,
    /// Name of the volume (if external)
    pub volume_name: Option<String>,
}

/// Get volume information for a path
/// Returns whether it's external and the volume name if applicable
pub fn get_volume_info(path: &str) -> VolumeInfo {
    let is_external = path.starts_with("/Volumes/") && !path.starts_with("/Volumes/Macintosh HD");

    let volume_name = if is_external {
        path.strip_prefix("/Volumes/")
            .and_then(|rest| rest.split('/').next())
            .map(String::from)
    } else {
        None
    };

    VolumeInfo {
        is_external,
        volume_name,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ========== Path utility tests ==========

    #[test]
    fn test_is_ssh_remote() {
        assert!(is_ssh_remote("user@host:/path"));
        assert!(is_ssh_remote("user@192.168.1.1:/var/www"));
        assert!(!is_ssh_remote("/local/path"));
        assert!(!is_ssh_remote("relative/path"));
        assert!(!is_ssh_remote("user@host")); // Missing colon
        assert!(!is_ssh_remote("host:/path")); // Missing @
    }

    #[test]
    fn test_ssh_local_part() {
        assert_eq!(ssh_local_part("user@host:/var/www"), Some("/var/www"));
        assert_eq!(ssh_local_part("user@host:/"), Some("/"));
        assert_eq!(ssh_local_part("/local/path"), None);
    }

    #[test]
    fn test_make_relative() {
        assert_eq!(make_relative(Path::new("/a/b/c"), Path::new("/a/b")), "c");
        assert_eq!(make_relative(Path::new("/a/b"), Path::new("/a/b")), "");
        assert_eq!(
            make_relative(Path::new("/a/b/c/d"), Path::new("/a/b")),
            "c/d"
        );
        // Non-matching paths return the original
        assert_eq!(
            make_relative(Path::new("/x/y/z"), Path::new("/a/b")),
            "/x/y/z"
        );
    }

    #[test]
    fn test_make_absolute() {
        assert_eq!(
            make_absolute("Users/john", "/Volumes/Backup"),
            "/Volumes/Backup/Users/john"
        );
        assert_eq!(make_absolute("", "/Volumes/Backup"), "/Volumes/Backup");
        // Handles trailing slash
        assert_eq!(make_absolute("foo", "/root/"), "/root/foo");
    }

    #[test]
    fn test_join_paths() {
        assert_eq!(join_paths("/a/b", "c"), "/a/b/c");
        assert_eq!(join_paths("/a/b/", "c"), "/a/b/c");
        assert_eq!(join_paths("/a/b", ""), "/a/b");
    }

    // ========== Machine ID tests ==========

    #[test]
    fn test_get_machine_id() {
        let id = get_machine_id();
        assert!(!id.is_empty());
    }

    // ========== Volume info tests ==========

    #[test]
    fn test_volume_info_external() {
        let info = get_volume_info("/Volumes/MyBackup/folder");
        assert!(info.is_external);
        assert_eq!(info.volume_name, Some("MyBackup".to_string()));
    }

    #[test]
    fn test_volume_info_system() {
        let info = get_volume_info("/Volumes/Macintosh HD/Users/test");
        assert!(!info.is_external);
        assert_eq!(info.volume_name, None);
    }

    #[test]
    fn test_volume_info_local() {
        let info = get_volume_info("/Users/test/backups");
        assert!(!info.is_external);
        assert_eq!(info.volume_name, None);
    }
}
