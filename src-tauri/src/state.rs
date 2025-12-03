//! Application state management
//!
//! TIM-49: Centralized service singletons using Tauri's managed state.
//! Services are initialized once at app startup and shared across all commands.

use crate::services::file_service::FileService;
use crate::services::index_service::IndexService;
use crate::services::snapshot_service::SnapshotService;
use crate::services::store::Store;
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
    /// Job/preferences store
    pub store: Arc<Store>,
    /// Application data directory
    pub data_dir: PathBuf,
}

impl AppState {
    /// Create new application state with all services initialized
    pub fn new() -> Result<Self, String> {
        // In dev mode, use mock-data folder directly from project root
        // In production, use normal user data directory
        let data_dir = Self::get_data_dir();

        log::info!("Using data directory: {:?}", data_dir);

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

        let store = Arc::new(Store::new(&data_dir));

        Ok(Self {
            file_service,
            index_service,
            snapshot_service,
            store,
            data_dir,
        })
    }

    /// Get the data directory path
    /// - Dev mode: uses mock-data folder from project root (auto-loads test data)
    /// - Production: uses standard user data directory (clean)
    fn get_data_dir() -> PathBuf {
        #[cfg(debug_assertions)]
        {
            // In dev mode, check if mock-data exists and use it
            if let Some(manifest_dir) = option_env!("CARGO_MANIFEST_DIR") {
                let mock_data_path = PathBuf::from(manifest_dir)
                    .parent()
                    .map(|p| p.join("mock-data"));

                if let Some(path) = mock_data_path {
                    if path.exists() {
                        log::info!("Dev mode: using mock-data at {:?}", path);
                        return path;
                    }
                }
            }
        }

        // Production: use standard user data directory
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("amber")
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new().expect("Failed to initialize application state")
    }
}
