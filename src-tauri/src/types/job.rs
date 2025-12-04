use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SyncMode {
    Mirror,
    Archive,
    TimeMachine,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum JobStatus {
    Idle,
    Running,
    Success,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RsyncConfig {
    pub recursive: bool,
    pub compress: bool,
    pub archive: bool,
    pub delete: bool,
    pub verbose: bool,
    pub exclude_patterns: Vec<String>,
    pub link_dest: Option<String>,
    pub custom_flags: String,
    pub custom_command: Option<String>,
    /// Timeout in seconds (default: 3600 = 1 hour)
    #[serde(default = "default_timeout")]
    pub timeout_seconds: u64,
    /// Stall timeout - kill if no progress for this many seconds (default: 300 = 5 min)
    #[serde(default = "default_stall_timeout")]
    pub stall_timeout_seconds: u64,
}

fn default_timeout() -> u64 {
    3600 // 1 hour
}

fn default_stall_timeout() -> u64 {
    300 // 5 minutes
}

impl Default for RsyncConfig {
    fn default() -> Self {
        Self {
            recursive: true,
            compress: false,
            archive: true,
            delete: false,
            verbose: true,
            exclude_patterns: vec![],
            link_dest: None,
            custom_flags: String::new(),
            custom_command: None,
            timeout_seconds: default_timeout(),
            stall_timeout_seconds: default_stall_timeout(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConfig {
    pub enabled: bool,
    pub port: Option<String>,
    pub identity_file: Option<String>,
    pub config_file: Option<String>,
    pub disable_host_key_checking: Option<bool>,
    pub proxy_jump: Option<String>,
    pub custom_ssh_options: Option<String>,
}

impl Default for SshConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            port: None,
            identity_file: None,
            config_file: None,
            disable_host_key_checking: None,
            proxy_jump: None,
            custom_ssh_options: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobSchedule {
    pub enabled: bool,
    pub cron: Option<String>,
    pub run_on_mount: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DestinationType {
    Local,
    Cloud,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudConfig {
    pub remote_name: String,
    pub remote_path: Option<String>,
    pub encrypt: bool,
    pub encrypt_password_keychain: Option<String>,
    pub bandwidth: Option<String>,
    pub provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncJob {
    pub id: String,
    pub name: String,
    pub source_path: String,
    pub dest_path: String,
    pub mode: SyncMode,
    pub status: JobStatus,
    pub destination_type: Option<DestinationType>,
    pub schedule_interval: Option<i64>,
    pub schedule: Option<JobSchedule>,
    pub config: RsyncConfig,
    pub ssh_config: Option<SshConfig>,
    pub cloud_config: Option<CloudConfig>,
    pub last_run: Option<i64>,
    /// DEPRECATED: Snapshots are now stored in manifest.json on the backup drive.
    /// This field is kept for reading old jobs.json files during migration.
    /// It is not serialized when saving jobs.
    #[serde(skip_serializing, default)]
    pub snapshots: Option<Vec<serde_json::Value>>,
}

impl Default for SyncJob {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            source_path: String::new(),
            dest_path: String::new(),
            mode: SyncMode::Archive,
            status: JobStatus::Idle,
            destination_type: Some(DestinationType::Local),
            schedule_interval: None,
            schedule: None,
            config: RsyncConfig::default(),
            ssh_config: None,
            cloud_config: None,
            last_run: None,
            snapshots: None,
        }
    }
}
