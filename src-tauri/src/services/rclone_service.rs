//! Rclone service for cloud backup destinations
//!
//! Handles rclone detection, remote listing, and sync operations.

use crate::error::{AmberError, Result};
use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::collections::HashMap;

/// Information about an rclone remote
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RcloneRemote {
    pub name: String,
    pub remote_type: String,
}

/// Rclone installation status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RcloneStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub config_path: Option<String>,
}

/// Progress information from rclone
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RcloneProgress {
    pub job_id: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub percent: f64,
    pub speed: String,
    pub eta: Option<String>,
    pub current_file: Option<String>,
}

pub struct RcloneService {
    active_jobs: Mutex<HashMap<String, u32>>,
}

impl RcloneService {
    pub fn new() -> Self {
        Self {
            active_jobs: Mutex::new(HashMap::new()),
        }
    }

    /// Check if rclone is installed and get its version
    pub fn check_installation(&self) -> Result<RcloneStatus> {
        let output = Command::new("rclone")
            .arg("version")
            .output();

        match output {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let version = stdout.lines().next().map(|s| s.to_string());

                // Get config path
                let config_output = Command::new("rclone")
                    .args(["config", "file"])
                    .output()
                    .ok();

                let config_path = config_output.and_then(|o| {
                    if o.status.success() {
                        let s = String::from_utf8_lossy(&o.stdout);
                        // Output format: "Configuration file is stored at:\n/path/to/rclone.conf"
                        s.lines().nth(1).map(|s| s.trim().to_string())
                    } else {
                        None
                    }
                });

                Ok(RcloneStatus {
                    installed: true,
                    version,
                    config_path,
                })
            }
            _ => Ok(RcloneStatus {
                installed: false,
                version: None,
                config_path: None,
            }),
        }
    }

    /// List all configured rclone remotes
    pub fn list_remotes(&self) -> Result<Vec<RcloneRemote>> {
        let output = Command::new("rclone")
            .args(["listremotes", "--long"])
            .output()?;

        if !output.status.success() {
            return Err(AmberError::Rclone(
                String::from_utf8_lossy(&output.stderr).to_string()
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let remotes: Vec<RcloneRemote> = stdout
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(2, ':').collect();
                if parts.len() >= 1 {
                    let name = parts[0].trim().to_string();
                    // The second part after colon contains the type
                    let remote_type = if parts.len() > 1 {
                        parts[1].trim().to_string()
                    } else {
                        "unknown".to_string()
                    };
                    Some(RcloneRemote { name, remote_type })
                } else {
                    None
                }
            })
            .collect();

        Ok(remotes)
    }

    /// Build rclone sync command
    fn build_sync_command(
        &self,
        source_path: &str,
        remote_name: &str,
        remote_path: Option<&str>,
        bandwidth: Option<&str>,
        _encrypt: bool, // TODO: Implement encryption support
    ) -> Command {
        let mut cmd = Command::new("rclone");

        cmd.arg("sync");
        cmd.arg(source_path);

        // Build destination: remote:path
        let dest = match remote_path {
            Some(path) if !path.is_empty() => format!("{}:{}", remote_name, path),
            _ => format!("{}:", remote_name),
        };
        cmd.arg(&dest);

        // Progress output for parsing
        cmd.arg("--progress");
        cmd.arg("--stats-one-line");
        cmd.arg("--stats=1s");

        // Verbose for better logging
        cmd.arg("-v");

        // Bandwidth limit
        if let Some(bw) = bandwidth {
            if !bw.is_empty() {
                cmd.arg("--bwlimit");
                cmd.arg(bw);
            }
        }

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        cmd
    }

    /// Start an rclone sync job
    pub fn spawn_sync(
        &self,
        job_id: &str,
        source_path: &str,
        remote_name: &str,
        remote_path: Option<&str>,
        bandwidth: Option<&str>,
        encrypt: bool,
    ) -> Result<Child> {
        let mut cmd = self.build_sync_command(
            source_path,
            remote_name,
            remote_path,
            bandwidth,
            encrypt,
        );

        let child = cmd.spawn()?;

        // Track the process
        if let Ok(mut jobs) = self.active_jobs.lock() {
            jobs.insert(job_id.to_string(), child.id());
        }

        Ok(child)
    }

    /// Kill a running rclone job
    pub fn kill_job(&self, job_id: &str) -> Result<()> {
        if let Ok(mut jobs) = self.active_jobs.lock() {
            if let Some(pid) = jobs.remove(job_id) {
                #[cfg(unix)]
                {
                    let _ = Command::new("kill")
                        .args(["-9", &pid.to_string()])
                        .status();
                }

                #[cfg(windows)]
                {
                    let _ = Command::new("taskkill")
                        .args(["/PID", &pid.to_string(), "/F"])
                        .status();
                }
            }
        }
        Ok(())
    }

    /// Mark a job as completed (remove from tracking)
    pub fn mark_completed(&self, job_id: &str) {
        if let Ok(mut jobs) = self.active_jobs.lock() {
            jobs.remove(job_id);
        }
    }
}

impl Default for RcloneService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_installation() {
        let service = RcloneService::new();
        let status = service.check_installation().unwrap();
        // Just check that it returns without error
        // installed may be true or false depending on system
        assert!(status.installed || !status.installed);
    }

    #[test]
    fn test_list_remotes_when_installed() {
        let service = RcloneService::new();
        let status = service.check_installation().unwrap();

        if status.installed {
            // Should not error even if no remotes configured
            let result = service.list_remotes();
            assert!(result.is_ok());
        }
    }
}
