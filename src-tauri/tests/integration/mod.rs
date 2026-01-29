//! Integration tests for Amber Sync backend services
//!
//! These tests use real filesystem operations but may mock
//! external dependencies like rsync.

mod common;

mod compare_tests;
mod index_tests;
mod manifest_tests;
mod service_tests;
mod snapshot_tests;

// Re-export common utilities for test modules
pub use common::*;
