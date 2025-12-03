//! Shared utility functions

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
    let is_external =
        path.starts_with("/Volumes/") && !path.starts_with("/Volumes/Macintosh HD");

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

    #[test]
    fn test_get_machine_id() {
        let id = get_machine_id();
        assert!(!id.is_empty());
    }

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
