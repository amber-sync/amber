use crate::error::Result;
use crate::services::snapshot_service::SnapshotService;
use crate::types::snapshot::{FileNode, SnapshotMetadata};
use std::path::PathBuf;

fn get_snapshot_service() -> SnapshotService {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("amber-backup");
    SnapshotService::new(&data_dir)
}

#[tauri::command]
pub async fn list_snapshots(job_id: String, dest_path: String) -> Result<Vec<SnapshotMetadata>> {
    let service = get_snapshot_service();
    service.list_snapshots(&job_id, &dest_path)
}

#[tauri::command]
pub async fn get_snapshot_tree(
    job_id: String,
    timestamp: i64,
    snapshot_path: String,
) -> Result<Vec<FileNode>> {
    let service = get_snapshot_service();
    service.get_snapshot_tree(&job_id, timestamp, &snapshot_path)
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
    let mut args = vec![
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
