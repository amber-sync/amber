use crate::error::Result;
use crate::services::index_service::IndexService;
use crate::services::snapshot_service::SnapshotService;
use crate::types::snapshot::{FileNode, SnapshotMetadata};
use std::path::PathBuf;
use std::sync::OnceLock;

static INDEX_SERVICE: OnceLock<IndexService> = OnceLock::new();

fn get_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("amber-backup")
}

fn get_snapshot_service() -> SnapshotService {
    SnapshotService::new(&get_data_dir())
}

fn get_index_service() -> &'static IndexService {
    INDEX_SERVICE.get_or_init(|| {
        IndexService::new(&get_data_dir()).expect("Failed to initialize index service")
    })
}

#[tauri::command]
pub async fn list_snapshots(job_id: String, dest_path: String) -> Result<Vec<SnapshotMetadata>> {
    let service = get_snapshot_service();
    service.list_snapshots(&job_id, &dest_path)
}

/// Get snapshot tree - uses SQLite index if available, falls back to filesystem scan
#[tauri::command]
pub async fn get_snapshot_tree(
    job_id: String,
    timestamp: i64,
    snapshot_path: String,
) -> Result<Vec<FileNode>> {
    let index_service = get_index_service();

    // Check if snapshot is indexed
    if index_service.is_indexed(&job_id, timestamp)? {
        // Use fast SQLite query (root-level files)
        return index_service.get_directory_contents(&job_id, timestamp, "");
    }

    // Fall back to filesystem scan (legacy behavior)
    let snapshot_service = get_snapshot_service();
    snapshot_service.get_snapshot_tree(&job_id, timestamp, &snapshot_path)
}

/// Get directory contents from index (fast)
#[tauri::command]
pub async fn get_indexed_directory(
    job_id: String,
    timestamp: i64,
    parent_path: String,
) -> Result<Vec<FileNode>> {
    let index_service = get_index_service();
    index_service.get_directory_contents(&job_id, timestamp, &parent_path)
}

/// Index a snapshot after backup completes
#[tauri::command]
pub async fn index_snapshot(
    job_id: String,
    timestamp: i64,
    snapshot_path: String,
) -> Result<crate::services::index_service::IndexedSnapshot> {
    let index_service = get_index_service();
    index_service.index_snapshot(&job_id, timestamp, &snapshot_path)
}

/// Check if a snapshot is indexed
#[tauri::command]
pub async fn is_snapshot_indexed(job_id: String, timestamp: i64) -> Result<bool> {
    let index_service = get_index_service();
    index_service.is_indexed(&job_id, timestamp)
}

/// Search files in a snapshot
#[tauri::command]
pub async fn search_snapshot_files(
    job_id: String,
    timestamp: i64,
    pattern: String,
    limit: Option<usize>,
) -> Result<Vec<FileNode>> {
    let index_service = get_index_service();
    index_service.search_files(&job_id, timestamp, &pattern, limit.unwrap_or(100))
}

/// Get snapshot statistics from index
#[tauri::command]
pub async fn get_snapshot_stats(job_id: String, timestamp: i64) -> Result<(i64, i64)> {
    let index_service = get_index_service();
    index_service.get_snapshot_stats(&job_id, timestamp)
}

/// Delete a snapshot from the index
#[tauri::command]
pub async fn delete_snapshot_index(job_id: String, timestamp: i64) -> Result<()> {
    let index_service = get_index_service();
    index_service.delete_snapshot(&job_id, timestamp)
}

/// Delete all indexed snapshots for a job
#[tauri::command]
pub async fn delete_job_index(job_id: String) -> Result<()> {
    let index_service = get_index_service();
    index_service.delete_job_snapshots(&job_id)
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
