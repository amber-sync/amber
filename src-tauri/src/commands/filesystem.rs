use crate::error::Result;
use crate::services::file_service::{FileEntry, FileService};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified: u64,
}

impl From<FileEntry> for DirEntry {
    fn from(e: FileEntry) -> Self {
        Self {
            name: e.name,
            path: e.path,
            is_directory: e.is_dir,
            size: e.size,
            modified: e.modified,
        }
    }
}

#[tauri::command]
pub async fn read_dir(path: String) -> Result<Vec<DirEntry>> {
    let service = FileService::new();
    let entries = service.scan_directory(&path)?;
    Ok(entries.into_iter().map(DirEntry::from).collect())
}

#[tauri::command]
pub async fn select_directory() -> Result<Option<String>> {
    // In Tauri v2, dialog must be handled via the dialog plugin from frontend
    // This is a placeholder - actual implementation uses tauri-plugin-dialog
    Ok(None)
}

#[tauri::command]
pub async fn read_file_preview(file_path: String, max_lines: Option<usize>) -> Result<String> {
    let service = FileService::new();
    service.read_file_preview(&file_path, max_lines.unwrap_or(100))
}

#[tauri::command]
pub async fn read_file_as_base64(file_path: String) -> Result<String> {
    let service = FileService::new();
    service.read_file_base64(&file_path)
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<()> {
    let service = FileService::new();
    service.open_path(&path)
}

#[tauri::command]
pub async fn show_item_in_folder(path: String) -> Result<()> {
    let service = FileService::new();
    service.show_in_folder(&path)
}

#[tauri::command]
pub async fn get_disk_stats(path: String) -> Result<String> {
    use std::process::Command;

    let output = Command::new("df")
        .args(["-h", &path])
        .output()?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
