//! End-to-end tests for Amber Sync
//!
//! These tests run real rsync operations and verify full backup/restore cycles.
//! They are slower than integration tests but test the complete system.

mod common;

mod restore_tests;
mod rsync_tests;
mod time_machine_tests;

// Re-export common utilities for test modules
pub use common::*;
