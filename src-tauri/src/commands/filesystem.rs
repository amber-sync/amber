use crate::error::Result;
use crate::services::file_service::FileEntry;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

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
pub async fn read_dir(state: State<'_, AppState>, path: String) -> Result<Vec<DirEntry>> {
    let entries = state.file_service.scan_directory(&path)?;
    Ok(entries.into_iter().map(DirEntry::from).collect())
}

#[tauri::command]
pub async fn read_file_preview(
    state: State<'_, AppState>,
    file_path: String,
    max_lines: Option<usize>,
) -> Result<String> {
    state
        .file_service
        .read_file_preview(&file_path, max_lines.unwrap_or(100))
}

#[tauri::command]
pub async fn read_file_as_base64(state: State<'_, AppState>, file_path: String) -> Result<String> {
    state.file_service.read_file_base64(&file_path)
}

#[tauri::command]
pub async fn open_path(state: State<'_, AppState>, path: String) -> Result<()> {
    state.file_service.open_path(&path)
}

#[tauri::command]
pub async fn show_item_in_folder(state: State<'_, AppState>, path: String) -> Result<()> {
    state.file_service.show_in_folder(&path)
}

#[tauri::command]
pub async fn get_disk_stats(path: String) -> Result<String> {
    use std::process::Command;

    let output = Command::new("df")
        .args(["-h", &path])
        .output()?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Get volume info for any path (returns stats of the containing filesystem)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeStats {
    pub total_bytes: u64,
    pub available_bytes: u64,
}

#[tauri::command]
pub async fn get_volume_info(path: String) -> Result<VolumeStats> {
    use std::process::Command;

    // Use df -k to get stats in 1K blocks for any path
    // This works for any directory, not just mounted volumes
    let output = Command::new("df")
        .args(["-k", &path])
        .output()?;

    if !output.status.success() {
        return Err(crate::error::AmberError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            "df command failed",
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = stdout.lines().collect();

    if lines.len() < 2 {
        return Err(crate::error::AmberError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            "Unexpected df output",
        )));
    }

    // Parse the second line (first is header)
    // Format: Filesystem 1K-blocks Used Available Capacity Mounted on
    let parts: Vec<&str> = lines[1].split_whitespace().collect();
    if parts.len() < 4 {
        return Err(crate::error::AmberError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            "Unexpected df output format",
        )));
    }

    let total_kb: u64 = parts[1].parse().unwrap_or(0);
    let available_kb: u64 = parts[3].parse().unwrap_or(0);

    Ok(VolumeStats {
        total_bytes: total_kb * 1024,
        available_bytes: available_kb * 1024,
    })
}

// ===== TIM-47: Volume listing and search =====

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeInfo {
    pub name: String,
    pub path: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub is_external: bool,
}

/// List mounted volumes (external drives)
#[tauri::command]
pub async fn list_volumes() -> Result<Vec<VolumeInfo>> {
    use std::fs;

    let volumes_path = std::path::Path::new("/Volumes");
    let mut volumes = Vec::new();

    // System volumes to exclude
    let system_volumes = ["Macintosh HD", "Macintosh HD - Data", "Recovery", "Preboot", "VM", "Update"];

    if volumes_path.exists() {
        for entry in fs::read_dir(volumes_path)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            let path = entry.path();

            // Skip system volumes
            if system_volumes.contains(&name.as_str()) {
                continue;
            }

            // Skip hidden volumes
            if name.starts_with('.') {
                continue;
            }

            // Get volume stats using statvfs
            if let Ok(stats) = get_volume_stats(&path) {
                volumes.push(VolumeInfo {
                    name: name.clone(),
                    path: path.to_string_lossy().to_string(),
                    total_bytes: stats.0,
                    free_bytes: stats.1,
                    is_external: true, // All volumes in /Volumes are external (except system)
                });
            }
        }
    }

    Ok(volumes)
}

/// Get volume stats (total bytes, free bytes)
fn get_volume_stats(path: &std::path::Path) -> std::io::Result<(u64, u64)> {
    use std::process::Command;

    // Use df command to get disk info
    let output = Command::new("df")
        .args(["-k", path.to_str().unwrap_or("/")])
        .output()?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = output_str.lines().collect();

    if lines.len() >= 2 {
        let parts: Vec<&str> = lines[1].split_whitespace().collect();
        if parts.len() >= 4 {
            // df -k outputs in 1K blocks
            let total = parts[1].parse::<u64>().unwrap_or(0) * 1024;
            let available = parts[3].parse::<u64>().unwrap_or(0) * 1024;
            return Ok((total, available));
        }
    }

    Ok((0, 0))
}

/// Search files in a volume by pattern (fuzzy filename match)
#[tauri::command]
pub async fn search_volume(
    volume_path: String,
    pattern: String,
    limit: Option<usize>,
) -> Result<Vec<crate::types::snapshot::FileNode>> {
    use jwalk::WalkDir;
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Mutex;

    let limit = limit.unwrap_or(50);
    let pattern_lower = pattern.to_lowercase();
    let count = AtomicUsize::new(0);
    let results = Mutex::new(Vec::new());

    // Use jwalk for fast parallel directory walking
    // Limit depth to 5 for performance
    let walker = WalkDir::new(&volume_path)
        .skip_hidden(true)
        .max_depth(5)
        .parallelism(jwalk::Parallelism::RayonNewPool(4));

    walker.into_iter().par_bridge().for_each(|entry| {
        if count.load(Ordering::Relaxed) >= limit {
            return;
        }

        if let Ok(entry) = entry {
            let name = entry.file_name().to_string_lossy().to_string();
            let name_lower = name.to_lowercase();

            // Fuzzy match: check if pattern chars appear in order
            if fuzzy_match(&pattern_lower, &name_lower) {
                if let Ok(metadata) = entry.metadata() {
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or(0);

                    let path_str = entry.path().to_string_lossy().to_string();
                    let node = crate::types::snapshot::FileNode {
                        id: path_str.clone(),
                        name,
                        node_type: if metadata.is_dir() { "FOLDER".to_string() } else { "FILE".to_string() },
                        size: metadata.len(),
                        modified,
                        children: None,
                        path: path_str,
                    };

                    let mut results_guard = results.lock().unwrap();
                    if results_guard.len() < limit {
                        results_guard.push(node);
                        count.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
        }
    });

    Ok(results.into_inner().unwrap())
}

/// Simple fuzzy matching: checks if all pattern chars appear in text in order
fn fuzzy_match(pattern: &str, text: &str) -> bool {
    if pattern.is_empty() {
        return true;
    }

    // First try substring match (faster)
    if text.contains(pattern) {
        return true;
    }

    // Then try fuzzy match (pattern chars in order)
    let mut pattern_chars = pattern.chars().peekable();
    for c in text.chars() {
        if pattern_chars.peek() == Some(&c) {
            pattern_chars.next();
            if pattern_chars.peek().is_none() {
                return true;
            }
        }
    }

    false
}
