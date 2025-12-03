//! Centralized data directory management
//!
//! Provides a single source of truth for the application data directory path.
//! This ensures all services (cache, index, store) use the same directory,
//! whether in dev mode (mock-data/) or production (~/.local/share/amber/).

use std::path::PathBuf;
use std::sync::OnceLock;

/// Global data directory path, initialized once at app startup
static DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Initialize the data directory path
///
/// This must be called once during AppState initialization, before any
/// services that depend on the data directory are created.
///
/// # Panics
/// Does not panic if called multiple times (subsequent calls are ignored).
pub fn init(path: PathBuf) {
    // OnceLock::set returns Err if already set, but we ignore that
    let _ = DATA_DIR.set(path);
}

/// Get the data directory path
///
/// Returns the path set during initialization. All services should use this
/// instead of hardcoding paths or calling dirs::data_dir() directly.
///
/// # Panics
/// Panics if called before init() - this indicates a bug in initialization order.
pub fn get() -> &'static PathBuf {
    DATA_DIR
        .get()
        .expect("Data directory not initialized - call data_dir::init() first")
}

/// Check if the data directory has been initialized
///
/// Useful for tests or conditional initialization.
pub fn is_initialized() -> bool {
    DATA_DIR.get().is_some()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_init_and_get() {
        // Note: This test may fail if run in parallel with others
        // because OnceLock is global. In practice, init is called once at startup.
        if !is_initialized() {
            init(PathBuf::from("/test/path"));
        }
        assert!(is_initialized());
    }
}
