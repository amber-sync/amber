/// Custom error type for Amber application
#[derive(Debug, thiserror::Error)]
pub enum AmberError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Rsync error: {0}")]
    Rsync(String),

    #[error("Snapshot error: {0}")]
    Snapshot(String),

    #[error("Job error: {0}")]
    Job(String),

    #[error("Filesystem error: {0}")]
    Filesystem(String),

    #[error("Keychain error: {0}")]
    Keychain(String),

    #[error("Store error: {0}")]
    Store(String),

    #[error("Scheduler error: {0}")]
    Scheduler(String),

    #[error("Volume error: {0}")]
    Volume(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("{0}")]
    Other(String),
}

impl serde::Serialize for AmberError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Result type alias for Amber operations
pub type Result<T> = std::result::Result<T, AmberError>;
