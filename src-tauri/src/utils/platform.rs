//! Platform-specific abstractions for cross-platform volume/mount support.
//!
//! macOS: External drives mount under `/Volumes/`
//! Linux: External drives mount under `/media/$USER/`, `/mnt/`, or `/run/media/$USER/`

#[cfg(target_os = "linux")]
use std::path::Path;
use std::path::PathBuf;

/// Returns directories where external volumes are mounted on this platform.
pub fn mount_root_paths() -> Vec<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        vec![PathBuf::from("/Volumes")]
    }

    #[cfg(target_os = "linux")]
    {
        let mut paths = vec![PathBuf::from("/mnt")];

        // /media/$USER is the standard automount location on most Linux desktops
        if let Some(user) = std::env::var("USER").ok().filter(|u| !u.is_empty()) {
            let media_user = PathBuf::from(format!("/media/{}", user));
            if media_user.exists() {
                paths.push(media_user);
            }
            let run_media = PathBuf::from(format!("/run/media/{}", user));
            if run_media.exists() {
                paths.push(run_media);
            }
        } else {
            // Fallback: check /media directly
            if Path::new("/media").exists() {
                paths.push(PathBuf::from("/media"));
            }
        }

        paths
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        vec![]
    }
}

/// Volume names to skip when listing external drives.
pub fn system_volume_names() -> &'static [&'static str] {
    #[cfg(target_os = "macos")]
    {
        &[
            "Macintosh HD",
            "Macintosh HD - Data",
            "Recovery",
            "Preboot",
            "VM",
            "Update",
        ]
    }

    #[cfg(not(target_os = "macos"))]
    {
        &[]
    }
}

/// Check if a path is on an external (non-system) volume.
pub fn is_external_path(path: &str) -> bool {
    #[cfg(target_os = "macos")]
    {
        path.starts_with("/Volumes/")
            && !system_volume_names()
                .iter()
                .any(|sv| path.starts_with(&format!("/Volumes/{}", sv)))
    }

    #[cfg(target_os = "linux")]
    {
        for root in mount_root_paths() {
            let prefix = format!("{}/", root.to_string_lossy());
            if path.starts_with(&prefix) {
                return true;
            }
        }
        false
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = path;
        false
    }
}

/// Check if a path is on the system drive (deletion not allowed).
#[allow(dead_code)]
pub fn is_system_path(path: &str) -> bool {
    #[cfg(target_os = "macos")]
    {
        // System drive or paths not under /Volumes
        !path.starts_with("/Volumes/")
            || system_volume_names()
                .iter()
                .any(|sv| path.starts_with(&format!("/Volumes/{}", sv)))
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, anything NOT under a mount root is considered system
        !is_external_path(path)
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = path;
        true
    }
}

/// Extract the volume name from a path, if it's on an external volume.
pub fn volume_name_from_path(path: &str) -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        if is_external_path(path) {
            path.strip_prefix("/Volumes/")
                .and_then(|rest| rest.split('/').next())
                .map(String::from)
        } else {
            None
        }
    }

    #[cfg(target_os = "linux")]
    {
        for root in mount_root_paths() {
            let prefix = format!("{}/", root.to_string_lossy());
            if let Some(rest) = path.strip_prefix(&prefix) {
                return rest.split('/').next().map(String::from);
            }
        }
        None
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = path;
        None
    }
}

/// Get a hardware-based UUID for this machine.
pub fn get_hardware_uuid() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
        {
            if let Ok(stdout) = String::from_utf8(output.stdout) {
                for line in stdout.lines() {
                    if line.contains("IOPlatformUUID") {
                        if let Some(uuid) = line.split('"').nth(3) {
                            return Some(uuid[..8.min(uuid.len())].to_string());
                        }
                    }
                }
            }
        }
        None
    }

    #[cfg(target_os = "linux")]
    {
        // /etc/machine-id is standard on systemd-based Linux
        if let Ok(id) = std::fs::read_to_string("/etc/machine-id") {
            let trimmed = id.trim();
            if !trimmed.is_empty() {
                return Some(trimmed[..8.min(trimmed.len())].to_string());
            }
        }
        // Fallback: /var/lib/dbus/machine-id
        if let Ok(id) = std::fs::read_to_string("/var/lib/dbus/machine-id") {
            let trimmed = id.trim();
            if !trimmed.is_empty() {
                return Some(trimmed[..8.min(trimmed.len())].to_string());
            }
        }
        None
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

/// Minimum path component depth required for safe deletion on external volumes.
/// Prevents deleting entire volumes (e.g., `/Volumes/DriveName` or `/media/user/drive`).
pub fn min_delete_depth() -> usize {
    // macOS: / + Volumes + DriveName + BackupDir = 4
    // Linux: / + media + user + drive + BackupDir = 5 (or / + mnt + drive + BackupDir = 4)
    4
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mount_root_paths_not_empty() {
        let paths = mount_root_paths();
        assert!(!paths.is_empty());
    }

    #[test]
    fn test_system_volume_names() {
        let names = system_volume_names();
        #[cfg(target_os = "macos")]
        assert!(names.contains(&"Macintosh HD"));
        #[cfg(target_os = "linux")]
        assert!(names.is_empty());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_external_path_macos() {
        assert!(is_external_path("/Volumes/MyBackup/folder"));
        assert!(!is_external_path("/Volumes/Macintosh HD/Users"));
        assert!(!is_external_path("/Users/test/backups"));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn test_external_path_linux() {
        assert!(is_external_path("/mnt/backup/folder"));
        assert!(!is_external_path("/home/user/backups"));
        assert!(!is_external_path("/etc/config"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_volume_name_macos() {
        assert_eq!(
            volume_name_from_path("/Volumes/MyBackup/folder"),
            Some("MyBackup".to_string())
        );
        assert_eq!(volume_name_from_path("/Users/test"), None);
    }

    #[test]
    fn test_hardware_uuid() {
        // Just verify it doesn't panic - result depends on platform
        let _uuid = get_hardware_uuid();
    }
}
