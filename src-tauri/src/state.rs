//! Application state management
//!
//! TIM-49: Centralized service singletons using Tauri's managed state.
//! Services are initialized once at app startup and shared across all commands.

use crate::security::PathValidator;
use crate::services::data_dir;
use crate::services::file_service::FileService;
use crate::services::index_service::IndexService;
use crate::services::job_scheduler::JobScheduler;
use crate::services::snapshot_service::SnapshotService;
use crate::services::store::Store;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

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
    /// Cron-based job scheduler
    pub scheduler: Arc<JobScheduler>,
    /// Application data directory
    pub data_dir: PathBuf,
    /// Path validator for security
    pub path_validator: Arc<RwLock<PathValidator>>,
}

impl AppState {
    /// Create new application state with all services initialized
    pub fn new() -> Result<Self, String> {
        // In dev mode, use mock-data folder directly from project root
        // In production, use normal user data directory
        let data_dir_path = Self::get_data_dir();

        log::info!("Using data directory: {:?}", data_dir_path);

        // Initialize the global data_dir singleton FIRST
        // This must happen before any services are created
        data_dir::init(data_dir_path.clone());

        // Ensure data directory and subdirectories exist
        std::fs::create_dir_all(&data_dir_path)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;

        // Create cache subdirectories (used by cache_service.rs)
        std::fs::create_dir_all(data_dir_path.join("cache/snapshots"))
            .map_err(|e| format!("Failed to create cache directory: {}", e))?;

        // Initialize services
        let file_service = Arc::new(FileService::new());

        let index_service = Arc::new(
            IndexService::new(&data_dir_path)
                .map_err(|e| format!("Failed to initialize index service: {}", e))?,
        );

        let snapshot_service = Arc::new(SnapshotService::new(&data_dir_path));

        let store = Arc::new(Store::new(&data_dir_path));
        let scheduler = Arc::new(JobScheduler::new());

        // Initialize path validator with standard roots
        let path_validator = PathValidator::with_standard_roots(&data_dir_path)
            .map_err(|e| format!("Failed to initialize path validator: {}", e))?;

        let app_state = Self {
            file_service,
            index_service,
            snapshot_service,
            store,
            scheduler,
            data_dir: data_dir_path,
            path_validator: Arc::new(RwLock::new(path_validator)),
        };

        if let Err(e) = app_state.update_job_roots() {
            log::warn!("Failed to initialize job roots: {}", e);
        }

        Ok(app_state)
    }

    /// Validate a path against allowed roots
    /// Returns the validated path string on success
    pub fn validate_path(&self, path: &str) -> crate::error::Result<String> {
        let validator = self
            .path_validator
            .read()
            .map_err(|e| crate::error::AmberError::Filesystem(format!("Lock error: {}", e)))?;
        validator.validate_str(path)
    }

    /// Validate a path that may not exist yet (for creation targets)
    pub fn validate_path_for_create(&self, path: &str) -> crate::error::Result<String> {
        let validator = self
            .path_validator
            .read()
            .map_err(|e| crate::error::AmberError::Filesystem(format!("Lock error: {}", e)))?;
        validator.validate_str_for_create(path)
    }

    /// Update path validator with job-specific roots
    /// This should be called whenever jobs are loaded or modified
    pub fn update_job_roots(&self) -> Result<(), String> {
        // Load current jobs from store
        let jobs = self
            .store
            .load_jobs()
            .map_err(|e| format!("Failed to load jobs: {}", e))?;

        // Create new validator with job roots
        let new_validator = PathValidator::with_job_roots(&self.data_dir, &jobs)
            .map_err(|e| format!("Failed to update path validator: {}", e))?;

        // Replace the validator
        let mut validator = self
            .path_validator
            .write()
            .map_err(|e| format!("Failed to acquire write lock: {}", e))?;
        *validator = new_validator;

        Ok(())
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
        if let Some(dir) = dirs::data_dir() {
            dir.join("amber")
        } else if let Some(home) = dirs::home_dir() {
            home.join(".amber")
        } else {
            std::env::temp_dir().join("amber")
        }
    }
}

// Note: Default implementation removed to avoid panic on initialization failure.
// AppState must be created explicitly with `new()` which returns Result<Self, String>.
