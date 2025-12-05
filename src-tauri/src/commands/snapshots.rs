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
    state.snapshot_service.list_snapshots(&job_id, &dest_path).await
}

/// List snapshots within a date range (for Time Explorer filtering)
#[tauri::command]
pub async fn list_snapshots_in_range(
    state: State<'_, AppState>,
    job_id: String,
    start_ms: i64,
    end_ms: i64,
) -> Result<Vec<crate::services::index_service::IndexedSnapshot>> {
    state
        .index_service
        .list_snapshots_in_range(&job_id, start_ms, end_ms)
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
        .await
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

/// Get directory contents from index with pagination (for large directories)
#[tauri::command]
pub async fn get_indexed_directory_paginated(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
    parent_path: String,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<crate::services::index_service::DirectoryContents> {
    state
        .index_service
        .get_directory_contents_paginated(&job_id, timestamp, &parent_path, limit, offset)
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
    state
        .index_service
        .search_files_global(&pattern, job_id.as_deref(), limit.unwrap_or(50))
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

/// Get largest files in a snapshot (for analytics)
#[tauri::command]
pub async fn get_largest_files(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
    limit: Option<usize>,
) -> Result<Vec<crate::services::index_service::LargestFile>> {
    state
        .index_service
        .get_largest_files(&job_id, timestamp, limit.unwrap_or(10))
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
    mirror: Option<bool>,
) -> Result<()> {
    use std::process::Command;

    let src = if snapshot_path.ends_with('/') {
        snapshot_path
    } else {
        format!("{}/", snapshot_path)
    };

    let mut args = vec!["-av", "--progress"];

    // Add --delete flag for mirror mode (exact copy)
    if mirror.unwrap_or(false) {
        args.push("--delete");
        log::info!("[restore] Mirror mode enabled - will delete extraneous files");
    }

    Command::new("rsync")
        .args(&args)
        .arg(&src)
        .arg(&target_path)
        .status()?;

    Ok(())
}

// ===== TIM-112: Destination-based index storage =====

use crate::services::index_service::IndexService;
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

// ===== TIM-127: Destination-based index operations =====
// These commands operate directly on the destination drive's index.db

/// Index a snapshot and store in destination's .amber-meta/index.db
/// This is the primary indexing method for destination-centric architecture
#[tauri::command]
pub async fn index_snapshot_on_destination(
    dest_path: String,
    job_id: String,
    timestamp: i64,
    snapshot_path: String,
) -> Result<crate::services::index_service::IndexedSnapshot> {
    let index = IndexService::for_destination(&dest_path)?;
    index.index_snapshot(&job_id, timestamp, &snapshot_path)
}

/// Get directory contents from destination's index
#[tauri::command]
pub async fn get_directory_from_destination(
    dest_path: String,
    job_id: String,
    timestamp: i64,
    parent_path: String,
) -> Result<Vec<FileNode>> {
    let index = IndexService::for_destination(&dest_path)?;
    index.get_directory_contents(&job_id, timestamp, &parent_path)
}

/// Check if a snapshot is indexed on the destination
#[tauri::command]
pub async fn is_indexed_on_destination(
    dest_path: String,
    job_id: String,
    timestamp: i64,
) -> Result<bool> {
    let index = IndexService::for_destination(&dest_path)?;
    index.is_indexed(&job_id, timestamp)
}

/// Search files in destination's index
#[tauri::command]
pub async fn search_files_on_destination(
    dest_path: String,
    job_id: String,
    timestamp: i64,
    pattern: String,
    limit: Option<usize>,
) -> Result<Vec<FileNode>> {
    let index = IndexService::for_destination(&dest_path)?;
    index.search_files(&job_id, timestamp, &pattern, limit.unwrap_or(100))
}

/// Get file type stats from destination's index
#[tauri::command]
pub async fn get_file_type_stats_on_destination(
    dest_path: String,
    job_id: String,
    timestamp: i64,
    limit: Option<usize>,
) -> Result<Vec<crate::services::index_service::FileTypeStats>> {
    let index = IndexService::for_destination(&dest_path)?;
    index.get_file_type_stats(&job_id, timestamp, limit.unwrap_or(20))
}

/// Get largest files from destination's index
#[tauri::command]
pub async fn get_largest_files_on_destination(
    dest_path: String,
    job_id: String,
    timestamp: i64,
    limit: Option<usize>,
) -> Result<Vec<crate::services::index_service::LargestFile>> {
    let index = IndexService::for_destination(&dest_path)?;
    index.get_largest_files(&job_id, timestamp, limit.unwrap_or(10))
}

/// Delete snapshot from destination's index
#[tauri::command]
pub async fn delete_snapshot_from_destination(
    dest_path: String,
    job_id: String,
    timestamp: i64,
) -> Result<()> {
    let index = IndexService::for_destination(&dest_path)?;
    index.delete_snapshot(&job_id, timestamp)
}

/// List snapshots within a date range from destination's index (for Time Explorer filtering)
#[tauri::command]
pub async fn list_snapshots_in_range_on_destination(
    dest_path: String,
    job_id: String,
    start_ms: i64,
    end_ms: i64,
) -> Result<Vec<crate::services::index_service::IndexedSnapshot>> {
    let index = IndexService::for_destination(&dest_path)?;
    index.list_snapshots_in_range(&job_id, start_ms, end_ms)
}

/// Get aggregate statistics for a job (TIM-127: for Time Explorer stats panel)
#[tauri::command]
pub async fn get_job_aggregate_stats(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<crate::services::index_service::JobAggregateStats> {
    state.index_service.get_job_aggregate_stats(&job_id)
}

/// Get aggregate statistics for a job from destination's index
#[tauri::command]
pub async fn get_job_aggregate_stats_on_destination(
    dest_path: String,
    job_id: String,
) -> Result<crate::services::index_service::JobAggregateStats> {
    let index = IndexService::for_destination(&dest_path)?;
    index.get_job_aggregate_stats(&job_id)
}

/// Get snapshot density grouped by period (TIM-128: for calendar/timeline)
#[tauri::command]
pub async fn get_snapshot_density(
    state: State<'_, AppState>,
    job_id: String,
    period: String,
) -> Result<Vec<crate::services::index_service::SnapshotDensity>> {
    state.index_service.get_snapshot_density(&job_id, &period)
}

/// Get snapshot density from destination's index
#[tauri::command]
pub async fn get_snapshot_density_on_destination(
    dest_path: String,
    job_id: String,
    period: String,
) -> Result<Vec<crate::services::index_service::SnapshotDensity>> {
    let index = IndexService::for_destination(&dest_path)?;
    index.get_snapshot_density(&job_id, &period)
}
