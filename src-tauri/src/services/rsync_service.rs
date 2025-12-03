use crate::error::Result;
use crate::types::job::{SyncJob, SyncMode};
use chrono::Local;
use regex::Regex;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

const LATEST_SYMLINK_NAME: &str = "latest";

/// Info about a running or completed backup
#[derive(Debug, Clone)]
pub struct BackupInfo {
    pub job_id: String,
    pub folder_name: String,
    pub snapshot_path: PathBuf,
    pub target_base: PathBuf,
    pub start_time: i64,
}

pub struct RsyncService {
    active_jobs: Arc<Mutex<HashMap<String, u32>>>, // job_id -> pid
    backup_info: Arc<Mutex<HashMap<String, BackupInfo>>>, // job_id -> backup info
}

impl RsyncService {
    pub fn new() -> Self {
        Self {
            active_jobs: Arc::new(Mutex::new(HashMap::new())),
            backup_info: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Get backup info for a job (available after spawn_rsync)
    pub fn get_backup_info(&self, job_id: &str) -> Option<BackupInfo> {
        self.backup_info.lock().ok()?.get(job_id).cloned()
    }

    /// Remove backup info after completion
    pub fn clear_backup_info(&self, job_id: &str) {
        if let Ok(mut info) = self.backup_info.lock() {
            info.remove(job_id);
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

        let (final_dest, link_dest, folder_name) = if job.mode == SyncMode::TimeMachine {
            let folder_name = self.format_backup_folder_name();
            let final_dest = target_base.join(&folder_name);
            let link_dest = self.get_latest_backup(target_base.to_str().unwrap_or(""));
            (final_dest, link_dest, folder_name)
        } else {
            // For non-TimeMachine modes, use a consistent folder name
            let folder_name = "current".to_string();
            (target_base.clone(), None, folder_name)
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

        // Store backup info for later retrieval
        let backup_info = BackupInfo {
            job_id: job.id.clone(),
            folder_name,
            snapshot_path: final_dest,
            target_base,
            start_time: chrono::Utc::now().timestamp_millis(),
        };
        if let Ok(mut info) = self.backup_info.lock() {
            info.insert(job.id.clone(), backup_info);
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
                    // First try to kill the process group (handles child processes)
                    // Use SIGKILL (-9) to force termination
                    let _ = Command::new("kill")
                        .args(["-9", &format!("-{}", pid)]) // Negative PID kills process group
                        .status();

                    // Also kill the specific PID in case process group kill didn't work
                    let _ = Command::new("kill")
                        .args(["-9", &pid.to_string()])
                        .status();

                    // Additionally, try pkill to catch any orphaned rsync children
                    let _ = Command::new("pkill")
                        .args(["-9", "-P", &pid.to_string()])
                        .status();
                }

                #[cfg(windows)]
                {
                    use std::process::Command;
                    // On Windows, use taskkill with /T to kill child processes
                    let _ = Command::new("taskkill")
                        .args(["/PID", &pid.to_string(), "/T", "/F"])
                        .status();
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::job::{JobStatus, RsyncConfig, SshConfig, SyncJob, SyncMode};

    fn create_test_job(mode: SyncMode) -> SyncJob {
        SyncJob {
            id: "test-1".to_string(),
            name: "Test Job".to_string(),
            source_path: "/src".to_string(),
            dest_path: "/dest".to_string(),
            mode,
            status: JobStatus::Idle,
            destination_type: None,
            schedule_interval: None,
            schedule: None,
            config: RsyncConfig::default(),
            ssh_config: None,
            cloud_config: None,
            last_run: None,
            snapshots: None,
        }
    }

    #[test]
    fn test_basic_flags() {
        let service = RsyncService::new();
        let job = create_test_job(SyncMode::Mirror);
        let args = service.build_rsync_args(&job, "/dest", None);

        assert!(args.contains(&"-D".to_string()));
        assert!(args.contains(&"--numeric-ids".to_string()));
        assert!(args.contains(&"--links".to_string()));
        assert!(args.contains(&"--hard-links".to_string()));
        assert!(args.contains(&"--one-file-system".to_string()));
        assert!(args.contains(&"--itemize-changes".to_string()));
        assert!(args.contains(&"--stats".to_string()));
        assert!(args.contains(&"--human-readable".to_string()));
        assert!(args.contains(&"--progress".to_string()));
    }

    #[test]
    fn test_archive_mode_flag() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.config.archive = true;

        let args = service.build_rsync_args(&job, "/dest", None);
        assert!(args.contains(&"-a".to_string()));
    }

    #[test]
    fn test_compression_enabled() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.config.compress = true;

        let args = service.build_rsync_args(&job, "/dest", None);
        assert!(args.contains(&"-z".to_string()));
    }

    #[test]
    fn test_compression_disabled() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.config.compress = false;

        let args = service.build_rsync_args(&job, "/dest", None);
        assert!(!args.contains(&"-z".to_string()));
    }

    #[test]
    fn test_delete_flag() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.config.delete = true;

        let args = service.build_rsync_args(&job, "/dest", None);
        assert!(args.contains(&"--delete".to_string()));
    }

    #[test]
    fn test_no_delete_flag() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.config.delete = false;

        let args = service.build_rsync_args(&job, "/dest", None);
        assert!(!args.contains(&"--delete".to_string()));
    }

    #[test]
    fn test_verbose_flag() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.config.verbose = true;

        let args = service.build_rsync_args(&job, "/dest", None);
        assert!(args.contains(&"-v".to_string()));
    }

    #[test]
    fn test_ssh_config() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.ssh_config = Some(SshConfig {
            enabled: true,
            port: Some("2222".to_string()),
            identity_file: Some("/key".to_string()),
            config_file: Some("/config".to_string()),
            disable_host_key_checking: None,
            proxy_jump: None,
            custom_ssh_options: None,
        });

        let args = service.build_rsync_args(&job, "/dest", None);
        let e_idx = args.iter().position(|a| a == "-e").expect("-e flag missing");
        let ssh_cmd = &args[e_idx + 1];

        assert!(ssh_cmd.contains("ssh"));
        assert!(ssh_cmd.contains("-p 2222"));
        assert!(ssh_cmd.contains("-i /key"));
        assert!(ssh_cmd.contains("-F /config"));
    }

    #[test]
    fn test_ssh_strict_host_key_disable() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.ssh_config = Some(SshConfig {
            enabled: true,
            port: None,
            identity_file: None,
            config_file: None,
            disable_host_key_checking: Some(true),
            proxy_jump: None,
            custom_ssh_options: None,
        });

        let args = service.build_rsync_args(&job, "/dest", None);
        let e_idx = args.iter().position(|a| a == "-e").expect("-e flag missing");
        let ssh_cmd = &args[e_idx + 1];

        assert!(ssh_cmd.contains("StrictHostKeyChecking=no"));
    }

    #[test]
    fn test_ssh_proxy_jump() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.ssh_config = Some(SshConfig {
            enabled: true,
            port: None,
            identity_file: None,
            config_file: None,
            disable_host_key_checking: None,
            proxy_jump: Some("bastion@10.0.0.1".to_string()),
            custom_ssh_options: None,
        });

        let args = service.build_rsync_args(&job, "/dest", None);
        let e_idx = args.iter().position(|a| a == "-e").expect("-e flag missing");
        let ssh_cmd = &args[e_idx + 1];

        assert!(ssh_cmd.contains("-J bastion@10.0.0.1"));
    }

    #[test]
    fn test_time_machine_link_dest() {
        let service = RsyncService::new();
        let job = create_test_job(SyncMode::TimeMachine);

        let args = service.build_rsync_args(&job, "/dest/new-snapshot", Some("/dest/previous"));
        assert!(args.contains(&"--link-dest=/dest/previous".to_string()));
        assert!(args.contains(&"/dest/new-snapshot".to_string()));
    }

    #[test]
    fn test_time_machine_no_link_dest() {
        let service = RsyncService::new();
        let job = create_test_job(SyncMode::TimeMachine);

        let args = service.build_rsync_args(&job, "/dest/new-snapshot", None);
        let link_dest = args.iter().find(|a| a.starts_with("--link-dest"));
        assert!(link_dest.is_none());
    }

    #[test]
    fn test_exclude_patterns() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.config.exclude_patterns = vec!["*.log".to_string(), "temp/".to_string()];

        let args = service.build_rsync_args(&job, "/dest", None);
        assert!(args.contains(&"--exclude=*.log".to_string()));
        assert!(args.contains(&"--exclude=temp/".to_string()));
    }

    #[test]
    fn test_trailing_slash_on_source() {
        let service = RsyncService::new();
        let job = create_test_job(SyncMode::Mirror);

        let args = service.build_rsync_args(&job, "/dest", None);
        // Source should be second to last, dest last
        let source_idx = args.len() - 2;
        assert_eq!(args[source_idx], "/src/");
    }

    #[test]
    fn test_source_already_has_trailing_slash() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.source_path = "/src/".to_string();

        let args = service.build_rsync_args(&job, "/dest", None);
        let source_idx = args.len() - 2;
        assert_eq!(args[source_idx], "/src/");
    }

    #[test]
    fn test_custom_command_substitution() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::TimeMachine);
        job.config.custom_command = Some("rsync -a {source} {dest} --link-dest={linkDest}".to_string());

        let args = service.build_rsync_args(&job, "/dest/new", Some("/dest/old"));
        assert!(args.contains(&"/src/".to_string()));
        assert!(args.contains(&"/dest/new".to_string()));
        assert!(args.contains(&"--link-dest=/dest/old".to_string()));
    }

    #[test]
    fn test_custom_command_without_link_dest() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.config.custom_command = Some("rsync -a {source} {dest}".to_string());

        let args = service.build_rsync_args(&job, "/dest", None);
        assert_eq!(args[0], "rsync");
        assert!(args.contains(&"/src/".to_string()));
        assert!(args.contains(&"/dest".to_string()));
    }

    #[test]
    fn test_non_archive_mode_falls_back() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.config.archive = false;
        job.config.recursive = true;

        let args = service.build_rsync_args(&job, "/dest", None);
        assert!(!args.contains(&"-a".to_string()));
        assert!(args.contains(&"--recursive".to_string()));
        assert!(args.contains(&"--times".to_string()));
        assert!(args.contains(&"--perms".to_string()));
        assert!(args.contains(&"--owner".to_string()));
        assert!(args.contains(&"--group".to_string()));
    }

    #[test]
    fn test_backup_folder_name_format() {
        let service = RsyncService::new();
        let name = service.format_backup_folder_name();

        // Should match pattern YYYY-MM-DD-HHMMSS
        let re = Regex::new(r"^\d{4}-\d{2}-\d{2}-\d{6}$").unwrap();
        assert!(re.is_match(&name), "Folder name '{}' doesn't match expected format", name);
    }

    #[test]
    fn test_ensure_trailing_slash() {
        let service = RsyncService::new();

        assert_eq!(service.ensure_trailing_slash("/path"), "/path/");
        assert_eq!(service.ensure_trailing_slash("/path/"), "/path/");
        assert_eq!(service.ensure_trailing_slash(""), "/");
    }
}
