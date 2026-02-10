//! Stress test suite for SQLite index, backup & restore pipeline
//!
//! All tests are `#[ignore]`d so they don't run in normal CI.
//! Run with: `cargo test --test stress -- --ignored --nocapture`

#![allow(dead_code)]

mod common;
mod tests;
