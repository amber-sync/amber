//! Security utilities for Amber
//!
//! This module provides security-critical functionality including:
//! - Path traversal protection
//! - Input validation
//! - Access control for filesystem operations

pub mod path_validation;

pub use path_validation::{validate_path, PathValidator};
