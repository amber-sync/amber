//! Common utilities for stress tests

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
        .args(["-a", "--delete", &source_str, &dest_str])
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
        .args(["-a", "--link-dest", &link_dest_str, &source_str, &dest_str])
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
