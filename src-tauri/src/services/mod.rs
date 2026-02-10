// Service modules - Business logic
pub mod cache_service;
pub mod data_dir; // Must be first - other services depend on this
pub mod file_service;
pub mod index_service;
pub mod job_scheduler;
pub mod keychain_service;
pub mod manifest_service;
pub mod migration_service;
pub mod rclone_service;
pub mod rsync_service;
pub mod snapshot_service;
pub mod store;
#[cfg(desktop)]
pub mod tray_manager;
pub mod volume_watcher;

// Dev-only modules
#[cfg(debug_assertions)]
pub mod dev_seed;
