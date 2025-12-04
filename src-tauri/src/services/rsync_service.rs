use crate::error::Result;
use crate::types::job::{SyncJob, SyncMode};
use crate::utils::is_ssh_remote; // TIM-123: Use centralized path utility
use chrono::Local;
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const LATEST_SYMLINK_NAME: &str = "latest";

/// Safe rsync flags that are allowed in custom commands
/// SECURITY: These flags are explicitly allowlisted to prevent command injection
const SAFE_RSYNC_FLAGS: &[&str] = &[
    "-a", "--archive",
    "-v", "--verbose",
    "-z", "--compress",
    "-P", "--progress",
    "-n", "--dry-run",
    "-r", "--recursive",
    "-l", "--links",
    "-p", "--perms",
    "-t", "--times",
    "-g", "--group",
    "-o", "--owner",
    "-D", "--devices", "--specials",
    "-h", "--human-readable",
    "--delete",
    "--delete-before",
    "--delete-during",
    "--delete-after",
    "--delete-excluded",
    "--stats",
    "--itemize-changes",
    "--numeric-ids",
    "--hard-links",
    "--one-file-system",
    "--partial",
    "--update",
    "--inplace",
    "--append",
    "--ignore-existing",
    "--ignore-errors",
    "--force",
    "--max-size",
    "--min-size",
    "--timeout",
    "--block-size",
    "--exclude",
    "--include",
    "--filter",
    "--exclude-from",
    "--include-from",
    "--link-dest",
];

/// Info about a running or completed backup
#[derive(Debug, Clone)]
pub struct BackupInfo {
    pub job_id: String,
    pub folder_name: String,
    pub snapshot_path: PathBuf,
    pub target_base: PathBuf,
    pub start_time: i64,
}

/// Process monitoring information
#[derive(Debug, Clone)]
struct ProcessMonitor {
    pid: u32,
    start_time: Instant,
    last_activity: Instant,
    timeout_seconds: u64,
    stall_timeout_seconds: u64,
}

impl ProcessMonitor {
    fn new(pid: u32, timeout_seconds: u64, stall_timeout_seconds: u64) -> Self {
        let now = Instant::now();
        Self {
            pid,
            start_time: now,
            last_activity: now,
            timeout_seconds,
            stall_timeout_seconds,
        }
    }

    fn update_activity(&mut self) {
        self.last_activity = Instant::now();
    }

    fn is_timed_out(&self) -> bool {
        self.start_time.elapsed() > Duration::from_secs(self.timeout_seconds)
    }

    fn is_stalled(&self) -> bool {
        self.last_activity.elapsed() > Duration::from_secs(self.stall_timeout_seconds)
    }
}


/// RAII guard for atomic job reservation to prevent race conditions
///
/// This struct ensures that job reservations are either:
/// 1. Successfully updated with a real PID, or
/// 2. Automatically cleaned up on drop (if spawn fails)
struct JobReservation {
    job_id: String,
    active_jobs: Arc<Mutex<HashMap<String, u32>>>,
    consumed: bool,
}

impl JobReservation {
    /// Update reservation with the actual process ID
    fn update_pid(&mut self, pid: u32) {
        if let Ok(mut jobs) = self.active_jobs.lock() {
            jobs.insert(self.job_id.clone(), pid);
        }
        self.consumed = true;
    }

    /// Explicitly cancel the reservation
    fn cancel(mut self) {
        if let Ok(mut jobs) = self.active_jobs.lock() {
            jobs.remove(&self.job_id);
        }
        self.consumed = true;
    }
}

impl Drop for JobReservation {
    fn drop(&mut self) {
        // Auto-cleanup if reservation wasn't consumed
        if !self.consumed {
            if let Ok(mut jobs) = self.active_jobs.lock() {
                jobs.remove(&self.job_id);
            }
        }
    }
}

/// RAII guard for atomic backup info reservation
struct BackupInfoReservation {
    job_id: String,
    backup_info: Arc<Mutex<HashMap<String, BackupInfo>>>,
    consumed: bool,
}

impl BackupInfoReservation {
    /// Update reservation with actual backup info
    fn update_info(&mut self, info: BackupInfo) {
        if let Ok(mut map) = self.backup_info.lock() {
            map.insert(self.job_id.clone(), info);
        }
        self.consumed = true;
    }

    /// Explicitly cancel the reservation
    fn cancel(mut self) {
        if let Ok(mut map) = self.backup_info.lock() {
            map.remove(&self.job_id);
        }
        self.consumed = true;
    }
}

impl Drop for BackupInfoReservation {
    fn drop(&mut self) {
        // Auto-cleanup if reservation wasn't consumed
        if !self.consumed {
            if let Ok(mut map) = self.backup_info.lock() {
                map.remove(&self.job_id);
            }
        }
    }
}

pub struct RsyncService {
    active_jobs: Arc<Mutex<HashMap<String, u32>>>, // job_id -> pid
    backup_info: Arc<Mutex<HashMap<String, BackupInfo>>>, // job_id -> backup info
    process_monitors: Arc<Mutex<HashMap<String, ProcessMonitor>>>, // job_id -> monitor
    monitor_shutdown: Arc<Mutex<bool>>, // Signal to stop monitor thread
}

impl RsyncService {
    pub fn new() -> Self {
        let service = Self {
            active_jobs: Arc::new(Mutex::new(HashMap::new())),
            backup_info: Arc::new(Mutex::new(HashMap::new())),
            process_monitors: Arc::new(Mutex::new(HashMap::new())),
            monitor_shutdown: Arc::new(Mutex::new(false)),
        };

        // Start background monitor thread
        service.start_monitor_thread();
        service
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

        // SSH config - either explicit or auto-detected from remote path
        let ssh_enabled = job
            .ssh_config
            .as_ref()
            .map(|s| s.enabled)
            .unwrap_or(false);
        let auto_detect_ssh = is_ssh_remote(&job.source_path);

        if ssh_enabled || auto_detect_ssh {
            let mut ssh_cmd = "ssh".to_string();

            // Apply SSH config options if provided
            if let Some(ref ssh) = job.ssh_config {
                // Only add flags when values are non-empty
                if let Some(ref port) = ssh.port {
                    if !port.trim().is_empty() {
                        ssh_cmd.push_str(&format!(" -p {}", port));
                    }
                }
                if let Some(ref identity) = ssh.identity_file {
                    if !identity.trim().is_empty() {
                        ssh_cmd.push_str(&format!(" -i {}", identity));
                    }
                }
                if let Some(ref config) = ssh.config_file {
                    if !config.trim().is_empty() {
                        ssh_cmd.push_str(&format!(" -F {}", config));
                    }
                }
                if let Some(ref proxy) = ssh.proxy_jump {
                    if !proxy.trim().is_empty() {
                        ssh_cmd.push_str(&format!(" -J {}", proxy));
                    }
                }
                if ssh.disable_host_key_checking == Some(true) {
                    ssh_cmd.push_str(
                        " -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null",
                    );
                }
            }

            args.push("-e".to_string());
            args.push(ssh_cmd);
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

    /// Parse custom command with strict validation against safe flag allowlist
    /// SECURITY: This function validates all flags against SAFE_RSYNC_FLAGS to prevent command injection
    fn parse_custom_command(
        &self,
        cmd: &str,
        source: &str,
        dest: &str,
        link_dest: Option<&str>,
    ) -> Vec<String> {
        // Perform variable substitution
        let processed = cmd
            .replace("{source}", &self.ensure_trailing_slash(source))
            .replace("{dest}", dest)
            .replace("{linkDest}", link_dest.unwrap_or(""));

        // Parse the command into tokens
        let tokens = match shell_words::split(&processed) {
            Ok(tokens) => tokens,
            Err(_) => {
                log::error!("[rsync_service] Failed to parse custom command, ignoring it");
                return vec![];
            }
        };

        // Build allowlist set for efficient lookup
        let safe_flags: HashSet<&str> = SAFE_RSYNC_FLAGS.iter().copied().collect();

        let mut validated_args = Vec::new();

        for token in tokens {
            // Skip "rsync" command itself
            if token == "rsync" {
                continue;
            }

            // Check if this is a flag (starts with -)
            if token.starts_with('-') {
                // Extract the flag part (before = for flags like --exclude=pattern)
                let flag_part = if let Some(idx) = token.find('=') {
                    &token[..idx]
                } else {
                    &token
                };

                // SECURITY: Reject any flag not in the allowlist
                if !safe_flags.contains(flag_part) {
                    log::warn!(
                        "[rsync_service] Rejected unsafe flag '{}' in custom command. \
                        Only allowlisted flags are permitted.",
                        flag_part
                    );
                    // Return empty vec to reject the entire custom command
                    return vec![];
                }

                // SECURITY: Explicitly block dangerous flags that could enable command execution
                if flag_part == "-e" || flag_part == "--rsh" {
                    log::error!(
                        "[rsync_service] Rejected dangerous flag '{}' that enables command execution",
                        flag_part
                    );
                    return vec![];
                }

                validated_args.push(token);
            } else if token == source || token.starts_with(source) {
                // This is the source path
                validated_args.push(token);
            } else if token == dest || token.starts_with(dest) {
                // This is the dest path
                validated_args.push(token);
            } else {
                // This might be a value for a flag (e.g., pattern for --exclude)
                // or a malicious command injection attempt
                // We allow it only if the previous token was a flag that accepts values
                if let Some(last) = validated_args.last() {
                    if last.starts_with('-') && !last.contains('=') {
                        // Previous token was a flag without =, this could be its value
                        validated_args.push(token);
                    } else {
                        log::warn!(
                            "[rsync_service] Rejected unexpected token '{}' in custom command",
                            token
                        );
                        return vec![];
                    }
                } else {
                    log::warn!(
                        "[rsync_service] Rejected unexpected token '{}' at start of custom command",
                        token
                    );
                    return vec![];
                }
            }
        }

        // If validation passed, log and return
        log::info!(
            "[rsync_service] Custom command validated successfully: {} flags",
            validated_args.len()
        );
        validated_args
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

    /// Spawn rsync process with atomic job reservation to prevent race conditions
    pub fn spawn_rsync(&self, job: &SyncJob) -> Result<Child> {
        log::info!(
            "[rsync_service] spawn_rsync called for job '{}' (id: {})",
            job.name,
            job.id
        );

        // ATOMIC: Lock once, check AND reserve in same critical section
        let mut job_reservation = {
            let mut jobs = self.active_jobs.lock().map_err(|e| {
                crate::error::AmberError::Job(format!("Active jobs lock poisoned: {}", e))
            })?;

            if jobs.contains_key(&job.id) {
                log::warn!(
                    "[rsync_service] Job '{}' is already running, ignoring duplicate request",
                    job.name
                );
                return Err(crate::error::AmberError::JobAlreadyRunning(job.id.clone()));
            }

            // Reserve with placeholder PID (0) - prevents other threads from starting same job
            jobs.insert(job.id.clone(), 0);
            JobReservation {
                job_id: job.id.clone(),
                active_jobs: Arc::clone(&self.active_jobs),
                consumed: false,
            }
        };

        // ATOMIC: Reserve backup info slot
        let mut backup_reservation = {
            let mut info = self.backup_info.lock().map_err(|e| {
                crate::error::AmberError::Job(format!("Backup info lock poisoned: {}", e))
            })?;

            // Reserve backup info slot (prevents race on backup info)
            info.insert(
                job.id.clone(),
                BackupInfo {
                    job_id: job.id.clone(),
                    folder_name: String::new(),
                    snapshot_path: PathBuf::new(),
                    target_base: PathBuf::new(),
                    start_time: 0,
                },
            );
            BackupInfoReservation {
                job_id: job.id.clone(),
                backup_info: Arc::clone(&self.backup_info),
                consumed: false,
            }
        };

        log::info!(
            "[rsync_service] source_path: '{}', dest_path: '{}'",
            job.source_path,
            job.dest_path
        );

        // Now perform the actual spawn (can fail, but we have the reservation)
        match self.do_spawn_rsync(job) {
            Ok((child, backup_info)) => {
                // Update reservations with real data
                job_reservation.update_pid(child.id());
                backup_reservation.update_info(backup_info);
                log::info!(
                    "[rsync_service] rsync spawned successfully with PID: {}",
                    child.id()
                );
                Ok(child)
            }
            Err(e) => {
                // Cancel reservations on failure (will be auto-cleaned by Drop if not explicitly canceled)
                log::error!(
                    "[rsync_service] Failed to spawn rsync for job '{}': {}",
                    job.name,
                    e
                );
                job_reservation.cancel();
                backup_reservation.cancel();
                Err(e)
            }
        }
    }

    /// Internal method that does the actual rsync spawn work
    fn do_spawn_rsync(&self, job: &SyncJob) -> Result<(Child, BackupInfo)> {
        // For SSH remotes like "user@host:/path/to/dir", extract just the directory name
        let source_basename = if is_ssh_remote(&job.source_path) {
            // Extract path part after the colon, then get the last component
            job.source_path
                .split(':')
                .nth(1)
                .and_then(|path| Path::new(path).file_name())
                .and_then(|n| n.to_str())
                .unwrap_or("backup")
        } else {
            Path::new(&job.source_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("backup")
        };

        log::info!("[rsync_service] source_basename: '{}'", source_basename);

        let target_base = Path::new(&job.dest_path).join(source_basename);
        log::info!(
            "[rsync_service] target_base: '{}', creating directory...",
            target_base.display()
        );
        std::fs::create_dir_all(&target_base)?;
        log::info!("[rsync_service] Directory created successfully");

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

        log::info!(
            "[rsync_service] Spawning rsync with {} args: {:?}",
            args.len(),
            args
        );

        let child = Command::new("rsync")
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let backup_info = BackupInfo {
            job_id: job.id.clone(),
            folder_name,
            snapshot_path: final_dest,
            target_base,
            start_time: chrono::Utc::now().timestamp_millis(),
        };

        Ok((child, backup_info))
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
    use std::sync::Arc;
    use std::thread;

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

    #[test]
    fn test_is_ssh_remote_detection() {
        // Valid SSH remotes
        assert!(super::is_ssh_remote("user@host:/path"));
        assert!(super::is_ssh_remote("fmahner@iris.cbs.mpg.de:/home/fmahner"));
        assert!(super::is_ssh_remote("root@192.168.1.1:/var/backup"));

        // Not SSH remotes (local paths)
        assert!(!super::is_ssh_remote("/Users/demo/Documents"));
        assert!(!super::is_ssh_remote("/var/log"));
        assert!(!super::is_ssh_remote("relative/path"));
    }

    #[test]
    fn test_ssh_auto_detection_adds_e_flag() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.source_path = "user@remote:/path".to_string();
        job.ssh_config = None; // No explicit SSH config

        let args = service.build_rsync_args(&job, "/dest", None);

        // Should auto-detect SSH and add -e ssh
        let e_idx = args.iter().position(|a| a == "-e");
        assert!(e_idx.is_some(), "Should have -e flag for SSH remote");
        let ssh_cmd = &args[e_idx.unwrap() + 1];
        assert!(ssh_cmd.contains("ssh"), "Should use ssh command");
    }

    #[test]
    fn test_local_path_no_ssh_flag() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);
        job.source_path = "/local/path".to_string();
        job.ssh_config = None;

        let args = service.build_rsync_args(&job, "/dest", None);

        // Should NOT have -e flag for local path
        let e_idx = args.iter().position(|a| a == "-e");
        assert!(e_idx.is_none(), "Should NOT have -e flag for local path");
    }

    // ========== Duplicate Spawn Protection Tests ==========

    #[test]
    fn test_is_job_running_returns_false_for_new_job() {
        let service = RsyncService::new();
        let job_id = "test-job-1";

        // New job should not be marked as running
        assert!(!service.is_job_running(job_id), "New job should not be running");
    }

    #[test]
    fn test_is_job_running_returns_true_after_adding_to_active_jobs() {
        let service = RsyncService::new();
        let job_id = "test-job-2";
        let mock_pid = 12345u32;

        // Manually add job to active_jobs to simulate spawn
        {
            let mut jobs = service.active_jobs.lock().unwrap();
            jobs.insert(job_id.to_string(), mock_pid);
        }

        // Job should now be marked as running
        assert!(service.is_job_running(job_id), "Job should be running after adding to active_jobs");
    }

    #[test]
    fn test_spawn_rsync_returns_error_if_job_already_running() {
        let service = RsyncService::new();
        let job = create_test_job(SyncMode::Mirror);
        let mock_pid = 99999u32;

        // Simulate job already running by adding to active_jobs
        {
            let mut jobs = service.active_jobs.lock().unwrap();
            jobs.insert(job.id.clone(), mock_pid);
        }

        // Attempt to spawn should return JobAlreadyRunning error
        let result = service.spawn_rsync(&job);

        assert!(result.is_err(), "spawn_rsync should return error for duplicate job");

        match result.unwrap_err() {
            crate::error::AmberError::JobAlreadyRunning(id) => {
                assert_eq!(id, job.id, "Error should contain correct job ID");
            }
            other => panic!("Expected JobAlreadyRunning error, got: {:?}", other),
        }
    }

    #[test]
    fn test_mark_completed_removes_job_from_active_jobs() {
        let service = RsyncService::new();
        let job_id = "test-job-3";
        let mock_pid = 54321u32;

        // Add job to active_jobs
        {
            let mut jobs = service.active_jobs.lock().unwrap();
            jobs.insert(job_id.to_string(), mock_pid);
        }

        // Verify job is running
        assert!(service.is_job_running(job_id), "Job should be running before mark_completed");

        // Mark as completed
        service.mark_completed(job_id);

        // Verify job is no longer running
        assert!(!service.is_job_running(job_id), "Job should not be running after mark_completed");

        // Verify job was removed from HashMap
        {
            let jobs = service.active_jobs.lock().unwrap();
            assert!(!jobs.contains_key(job_id), "Job should be removed from active_jobs HashMap");
        }
    }

    #[test]
    fn test_kill_job_removes_job_from_active_jobs() {
        let service = RsyncService::new();
        let job_id = "test-job-4";
        let mock_pid = 11111u32;

        // Add job to active_jobs
        {
            let mut jobs = service.active_jobs.lock().unwrap();
            jobs.insert(job_id.to_string(), mock_pid);
        }

        // Verify job is running
        assert!(service.is_job_running(job_id), "Job should be running before kill_job");

        // Kill job (will fail to kill actual process, but should still remove from HashMap)
        let result = service.kill_job(job_id);
        assert!(result.is_ok(), "kill_job should succeed");

        // Verify job is no longer running
        assert!(!service.is_job_running(job_id), "Job should not be running after kill_job");

        // Verify job was removed from HashMap
        {
            let jobs = service.active_jobs.lock().unwrap();
            assert!(!jobs.contains_key(job_id), "Job should be removed from active_jobs HashMap");
        }
    }

    #[test]
    fn test_multiple_different_jobs_can_run_concurrently() {
        let service = RsyncService::new();
        let job_id_1 = "test-job-5";
        let job_id_2 = "test-job-6";
        let mock_pid_1 = 22222u32;
        let mock_pid_2 = 33333u32;

        // Add two different jobs to active_jobs
        {
            let mut jobs = service.active_jobs.lock().unwrap();
            jobs.insert(job_id_1.to_string(), mock_pid_1);
            jobs.insert(job_id_2.to_string(), mock_pid_2);
        }

        // Both jobs should be running
        assert!(service.is_job_running(job_id_1), "Job 1 should be running");
        assert!(service.is_job_running(job_id_2), "Job 2 should be running");

        // Complete first job
        service.mark_completed(job_id_1);

        // First job should be stopped, second still running
        assert!(!service.is_job_running(job_id_1), "Job 1 should be stopped");
        assert!(service.is_job_running(job_id_2), "Job 2 should still be running");
    }

    #[test]
    fn test_mark_completed_on_non_running_job_is_safe() {
        let service = RsyncService::new();
        let job_id = "non-existent-job";

        // Should not panic or error
        service.mark_completed(job_id);

        // Verify job is not running
        assert!(!service.is_job_running(job_id), "Non-existent job should not be running");
    }

    #[test]
    fn test_kill_job_on_non_running_job_is_safe() {
        let service = RsyncService::new();
        let job_id = "non-existent-job";

        // Should not panic or error
        let result = service.kill_job(job_id);
        assert!(result.is_ok(), "kill_job on non-existent job should succeed gracefully");

        // Verify job is not running
        assert!(!service.is_job_running(job_id), "Non-existent job should not be running");
    }

    #[test]
    fn test_backup_info_stored_and_retrieved() {
        let service = RsyncService::new();
        let job_id = "test-job-7";

        let backup_info = BackupInfo {
            job_id: job_id.to_string(),
            folder_name: "2024-03-15-120000".to_string(),
            snapshot_path: PathBuf::from("/dest/backup/2024-03-15-120000"),
            target_base: PathBuf::from("/dest/backup"),
            start_time: 1710504000000,
        };

        // Store backup info
        {
            let mut info = service.backup_info.lock().unwrap();
            info.insert(job_id.to_string(), backup_info.clone());
        }

        // Retrieve backup info
        let retrieved = service.get_backup_info(job_id);
        assert!(retrieved.is_some(), "Backup info should be retrievable");

        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.job_id, job_id);
        assert_eq!(retrieved.folder_name, "2024-03-15-120000");
        assert_eq!(retrieved.snapshot_path, PathBuf::from("/dest/backup/2024-03-15-120000"));
    }

    #[test]
    fn test_clear_backup_info_removes_entry() {
        let service = RsyncService::new();
        let job_id = "test-job-8";

        let backup_info = BackupInfo {
            job_id: job_id.to_string(),
            folder_name: "2024-03-15-120000".to_string(),
            snapshot_path: PathBuf::from("/dest/backup/2024-03-15-120000"),
            target_base: PathBuf::from("/dest/backup"),
            start_time: 1710504000000,
        };

        // Store backup info
        {
            let mut info = service.backup_info.lock().unwrap();
            info.insert(job_id.to_string(), backup_info);
        }

        // Verify it exists
        assert!(service.get_backup_info(job_id).is_some(), "Backup info should exist before clear");

        // Clear backup info
        service.clear_backup_info(job_id);

        // Verify it's removed
        assert!(service.get_backup_info(job_id).is_none(), "Backup info should be removed after clear");
    }

    // ========== Concurrency/Race Condition Tests ==========

    #[test]
    fn test_concurrent_spawn_attempts_blocked() {
        let service = Arc::new(RsyncService::new());
        let job_id = "concurrent-test-job";

        // Create barrier to synchronize threads
        let barrier = Arc::new(std::sync::Barrier::new(3));
        let mut handles = vec![];

        for i in 0..3 {
            let service = Arc::clone(&service);
            let barrier = Arc::clone(&barrier);
            let mut job = create_test_job(SyncMode::Mirror);
            job.id = job_id.to_string();

            let handle = thread::spawn(move || {
                // Wait for all threads to be ready
                barrier.wait();

                // All threads try to spawn the same job simultaneously
                let result = service.spawn_rsync(&job);
                (i, result)
            });
            handles.push(handle);
        }

        // Collect results
        let mut success_count = 0;
        let mut error_count = 0;

        for handle in handles {
            let (thread_id, result) = handle.join().unwrap();
            match result {
                Ok(_) => {
                    println!("Thread {} succeeded in spawning", thread_id);
                    success_count += 1;
                }
                Err(crate::error::AmberError::JobAlreadyRunning(_)) => {
                    println!("Thread {} blocked (job already running)", thread_id);
                    error_count += 1;
                }
                Err(e) => {
                    println!("Thread {} failed with unexpected error: {}", thread_id, e);
                }
            }
        }

        // Exactly one thread should succeed, others should be blocked
        // (Or all could fail if rsync not available, which is OK for this test)
        assert!(success_count <= 1, "More than one thread spawned the same job!");
        if success_count == 1 {
            assert_eq!(error_count, 2, "Expected 2 threads to be blocked");
        }
    }

    #[test]
    fn test_reservation_cleanup_on_spawn_failure() {
        let service = RsyncService::new();
        let mut job = create_test_job(SyncMode::Mirror);

        // Use invalid source path to force spawn failure
        job.source_path = "/nonexistent/invalid/path/that/does/not/exist".to_string();
        job.dest_path = "/tmp/test-dest".to_string();

        // Attempt to spawn (will fail due to invalid path)
        let result = service.spawn_rsync(&job);

        // Should return an error
        assert!(result.is_err(), "Spawn should fail with invalid path");

        // Job should NOT be in active_jobs after failure
        assert!(!service.is_job_running(&job.id),
            "Job should not be marked as running after spawn failure");

        // Verify cleanup happened
        {
            let jobs = service.active_jobs.lock().unwrap();
            assert!(!jobs.contains_key(&job.id),
                "Job should be removed from active_jobs after spawn failure");
        }

        // Backup info should also be cleaned up
        assert!(service.get_backup_info(&job.id).is_none(),
            "Backup info should be cleaned up after spawn failure");
    }
}
