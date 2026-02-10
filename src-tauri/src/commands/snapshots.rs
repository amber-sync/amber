use crate::error::{AmberError, Result};
use crate::services::index_service::IndexService;
use crate::services::manifest_service;
use crate::state::AppState;
use crate::types::snapshot::{FileNode, SnapshotMetadata};
use crate::utils::validation::validate_job_id;
use serde::Serialize;
use std::path::Path;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PruneResult {
    pub freed_bytes: u64,
    pub folder_removed: bool,
}

enum IndexHandle<'a> {
    Local(&'a IndexService),
    Destination(IndexService),
}

impl<'a> IndexHandle<'a> {
    fn with<R>(&self, f: impl FnOnce(&IndexService) -> Result<R>) -> Result<R> {
        match self {
            IndexHandle::Local(index) => f(index),
            IndexHandle::Destination(index) => f(index),
        }
    }
}

fn resolve_index<'a>(
    state: &'a AppState,
    job_id: &str,
    require_existing: bool,
) -> Result<IndexHandle<'a>> {
    if let Some(job) = state.store.get_job(job_id)? {
        let dest_root = Path::new(&job.dest_path);
        if dest_root.is_dir() {
            let index_path = manifest_service::get_index_path(&job.dest_path);
            if !require_existing || index_path.exists() {
                let index = IndexService::for_destination(&job.dest_path)?;
                return Ok(IndexHandle::Destination(index));
            }
        }
    }

    Ok(IndexHandle::Local(&state.index_service))
}

fn validate_destination_path(
    state: &AppState,
    dest_path: &str,
    require_exists: bool,
) -> Result<String> {
    let validated = state.validate_path_for_create(dest_path)?;
    if require_exists && !Path::new(&validated).is_dir() {
        return Err(AmberError::NotFound(format!(
            "Destination path not found: {}",
            dest_path
        )));
    }
    Ok(validated)
}

fn ensure_job_id(job_id: &str) -> Result<()> {
    validate_job_id(job_id)?;
    Ok(())
}

#[tauri::command]
pub async fn list_snapshots(
    state: State<'_, AppState>,
    job_id: String,
    dest_path: String,
) -> Result<Vec<SnapshotMetadata>> {
    ensure_job_id(&job_id)?;
    state
        .snapshot_service
        .list_snapshots(&job_id, &dest_path)
        .await
}

/// List snapshots within a date range (for Time Explorer filtering)
#[tauri::command]
pub async fn list_snapshots_in_range(
    state: State<'_, AppState>,
    job_id: String,
    start_ms: i64,
    end_ms: i64,
) -> Result<Vec<crate::services::index_service::IndexedSnapshot>> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.list_snapshots_in_range(&job_id, start_ms, end_ms))
}

/// Get snapshot tree - uses SQLite index if available, falls back to filesystem scan
#[tauri::command]
pub async fn get_snapshot_tree(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
    snapshot_path: String,
) -> Result<Vec<FileNode>> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    if index.with(|idx| idx.is_indexed(&job_id, timestamp))? {
        return index.with(|idx| idx.get_directory_contents(&job_id, timestamp, ""));
    }

    // Fall back to filesystem scan (legacy behavior)
    let validated_snapshot = state.validate_path(&snapshot_path)?;
    state
        .snapshot_service
        .get_snapshot_tree(&job_id, timestamp, &validated_snapshot)
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
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.get_directory_contents(&job_id, timestamp, &parent_path))
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
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| {
        idx.get_directory_contents_paginated(&job_id, timestamp, &parent_path, limit, offset)
    })
}

/// Index a snapshot after backup completes
#[tauri::command]
pub async fn index_snapshot(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
    snapshot_path: String,
) -> Result<crate::services::index_service::IndexedSnapshot> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, false)?;
    let validated_snapshot = state.validate_path(&snapshot_path)?;
    index.with(|idx| idx.index_snapshot(&job_id, timestamp, &validated_snapshot))
}

/// Check if a snapshot is indexed
#[tauri::command]
pub async fn is_snapshot_indexed(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
) -> Result<bool> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.is_indexed(&job_id, timestamp))
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
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.search_files(&job_id, timestamp, &pattern, limit.unwrap_or(100)))
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
    let index = match &job_id {
        Some(id) => {
            ensure_job_id(id)?;
            resolve_index(&state, id, true)?
        }
        None => IndexHandle::Local(&state.index_service),
    };
    index.with(|idx| idx.search_files_global(&pattern, job_id.as_deref(), limit.unwrap_or(50)))
}

/// Get snapshot statistics from index
#[tauri::command]
pub async fn get_snapshot_stats(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
) -> Result<(i64, i64)> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.get_snapshot_stats(&job_id, timestamp))
}

/// Get file type statistics for a snapshot (aggregated by extension)
#[tauri::command]
pub async fn get_file_type_stats(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
    limit: Option<usize>,
) -> Result<Vec<crate::services::index_service::FileTypeStats>> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.get_file_type_stats(&job_id, timestamp, limit.unwrap_or(20)))
}

/// Get largest files in a snapshot (for analytics)
#[tauri::command]
pub async fn get_largest_files(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
    limit: Option<usize>,
) -> Result<Vec<crate::services::index_service::LargestFile>> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.get_largest_files(&job_id, timestamp, limit.unwrap_or(10)))
}

/// Delete a snapshot from the index
#[tauri::command]
pub async fn delete_snapshot_index(
    state: State<'_, AppState>,
    job_id: String,
    timestamp: i64,
) -> Result<()> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.delete_snapshot(&job_id, timestamp))
}

/// Delete all indexed snapshots for a job
#[tauri::command]
pub async fn delete_job_index(state: State<'_, AppState>, job_id: String) -> Result<()> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.delete_job_snapshots(&job_id))
}

#[tauri::command]
pub async fn restore_files(
    state: State<'_, AppState>,
    job_id: String,
    snapshot_path: String,
    files: Vec<String>,
    target_path: String,
) -> Result<()> {
    ensure_job_id(&job_id)?;
    use std::process::Command;
    use std::process::Stdio;

    let job = state
        .store
        .get_job(&job_id)?
        .ok_or_else(|| AmberError::job_not_found(job_id.clone()))?;

    let validated_snapshot = state.validate_path(&snapshot_path)?;
    let validated_target = state.validate_path_for_create(&target_path)?;

    let dest_root = std::path::Path::new(&job.dest_path)
        .canonicalize()
        .map_err(|e| AmberError::InvalidPath(format!("Invalid job destination: {}", e)))?;
    let snapshot_root = std::path::Path::new(&validated_snapshot);
    if !snapshot_root.is_dir() {
        return Err(AmberError::InvalidPath(
            "Snapshot path is not a directory".to_string(),
        ));
    }
    if !snapshot_root.starts_with(&dest_root) {
        return Err(AmberError::PermissionDenied(
            "Snapshot path is outside job destination".to_string(),
        ));
    }

    let validated_files = validate_restore_file_list(&files)?;

    let args = vec![
        "-av".to_string(),
        "--progress".to_string(),
        "--files-from=-".to_string(),
        "--from0".to_string(),
        "--".to_string(),
        validated_snapshot,
        validated_target,
    ];

    let mut child = Command::new("rsync")
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()?;

    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let file_list = validated_files.join("\0");
        stdin.write_all(file_list.as_bytes())?;
    }

    let output = child.wait_with_output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AmberError::Rsync(format!(
            "Restore failed with code {:?}: {}",
            output.status.code(),
            stderr.trim()
        )));
    }
    Ok(())
}

#[tauri::command]
pub async fn restore_snapshot(
    state: State<'_, AppState>,
    job_id: String,
    snapshot_path: String,
    target_path: String,
    mirror: Option<bool>,
) -> Result<()> {
    ensure_job_id(&job_id)?;
    use std::process::Command;
    use std::process::Stdio;

    let job = state
        .store
        .get_job(&job_id)?
        .ok_or_else(|| AmberError::job_not_found(job_id.clone()))?;

    let validated_snapshot = state.validate_path(&snapshot_path)?;
    let validated_target = state.validate_path_for_create(&target_path)?;

    let dest_root = std::path::Path::new(&job.dest_path)
        .canonicalize()
        .map_err(|e| AmberError::InvalidPath(format!("Invalid job destination: {}", e)))?;
    let snapshot_root = std::path::Path::new(&validated_snapshot);
    if !snapshot_root.is_dir() {
        return Err(AmberError::InvalidPath(
            "Snapshot path is not a directory".to_string(),
        ));
    }
    if !snapshot_root.starts_with(&dest_root) {
        return Err(AmberError::PermissionDenied(
            "Snapshot path is outside job destination".to_string(),
        ));
    }

    let src = if validated_snapshot.ends_with('/') {
        validated_snapshot
    } else {
        format!("{}/", validated_snapshot)
    };

    let mut args = vec!["-av".to_string(), "--progress".to_string()];

    // Add --delete flag for mirror mode (exact copy)
    if mirror.unwrap_or(false) {
        args.push("--delete".to_string());
        log::info!("[restore] Mirror mode enabled - will delete extraneous files");
    }

    args.push("--".to_string());
    args.push(src);
    args.push(validated_target);

    let output = Command::new("rsync")
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AmberError::Rsync(format!(
            "Restore failed with code {:?}: {}",
            output.status.code(),
            stderr.trim()
        )));
    }

    Ok(())
}

fn validate_restore_file_list(files: &[String]) -> Result<Vec<String>> {
    if files.is_empty() {
        return Err(AmberError::ValidationError(
            "No files provided for restore".to_string(),
        ));
    }

    let mut validated = Vec::with_capacity(files.len());
    for file in files {
        let trimmed = file.trim();
        if trimmed.is_empty() {
            return Err(AmberError::ValidationError(
                "File list contains an empty path".to_string(),
            ));
        }
        if trimmed.contains('\0') {
            return Err(AmberError::ValidationError(
                "File list contains null bytes".to_string(),
            ));
        }

        let path = std::path::Path::new(trimmed);
        if path.is_absolute() {
            return Err(AmberError::ValidationError(
                "File paths must be relative to snapshot root".to_string(),
            ));
        }

        for component in path.components() {
            match component {
                std::path::Component::ParentDir | std::path::Component::CurDir => {
                    return Err(AmberError::ValidationError(
                        "File paths cannot contain relative components".to_string(),
                    ));
                }
                _ => {}
            }
        }

        validated.push(trimmed.to_string());
    }

    Ok(validated)
}

// ===== TIM-112: Destination-based index storage =====

/// Get the path to the index database on a destination drive
#[tauri::command]
pub async fn get_destination_index_path(
    state: State<'_, AppState>,
    dest_path: String,
) -> Result<String> {
    let validated = validate_destination_path(&state, &dest_path, false)?;
    let path = manifest_service::get_index_path(&validated);
    Ok(path.to_string_lossy().to_string())
}

/// Check if a destination has an index database
#[tauri::command]
pub async fn destination_has_index(state: State<'_, AppState>, dest_path: String) -> Result<bool> {
    let validated = validate_destination_path(&state, &dest_path, false)?;
    if !Path::new(&validated).is_dir() {
        return Ok(false);
    }
    let path = manifest_service::get_index_path(&validated);
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
    let validated = validate_destination_path(&state, &dest_path, true)?;
    let dest_index = manifest_service::get_index_path(&validated);

    // Ensure .amber-meta directory exists
    let meta_dir = manifest_service::get_meta_dir(&validated);
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
    state: State<'_, AppState>,
    dest_path: String,
    job_id: String,
    timestamp: i64,
    snapshot_path: String,
) -> Result<crate::services::index_service::IndexedSnapshot> {
    ensure_job_id(&job_id)?;
    let validated_dest = validate_destination_path(&state, &dest_path, true)?;
    let validated_snapshot = state.validate_path(&snapshot_path)?;
    let index = IndexService::for_destination(&validated_dest)?;
    index.index_snapshot(&job_id, timestamp, &validated_snapshot)
}

/// Get directory contents from destination's index
#[tauri::command]
pub async fn get_directory_from_destination(
    state: State<'_, AppState>,
    dest_path: String,
    job_id: String,
    timestamp: i64,
    parent_path: String,
) -> Result<Vec<FileNode>> {
    ensure_job_id(&job_id)?;
    let validated = validate_destination_path(&state, &dest_path, true)?;
    let index = IndexService::for_destination(&validated)?;
    index.get_directory_contents(&job_id, timestamp, &parent_path)
}

/// Check if a snapshot is indexed on the destination
#[tauri::command]
pub async fn is_indexed_on_destination(
    state: State<'_, AppState>,
    dest_path: String,
    job_id: String,
    timestamp: i64,
) -> Result<bool> {
    ensure_job_id(&job_id)?;
    let validated = validate_destination_path(&state, &dest_path, true)?;
    let index = IndexService::for_destination(&validated)?;
    index.is_indexed(&job_id, timestamp)
}

/// Search files in destination's index
#[tauri::command]
pub async fn search_files_on_destination(
    state: State<'_, AppState>,
    dest_path: String,
    job_id: String,
    timestamp: i64,
    pattern: String,
    limit: Option<usize>,
) -> Result<Vec<FileNode>> {
    ensure_job_id(&job_id)?;
    let validated = validate_destination_path(&state, &dest_path, true)?;
    let index = IndexService::for_destination(&validated)?;
    index.search_files(&job_id, timestamp, &pattern, limit.unwrap_or(100))
}

/// Get file type stats from destination's index
#[tauri::command]
pub async fn get_file_type_stats_on_destination(
    state: State<'_, AppState>,
    dest_path: String,
    job_id: String,
    timestamp: i64,
    limit: Option<usize>,
) -> Result<Vec<crate::services::index_service::FileTypeStats>> {
    ensure_job_id(&job_id)?;
    let validated = validate_destination_path(&state, &dest_path, true)?;
    let index = IndexService::for_destination(&validated)?;
    index.get_file_type_stats(&job_id, timestamp, limit.unwrap_or(20))
}

/// Get largest files from destination's index
#[tauri::command]
pub async fn get_largest_files_on_destination(
    state: State<'_, AppState>,
    dest_path: String,
    job_id: String,
    timestamp: i64,
    limit: Option<usize>,
) -> Result<Vec<crate::services::index_service::LargestFile>> {
    ensure_job_id(&job_id)?;
    let validated = validate_destination_path(&state, &dest_path, true)?;
    let index = IndexService::for_destination(&validated)?;
    index.get_largest_files(&job_id, timestamp, limit.unwrap_or(10))
}

/// Delete snapshot from destination's index
#[tauri::command]
pub async fn delete_snapshot_from_destination(
    state: State<'_, AppState>,
    dest_path: String,
    job_id: String,
    timestamp: i64,
) -> Result<()> {
    ensure_job_id(&job_id)?;
    let validated = validate_destination_path(&state, &dest_path, true)?;
    let index = IndexService::for_destination(&validated)?;
    index.delete_snapshot(&job_id, timestamp)
}

/// List snapshots within a date range from destination's index (for Time Explorer filtering)
#[tauri::command]
pub async fn list_snapshots_in_range_on_destination(
    state: State<'_, AppState>,
    dest_path: String,
    job_id: String,
    start_ms: i64,
    end_ms: i64,
) -> Result<Vec<crate::services::index_service::IndexedSnapshot>> {
    ensure_job_id(&job_id)?;
    let validated = validate_destination_path(&state, &dest_path, true)?;
    let index = IndexService::for_destination(&validated)?;
    index.list_snapshots_in_range(&job_id, start_ms, end_ms)
}

/// Get aggregate statistics for a job (TIM-127: for Time Explorer stats panel)
#[tauri::command]
pub async fn get_job_aggregate_stats(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<crate::services::index_service::JobAggregateStats> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.get_job_aggregate_stats(&job_id))
}

/// Get aggregate statistics for a job from destination's index
#[tauri::command]
pub async fn get_job_aggregate_stats_on_destination(
    state: State<'_, AppState>,
    dest_path: String,
    job_id: String,
) -> Result<crate::services::index_service::JobAggregateStats> {
    ensure_job_id(&job_id)?;
    let validated = validate_destination_path(&state, &dest_path, true)?;
    let index = IndexService::for_destination(&validated)?;
    index.get_job_aggregate_stats(&job_id)
}

/// Get snapshot density grouped by period (TIM-128: for calendar/timeline)
#[tauri::command]
pub async fn get_snapshot_density(
    state: State<'_, AppState>,
    job_id: String,
    period: String,
) -> Result<Vec<crate::services::index_service::SnapshotDensity>> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.get_snapshot_density(&job_id, &period))
}

/// Get snapshot density from destination's index
#[tauri::command]
pub async fn get_snapshot_density_on_destination(
    state: State<'_, AppState>,
    dest_path: String,
    job_id: String,
    period: String,
) -> Result<Vec<crate::services::index_service::SnapshotDensity>> {
    ensure_job_id(&job_id)?;
    let validated = validate_destination_path(&state, &dest_path, true)?;
    let index = IndexService::for_destination(&validated)?;
    index.get_snapshot_density(&job_id, &period)
}

/// TIM-221: Compare two snapshots and return file differences
#[tauri::command]
pub async fn compare_snapshots(
    state: State<'_, AppState>,
    job_id: String,
    timestamp_a: i64,
    timestamp_b: i64,
    limit: Option<usize>,
) -> Result<crate::services::index_service::SnapshotDiff> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.compare_snapshots(&job_id, timestamp_a, timestamp_b, limit))
}

/// Prune a snapshot: remove from manifest, delete from index, and remove folder from disk.
#[tauri::command]
pub async fn prune_snapshot(
    state: State<'_, AppState>,
    dest_path: String,
    job_id: String,
    snapshot_id: String,
    timestamp: i64,
) -> Result<PruneResult> {
    ensure_job_id(&job_id)?;
    let validated = validate_destination_path(&state, &dest_path, true)?;

    // 1. Remove from manifest and get folder_name
    let removed = manifest_service::remove_snapshot_from_manifest(&validated, &snapshot_id)
        .await
        .map_err(|e| AmberError::Snapshot(format!("Failed to update manifest: {}", e)))?;

    let folder_name = removed
        .as_ref()
        .map(|s| s.folder_name.clone())
        .ok_or_else(|| {
            AmberError::NotFound(format!("Snapshot {} not found in manifest", snapshot_id))
        })?;

    // 2. Remove from index (best-effort)
    if let Ok(index) = IndexService::for_destination(&validated) {
        let _ = index.delete_snapshot(&job_id, timestamp);
    }

    // 3. Remove snapshot folder from disk
    let snapshot_dir = Path::new(&validated).join(&folder_name);
    let mut freed_bytes: u64 = 0;
    let mut folder_removed = false;

    if snapshot_dir.is_dir() {
        // Verify the folder is within the destination (prevent path traversal)
        let canonical_dest = Path::new(&validated)
            .canonicalize()
            .map_err(|e| AmberError::InvalidPath(format!("Cannot resolve dest: {}", e)))?;
        let canonical_snap = snapshot_dir
            .canonicalize()
            .map_err(|e| AmberError::InvalidPath(format!("Cannot resolve snapshot: {}", e)))?;

        if !canonical_snap.starts_with(&canonical_dest) {
            return Err(AmberError::PermissionDenied(
                "Snapshot folder is outside destination".to_string(),
            ));
        }

        // Calculate size before deletion
        freed_bytes = dir_size(&canonical_snap);

        // Remove the directory
        tokio::fs::remove_dir_all(&canonical_snap)
            .await
            .map_err(|e| {
                AmberError::Filesystem(format!("Failed to remove snapshot folder: {}", e))
            })?;
        folder_removed = true;
    }

    Ok(PruneResult {
        freed_bytes,
        folder_removed,
    })
}

/// Recursively calculate directory size in bytes.
fn dir_size(path: &Path) -> u64 {
    let mut total: u64 = 0;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let meta = entry.metadata();
            if let Ok(meta) = meta {
                if meta.is_dir() {
                    total += dir_size(&entry.path());
                } else {
                    total += meta.len();
                }
            }
        }
    }
    total
}
