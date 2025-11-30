//! Application state management
//!
//! TIM-49: Centralized service singletons using Tauri's managed state.
//! Services are initialized once at app startup and shared across all commands.

use crate::services::file_service::FileService;
use crate::services::index_service::IndexService;
use crate::services::snapshot_service::SnapshotService;
use std::path::PathBuf;
use std::sync::Arc;

/// Application state containing all singleton services
pub struct AppState {
    /// File operations service
    pub file_service: Arc<FileService>,
    /// SQLite-based snapshot index service
    pub index_service: Arc<IndexService>,
    /// Snapshot discovery and metadata service
    pub snapshot_service: Arc<SnapshotService>,
    /// Application data directory
    pub data_dir: PathBuf,
}

impl AppState {
    /// Create new application state with all services initialized
    pub fn new() -> Result<Self, String> {
        let data_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("amber-backup");

        // Ensure data directory exists
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;

        // Initialize services
        let file_service = Arc::new(FileService::new());

        let index_service = Arc::new(
            IndexService::new(&data_dir)
                .map_err(|e| format!("Failed to initialize index service: {}", e))?,
        );

        let snapshot_service = Arc::new(SnapshotService::new(&data_dir));

        Ok(Self {
            file_service,
            index_service,
            snapshot_service,
            data_dir,
        })
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new().expect("Failed to initialize application state")
    }
}
