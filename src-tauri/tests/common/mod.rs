//! Common test utilities for integration tests

use std::path::PathBuf;

/// Get the path to test fixtures directory
pub fn get_fixtures_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("tests/fixtures")
}

/// Get the source fixtures directory
pub fn get_source_fixtures() -> PathBuf {
    get_fixtures_path().join("source")
}

/// Get the destination fixtures directory
pub fn get_dest_fixtures() -> PathBuf {
    get_fixtures_path().join("dest")
}
