use crate::error::Result;
use crate::state::AppState;
use crate::types::snapshot::{FileNode, SnapshotMetadata};
use tauri::State;

#[tauri::command]
pub async fn list_snapshots(
    state: State<'_, AppState>,
    job_id: String,
    dest_path: String,
) -> Result<Vec<SnapshotMetadata>> {
    state.snapshot_service.list_snapshots(&job_id, &dest_path)
}

/// Get snapshot tree - uses SQLite index if available, falls back to filesystem scan
#[tauri::command]
pub async fn get_snapshot_tree(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
    snapshot_path: String,
) -> Result<Vec<FileNode>> {
    // Check if snapshot is indexed
    if state.index_service.is_indexed(&job_id, timestamp)? {
        // Use fast SQLite query (root-level files)
        return state
            .index_service
            .get_directory_contents(&job_id, timestamp, "");
    }

    // Fall back to filesystem scan (legacy behavior)
    state
        .snapshot_service
        .get_snapshot_tree(&job_id, timestamp, &snapshot_path)
}

/// Get directory contents from index (fast)
#[tauri::command]
pub async fn get_indexed_directory(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
    parent_path: String,
) -> Result<Vec<FileNode>> {
    state
        .index_service
        .get_directory_contents(&job_id, timestamp, &parent_path)
}

/// Index a snapshot after backup completes
#[tauri::command]
pub async fn index_snapshot(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
    snapshot_path: String,
) -> Result<crate::services::index_service::IndexedSnapshot> {
    state
        .index_service
        .index_snapshot(&job_id, timestamp, &snapshot_path)
}

/// Check if a snapshot is indexed
#[tauri::command]
pub async fn is_snapshot_indexed(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
) -> Result<bool> {
    state.index_service.is_indexed(&job_id, timestamp)
}

/// Search files in a snapshot
#[tauri::command]
pub async fn search_snapshot_files(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
    pattern: String,
    limit: Option<usize>,
) -> Result<Vec<FileNode>> {
    state
        .index_service
        .search_files(&job_id, timestamp, &pattern, limit.unwrap_or(100))
}

/// Search files globally across all snapshots using FTS5
/// This is blazing fast - sub-millisecond even with millions of files
#[tauri::command]
pub async fn search_files_global(
    state: State<'_, AppState>,
    pattern: String,
    job_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<crate::services::index_service::GlobalSearchResult>> {
    state.index_service.search_files_global(
        &pattern,
        job_id.as_deref(),
        limit.unwrap_or(50),
    )
}

/// Get snapshot statistics from index
#[tauri::command]
pub async fn get_snapshot_stats(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
) -> Result<(i64, i64)> {
    state.index_service.get_snapshot_stats(&job_id, timestamp)
}

/// Get file type statistics for a snapshot (aggregated by extension)
#[tauri::command]
pub async fn get_file_type_stats(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
    limit: Option<usize>,
) -> Result<Vec<crate::services::index_service::FileTypeStats>> {
    state
        .index_service
        .get_file_type_stats(&job_id, timestamp, limit.unwrap_or(20))
}

/// Delete a snapshot from the index
#[tauri::command]
pub async fn delete_snapshot_index(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
) -> Result<()> {
    state.index_service.delete_snapshot(&job_id, timestamp)
}

/// Delete all indexed snapshots for a job
#[tauri::command]
pub async fn delete_job_index(state: State<'_, AppState>, job_id: String) -> Result<()> {
    state.index_service.delete_job_snapshots(&job_id)
}

#[tauri::command]
pub async fn restore_files(
    _job_id: String,
    snapshot_path: String,
    files: Vec<String>,
    target_path: String,
) -> Result<()> {
    use std::process::Command;

    // Use rsync to restore specific files
    let args = vec![
        "-av".to_string(),
        "--progress".to_string(),
        "--files-from=-".to_string(),
        "--from0".to_string(),
        snapshot_path,
        target_path,
    ];

    let mut child = Command::new("rsync")
        .args(&args)
        .stdin(std::process::Stdio::piped())
        .spawn()?;

    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let file_list = files.join("\0");
        stdin.write_all(file_list.as_bytes())?;
    }

    child.wait()?;
    Ok(())
}

#[tauri::command]
pub async fn restore_snapshot(
    _job_id: String,
    snapshot_path: String,
    target_path: String,
) -> Result<()> {
    use std::process::Command;

    let src = if snapshot_path.ends_with('/') {
        snapshot_path
    } else {
        format!("{}/", snapshot_path)
    };

    Command::new("rsync")
        .args(["-av", "--progress", &src, &target_path])
        .status()?;

    Ok(())
}

// ===== TIM-112: Destination-based index storage =====

use crate::services::manifest_service;

/// Get the path to the index database on a destination drive
#[tauri::command]
pub async fn get_destination_index_path(dest_path: String) -> Result<String> {
    let path = manifest_service::get_index_path(&dest_path);
    Ok(path.to_string_lossy().to_string())
}

/// Check if a destination has an index database
#[tauri::command]
pub async fn destination_has_index(dest_path: String) -> Result<bool> {
    let path = manifest_service::get_index_path(&dest_path);
    Ok(path.exists())
}

/// Export the local index database to the destination drive
/// This copies the index.db to {dest_path}/.amber-meta/index.db
#[tauri::command]
pub async fn export_index_to_destination(
    state: State<'_, AppState>,
    dest_path: String,
) -> Result<()> {
    use tokio::fs;

    // Get source (local) index path
    let local_index = state.index_service.get_db_path();

    // Get destination index path
    let dest_index = manifest_service::get_index_path(&dest_path);

    // Ensure .amber-meta directory exists
    let meta_dir = manifest_service::get_meta_dir(&dest_path);
    if !meta_dir.exists() {
        fs::create_dir_all(&meta_dir).await?;
    }

    // Copy the database file
    fs::copy(&local_index, &dest_index).await?;

    log::info!("Exported index to {:?}", dest_index);
    Ok(())
}
