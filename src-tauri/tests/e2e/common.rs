//! Common utilities for E2E tests

#[path = "../common/mod.rs"]
pub mod test_common;

pub use test_common::*;

use std::process::Command;

/// Check if rsync is available on the system
pub fn rsync_available() -> bool {
    Command::new("rsync")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Run rsync backup from source to destination
pub fn run_rsync_backup(source: &std::path::Path, dest: &std::path::Path) -> std::io::Result<()> {
    let source_str = format!("{}/", source.display());
    let dest_str = format!("{}/", dest.display());

    let output = Command::new("rsync")
        .args(["-av", "--delete", &source_str, &dest_str])
        .output()?;

    if output.status.success() {
        Ok(())
    } else {
        Err(std::io::Error::other(format!(
            "rsync failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )))
    }
}

/// Run rsync with link-dest for incremental backup
pub fn run_rsync_incremental(
    source: &std::path::Path,
    dest: &std::path::Path,
    link_dest: &std::path::Path,
) -> std::io::Result<()> {
    let source_str = format!("{}/", source.display());
    let dest_str = format!("{}/", dest.display());
    let link_dest_str = link_dest.display().to_string();

    let output = Command::new("rsync")
        .args(["-av", "--link-dest", &link_dest_str, &source_str, &dest_str])
        .output()?;

    if output.status.success() {
        Ok(())
    } else {
        Err(std::io::Error::other(format!(
            "rsync incremental failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )))
    }
}

/// Restore a single file using rsync
pub fn rsync_restore_file(
    source_file: &std::path::Path,
    dest_file: &std::path::Path,
) -> std::io::Result<()> {
    // Ensure parent directory exists
    if let Some(parent) = dest_file.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let output = Command::new("rsync")
        .args([
            "-av",
            "--checksum", // Force comparison by checksum to ensure overwrites work
            &source_file.display().to_string(),
            &dest_file.display().to_string(),
        ])
        .output()?;

    if output.status.success() {
        Ok(())
    } else {
        Err(std::io::Error::other(format!(
            "rsync restore failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )))
    }
}

/// Restore a directory using rsync
pub fn rsync_restore_dir(
    source_dir: &std::path::Path,
    dest_dir: &std::path::Path,
) -> std::io::Result<()> {
    std::fs::create_dir_all(dest_dir)?;

    let source_str = format!("{}/", source_dir.display());
    let dest_str = format!("{}/", dest_dir.display());

    let output = Command::new("rsync")
        .args([
            "-av",
            "--checksum", // Force comparison by checksum to ensure overwrites work
            &source_str,
            &dest_str,
        ])
        .output()?;

    if output.status.success() {
        Ok(())
    } else {
        Err(std::io::Error::other(format!(
            "rsync restore dir failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )))
    }
}
