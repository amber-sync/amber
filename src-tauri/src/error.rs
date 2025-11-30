/// Custom error type for Amber application
///
/// TIM-59: Improved error types - removed catch-all `Other` variant,
/// added new specific error types, and helper constructors.
#[derive(Debug, thiserror::Error)]
pub enum AmberError {
    // IO errors
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    // Rsync execution
    #[error("Rsync failed: {0}")]
    Rsync(String),

    // Snapshot operations
    #[error("Snapshot error: {0}")]
    Snapshot(String),

    // Job management
    #[error("Job error: {0}")]
    Job(String),

    #[error("Job not found: {0}")]
    JobNotFound(String),

    // Filesystem operations
    #[error("Filesystem error: {0}")]
    Filesystem(String),

    // Keychain/credentials
    #[error("Keychain error: {0}")]
    Keychain(String),

    // Persistent store
    #[error("Store error: {0}")]
    Store(String),

    // Job scheduler
    #[error("Scheduler error: {0}")]
    Scheduler(String),

    // Volume/disk operations
    #[error("Volume error: {0}")]
    Volume(String),

    // Database index operations
    #[error("Index error: {0}")]
    Index(String),

    // Serialization
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    // Tauri framework
    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    // TIM-59: New specific error types
    #[error("Database error: {0}")]
    Database(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Operation cancelled")]
    Cancelled,
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

// Helper constructors for common error patterns
impl AmberError {
    /// Create a job not found error
    pub fn job_not_found(job_id: impl Into<String>) -> Self {
        AmberError::JobNotFound(job_id.into())
    }

    /// Create a filesystem error with path context
    pub fn fs_error(path: impl AsRef<str>, reason: impl std::fmt::Display) -> Self {
        AmberError::Filesystem(format!("{}: {}", path.as_ref(), reason))
    }

    /// Create an index error with context
    pub fn index_error(operation: impl AsRef<str>, reason: impl std::fmt::Display) -> Self {
        AmberError::Index(format!("{}: {}", operation.as_ref(), reason))
    }

    /// Create a database error
    pub fn database(reason: impl Into<String>) -> Self {
        AmberError::Database(reason.into())
    }

    /// Create an invalid path error
    pub fn invalid_path(path: impl Into<String>) -> Self {
        AmberError::InvalidPath(path.into())
    }

    /// Create a permission denied error
    pub fn permission_denied(resource: impl Into<String>) -> Self {
        AmberError::PermissionDenied(resource.into())
    }

    /// Create a scheduler error with job context
    pub fn scheduler_for_job(job_id: impl AsRef<str>, reason: impl std::fmt::Display) -> Self {
        AmberError::Scheduler(format!("job '{}': {}", job_id.as_ref(), reason))
    }

    /// Create a snapshot error with job context
    pub fn snapshot_for_job(job_id: impl AsRef<str>, reason: impl std::fmt::Display) -> Self {
        AmberError::Snapshot(format!("job '{}': {}", job_id.as_ref(), reason))
    }
}

// Conversion from rusqlite errors
impl From<rusqlite::Error> for AmberError {
    fn from(err: rusqlite::Error) -> Self {
        AmberError::Database(err.to_string())
    }
}
