//! Integration tests for real Amber services
//!
//! These tests instantiate actual service instances with temp directories
//! to verify real behavior, not mocked behavior.

pub mod index_service_tests;
pub mod manifest_service_tests;
pub mod rsync_service_tests;
pub mod snapshot_service_tests;
