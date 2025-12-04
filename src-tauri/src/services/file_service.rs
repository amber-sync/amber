use crate::error::{AmberError, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
}

pub struct FileService;

impl FileService {
    pub fn new() -> Self {
        Self
    }

    /// Scans a directory and returns all entries (single level)
    pub fn scan_directory(&self, dir_path: &str) -> Result<Vec<FileEntry>> {
        let path = Path::new(dir_path);
        if !path.exists() {
            return Err(AmberError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("Directory not found: {}", dir_path),
            )));
        }

        let mut entries = Vec::new();

        for entry in WalkDir::new(path).min_depth(1).max_depth(1) {
            if let Ok(e) = entry {
                if let Ok(metadata) = e.metadata() {
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    entries.push(FileEntry {
                        path: e.path().to_string_lossy().to_string(),
                        name: e.file_name().to_string_lossy().to_string(),
                        is_dir: metadata.is_dir(),
                        size: metadata.len(),
                        modified,
                    });
                }
            }
        }

        Ok(entries)
    }

    /// Recursively scans a directory
    pub fn scan_recursive(&self, dir_path: &str, max_depth: usize) -> Result<Vec<FileEntry>> {
        let path = Path::new(dir_path);
        if !path.exists() {
            return Err(AmberError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("Directory not found: {}", dir_path),
            )));
        }

        let mut entries = Vec::new();

        for entry in WalkDir::new(path).min_depth(1).max_depth(max_depth) {
            if let Ok(e) = entry {
                if let Ok(metadata) = e.metadata() {
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    entries.push(FileEntry {
                        path: e.path().to_string_lossy().to_string(),
                        name: e.file_name().to_string_lossy().to_string(),
                        is_dir: metadata.is_dir(),
                        size: metadata.len(),
                        modified,
                    });
                }
            }
        }

        Ok(entries)
    }

    /// Read file content as string (for preview)
    pub fn read_file_preview(&self, file_path: &str, max_lines: usize) -> Result<String> {
        use std::fs::File;
        use std::io::{BufRead, BufReader};

        let file = File::open(file_path)?;
        let reader = BufReader::new(file);
        let mut lines = Vec::new();

        for line in reader.lines().take(max_lines) {
            match line {
                Ok(l) => lines.push(l),
                Err(_) => break,
            }
        }

        Ok(lines.join("\n"))
    }

    /// Read file as base64
    pub fn read_file_base64(&self, file_path: &str) -> Result<String> {
        use base64::{engine::general_purpose::STANDARD, Engine};
        let bytes = std::fs::read(file_path)?;
        Ok(STANDARD.encode(bytes))
    }

    /// Open path with default application
    pub fn open_path(&self, path: &str) -> Result<()> {
        open::that(path).map_err(|e| {
            AmberError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                e.to_string(),
            ))
        })
    }

    /// Show item in Finder
    #[cfg(target_os = "macos")]
    pub fn show_in_folder(&self, path: &str) -> Result<()> {
        use std::process::Command;
        Command::new("open")
            .args(["-R", path])
            .spawn()
            .map_err(AmberError::Io)?;
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    pub fn show_in_folder(&self, path: &str) -> Result<()> {
        let parent = std::path::Path::new(path)
            .parent()
            .unwrap_or(std::path::Path::new(path));
        self.open_path(parent.to_str().unwrap_or(path))
    }
}

impl Default for FileService {
    fn default() -> Self {
        Self::new()
    }
}
