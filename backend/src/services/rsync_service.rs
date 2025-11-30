use crate::error::Result;
use crate::types::job::{SyncJob, SyncMode};
use chrono::Local;
use regex::Regex;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

const LATEST_SYMLINK_NAME: &str = "latest";

pub struct RsyncService {
    active_jobs: Arc<Mutex<HashMap<String, u32>>>, // job_id -> pid
}

impl RsyncService {
    pub fn new() -> Self {
        Self {
            active_jobs: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Build rsync arguments based on job configuration
    pub fn build_rsync_args(
        &self,
        job: &SyncJob,
        final_dest: &str,
        link_dest: Option<&str>,
    ) -> Vec<String> {
        let mut args = Vec::new();
        let conf = &job.config;

        // Check for custom command
        if let Some(ref custom) = conf.custom_command {
            if !custom.trim().is_empty() {
                return self.parse_custom_command(custom, &job.source_path, final_dest, link_dest);
            }
        }

        // Base flags
        args.extend([
            "-D".to_string(),
            "--numeric-ids".to_string(),
            "--links".to_string(),
            "--hard-links".to_string(),
            "--one-file-system".to_string(),
            "--itemize-changes".to_string(),
            "--stats".to_string(),
            "--human-readable".to_string(),
            "--progress".to_string(),
        ]);

        if conf.archive {
            args.push("-a".to_string());
        } else {
            if conf.recursive {
                args.push("--recursive".to_string());
            }
            args.extend([
                "--times".to_string(),
                "--perms".to_string(),
                "--owner".to_string(),
                "--group".to_string(),
            ]);
        }

        if conf.compress {
            args.push("-z".to_string());
        }
        if conf.verbose {
            args.push("-v".to_string());
        }
        if conf.delete {
            args.push("--delete".to_string());
        }

        // SSH config
        if let Some(ref ssh) = job.ssh_config {
            if ssh.enabled {
                let mut ssh_cmd = "ssh".to_string();
                if let Some(ref port) = ssh.port {
                    ssh_cmd.push_str(&format!(" -p {}", port));
                }
                if let Some(ref identity) = ssh.identity_file {
                    ssh_cmd.push_str(&format!(" -i {}", identity));
                }
                if let Some(ref config) = ssh.config_file {
                    ssh_cmd.push_str(&format!(" -F {}", config));
                }
                if let Some(ref proxy) = ssh.proxy_jump {
                    ssh_cmd.push_str(&format!(" -J {}", proxy));
                }
                if ssh.disable_host_key_checking == Some(true) {
                    ssh_cmd.push_str(
                        " -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null",
                    );
                }
                args.push("-e".to_string());
                args.push(ssh_cmd);
            }
        }

        // Link dest for Time Machine mode
        if let Some(link) = link_dest {
            if job.mode == SyncMode::TimeMachine {
                args.push(format!("--link-dest={}", link));
            }
        }

        // Exclude patterns
        for pattern in &conf.exclude_patterns {
            if !pattern.trim().is_empty() {
                args.push(format!("--exclude={}", pattern.trim()));
            }
        }

        // Source (with trailing slash)
        args.push(self.ensure_trailing_slash(&job.source_path));
        args.push(final_dest.to_string());

        args
    }

    fn parse_custom_command(
        &self,
        cmd: &str,
        source: &str,
        dest: &str,
        link_dest: Option<&str>,
    ) -> Vec<String> {
        let processed = cmd
            .replace("{source}", &self.ensure_trailing_slash(source))
            .replace("{dest}", dest)
            .replace("{linkDest}", link_dest.unwrap_or(""));

        shell_words::split(&processed).unwrap_or_else(|_| vec![processed])
    }

    fn ensure_trailing_slash(&self, path: &str) -> String {
        if path.ends_with('/') {
            path.to_string()
        } else {
            format!("{}/", path)
        }
    }

    /// Get the latest backup directory
    pub fn get_latest_backup(&self, dest_path: &str) -> Option<PathBuf> {
        let latest_link = Path::new(dest_path).join(LATEST_SYMLINK_NAME);

        if latest_link.exists() {
            if let Ok(target) = std::fs::read_link(&latest_link) {
                let resolved = if target.is_absolute() {
                    target
                } else {
                    Path::new(dest_path).join(&target)
                };
                if resolved.exists() {
                    return Some(resolved);
                }
            }
        }

        // Fall back to newest timestamp folder
        let backup_pattern = Regex::new(r"^\d{4}-\d{2}-\d{2}-\d{6}$").ok()?;

        let mut backups: Vec<_> = std::fs::read_dir(dest_path)
            .ok()?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .filter(|e| {
                e.file_name()
                    .to_str()
                    .map(|n| backup_pattern.is_match(n))
                    .unwrap_or(false)
            })
            .collect();

        backups.sort_by_key(|e| e.file_name());
        backups.last().map(|e| e.path())
    }

    /// Format current time as backup folder name
    pub fn format_backup_folder_name(&self) -> String {
        Local::now().format("%Y-%m-%d-%H%M%S").to_string()
    }

    /// Spawn rsync process
    pub fn spawn_rsync(&self, job: &SyncJob) -> Result<Child> {
        let source_basename = Path::new(&job.source_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("backup");

        let target_base = Path::new(&job.dest_path).join(source_basename);
        std::fs::create_dir_all(&target_base)?;

        let (final_dest, link_dest) = if job.mode == SyncMode::TimeMachine {
            let folder_name = self.format_backup_folder_name();
            let final_dest = target_base.join(&folder_name);
            let link_dest = self.get_latest_backup(target_base.to_str().unwrap_or(""));
            (final_dest, link_dest)
        } else {
            (target_base.clone(), None)
        };

        let args = self.build_rsync_args(
            job,
            final_dest.to_str().unwrap_or(""),
            link_dest.as_ref().and_then(|p| p.to_str()),
        );

        let child = Command::new("rsync")
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        // Track active job
        if let Ok(mut jobs) = self.active_jobs.lock() {
            jobs.insert(job.id.clone(), child.id());
        }

        Ok(child)
    }

    /// Kill a running job
    pub fn kill_job(&self, job_id: &str) -> Result<()> {
        if let Ok(mut jobs) = self.active_jobs.lock() {
            if let Some(pid) = jobs.remove(job_id) {
                #[cfg(unix)]
                {
                    use std::process::Command;
                    let _ = Command::new("kill").arg(pid.to_string()).status();
                }
            }
        }
        Ok(())
    }

    /// Check if job is running
    pub fn is_job_running(&self, job_id: &str) -> bool {
        if let Ok(jobs) = self.active_jobs.lock() {
            jobs.contains_key(job_id)
        } else {
            false
        }
    }

    /// Mark job as completed (remove from active)
    pub fn mark_completed(&self, job_id: &str) {
        if let Ok(mut jobs) = self.active_jobs.lock() {
            jobs.remove(job_id);
        }
    }

    /// Update latest symlink after successful backup
    pub fn update_latest_symlink(&self, target_base: &str, folder_name: &str) -> Result<()> {
        let link_path = Path::new(target_base).join(LATEST_SYMLINK_NAME);
        let _ = std::fs::remove_file(&link_path);

        #[cfg(unix)]
        std::os::unix::fs::symlink(folder_name, &link_path)?;

        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(folder_name, &link_path)?;

        Ok(())
    }
}

impl Default for RsyncService {
    fn default() -> Self {
        Self::new()
    }
}
