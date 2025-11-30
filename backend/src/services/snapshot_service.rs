use crate::error::Result;
use crate::types::snapshot::{FileNode, SnapshotMetadata};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
struct CachedSnapshot {
    timestamp: i64,
    stats: SnapshotStats,
    tree: Vec<FileNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SnapshotStats {
    size_bytes: u64,
    file_count: u64,
}

pub struct SnapshotService {
    cache_dir: PathBuf,
}

impl SnapshotService {
    pub fn new(app_data_dir: &Path) -> Self {
        let cache_dir = app_data_dir.join("snapshot-cache");
        let _ = std::fs::create_dir_all(&cache_dir);
        Self { cache_dir }
    }

    fn get_cache_path(&self, job_id: &str, timestamp: i64) -> PathBuf {
        self.cache_dir.join(format!("{}-{}.json", job_id, timestamp))
    }

    /// List all snapshots for a job
    pub fn list_snapshots(&self, job_id: &str, dest_path: &str) -> Result<Vec<SnapshotMetadata>> {
        let backup_pattern = Regex::new(r"^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})$")
            .map_err(|e| crate::error::AmberError::Snapshot(e.to_string()))?;

        let mut snapshots = Vec::new();

        let entries = match std::fs::read_dir(dest_path) {
            Ok(e) => e,
            Err(_) => return Ok(snapshots),
        };

        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let name = match entry.file_name().to_str() {
                Some(n) => n.to_string(),
                None => continue,
            };

            if let Some(caps) = backup_pattern.captures(&name) {
                let timestamp = self.parse_backup_timestamp(&caps);
                let full_path = path.to_string_lossy().to_string();

                let (size_bytes, file_count) =
                    self.load_cached_stats(job_id, timestamp).unwrap_or((0, 0));

                snapshots.push(SnapshotMetadata {
                    id: timestamp.to_string(),
                    timestamp,
                    date: chrono::DateTime::from_timestamp(timestamp / 1000, 0)
                        .map(|d| d.to_rfc3339())
                        .unwrap_or_default(),
                    size_bytes,
                    file_count,
                    path: full_path,
                });
            }
        }

        snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(snapshots)
    }

    fn parse_backup_timestamp(&self, caps: &regex::Captures) -> i64 {
        let year: i32 = caps[1].parse().unwrap_or(0);
        let month: u32 = caps[2].parse().unwrap_or(1);
        let day: u32 = caps[3].parse().unwrap_or(1);
        let hour: u32 = caps[4].parse().unwrap_or(0);
        let min: u32 = caps[5].parse().unwrap_or(0);
        let sec: u32 = caps[6].parse().unwrap_or(0);

        chrono::NaiveDate::from_ymd_opt(year, month, day)
            .and_then(|d| d.and_hms_opt(hour, min, sec))
            .map(|dt| dt.and_utc().timestamp_millis())
            .unwrap_or(0)
    }

    fn load_cached_stats(&self, job_id: &str, timestamp: i64) -> Option<(u64, u64)> {
        let cache_path = self.get_cache_path(job_id, timestamp);
        let data = std::fs::read_to_string(&cache_path).ok()?;
        let cached: CachedSnapshot = serde_json::from_str(&data).ok()?;
        Some((cached.stats.size_bytes, cached.stats.file_count))
    }

    /// Get the file tree for a snapshot
    pub fn get_snapshot_tree(
        &self,
        job_id: &str,
        timestamp: i64,
        snapshot_path: &str,
    ) -> Result<Vec<FileNode>> {
        let cache_path = self.get_cache_path(job_id, timestamp);

        if let Ok(data) = std::fs::read_to_string(&cache_path) {
            if let Ok(cached) = serde_json::from_str::<CachedSnapshot>(&data) {
                return Ok(cached.tree);
            }
        }

        self.index_snapshot(job_id, timestamp, snapshot_path)
    }

    /// Index a snapshot and cache the result
    pub fn index_snapshot(
        &self,
        job_id: &str,
        timestamp: i64,
        snapshot_path: &str,
    ) -> Result<Vec<FileNode>> {
        let entries = self.scan_directory(snapshot_path)?;
        let tree = self.build_file_tree(snapshot_path, &entries);
        let stats = self.calculate_stats(&tree);

        let cached = CachedSnapshot {
            timestamp,
            stats: SnapshotStats {
                size_bytes: stats.0,
                file_count: stats.1,
            },
            tree: tree.clone(),
        };

        let cache_path = self.get_cache_path(job_id, timestamp);
        if let Ok(json) = serde_json::to_string(&cached) {
            let _ = std::fs::write(&cache_path, json);
        }

        Ok(tree)
    }

    fn scan_directory(&self, dir_path: &str) -> Result<Vec<ScanEntry>> {
        let mut entries = Vec::new();

        for entry in WalkDir::new(dir_path).min_depth(1) {
            if let Ok(e) = entry {
                if let Ok(metadata) = e.metadata() {
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as i64)
                        .unwrap_or(0);

                    entries.push(ScanEntry {
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

    fn build_file_tree(&self, root_dir: &str, entries: &[ScanEntry]) -> Vec<FileNode> {
        let normalized_root = root_dir.trim_end_matches('/');
        let mut map: HashMap<String, FileNode> = HashMap::new();
        let mut tree = Vec::new();

        for entry in entries {
            if entry.path == normalized_root {
                continue;
            }

            let rel_path = Path::new(&entry.path)
                .strip_prefix(normalized_root)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| entry.name.clone());

            let root_name = Path::new(normalized_root)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("root");

            let node = FileNode {
                id: format!("{}-{}", root_name, rel_path.replace('/', "-")),
                name: entry.name.clone(),
                node_type: if entry.is_dir {
                    "FOLDER".to_string()
                } else {
                    "FILE".to_string()
                },
                size: entry.size,
                modified: entry.modified,
                children: if entry.is_dir { Some(Vec::new()) } else { None },
                path: entry.path.clone(),
            };

            map.insert(entry.path.clone(), node);
        }

        for entry in entries {
            if entry.path == normalized_root {
                continue;
            }

            let parent_path = Path::new(&entry.path)
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            if parent_path == normalized_root {
                if let Some(node) = map.remove(&entry.path) {
                    tree.push(node);
                }
            } else if let Some(node) = map.remove(&entry.path) {
                if let Some(parent) = map.get_mut(&parent_path) {
                    if let Some(ref mut children) = parent.children {
                        children.push(node);
                    }
                }
            }
        }

        tree
    }

    fn calculate_stats(&self, nodes: &[FileNode]) -> (u64, u64) {
        let mut size = 0u64;
        let mut count = 0u64;

        for node in nodes {
            if node.node_type == "FOLDER" {
                if let Some(ref children) = node.children {
                    let (s, c) = self.calculate_stats(children);
                    size += s;
                    count += c;
                }
            } else {
                size += node.size;
                count += 1;
            }
        }

        (size, count)
    }
}

#[derive(Debug)]
struct ScanEntry {
    path: String,
    name: String,
    is_dir: bool,
    size: u64,
    modified: i64,
}
