use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncMode {
    Mirror,
    Archive,
    TimeMachine,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JobStatus {
    Idle,
    Running,
    Success,
    Failed,
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
    pub schedule: Option<String>,
    pub exclude_patterns: Vec<String>,
    pub last_run: Option<i64>,
    pub created_at: i64,
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
            schedule: None,
            exclude_patterns: vec![],
            last_run: None,
            created_at: 0,
        }
    }
}
