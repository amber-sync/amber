use crate::error::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified: u64,
}

#[tauri::command]
pub async fn read_dir(_path: String) -> Result<Vec<FileEntry>> {
    // TODO: Implement directory reading
    Ok(vec![])
}

#[tauri::command]
pub async fn select_directory() -> Result<Option<String>> {
    // TODO: Implement directory selection dialog
    Ok(None)
}

#[tauri::command]
pub async fn read_file_preview(_file_path: String, _max_lines: Option<usize>) -> Result<String> {
    // TODO: Implement file preview
    Ok(String::new())
}

#[tauri::command]
pub async fn read_file_as_base64(_file_path: String) -> Result<String> {
    // TODO: Implement base64 file reading
    Ok(String::new())
}

#[tauri::command]
pub async fn open_path(_path: String) -> Result<()> {
    // TODO: Implement path opening
    Ok(())
}

#[tauri::command]
pub async fn show_item_in_folder(_path: String) -> Result<()> {
    // TODO: Implement show in folder
    Ok(())
}

#[tauri::command]
pub async fn get_disk_stats(_path: String) -> Result<String> {
    // TODO: Implement disk stats retrieval
    Ok(String::new())
}
