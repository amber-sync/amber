use crate::error::Result;
use crate::services::manifest_service;
use crate::types::snapshot::{file_type, FileNode, SnapshotMetadata};
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
    ///
    /// Priority order for stats:
    /// 1. Manifest.json (authoritative, created during backup)
    /// 2. Legacy JSON cache (for backwards compatibility)
    /// 3. Default to (0, 0) with warning log
    pub fn list_snapshots(&self, job_id: &str, dest_path: &str) -> Result<Vec<SnapshotMetadata>> {
        // Try to read from manifest first (authoritative source)
        if let Some(snapshots) = self.list_snapshots_from_manifest(dest_path) {
            log::debug!(
                "[snapshot_service] Loaded {} snapshots from manifest for job {}",
                snapshots.len(),
                job_id
            );
            return Ok(snapshots);
        }

        // Fall back to filesystem scan with cache lookup
        log::debug!(
            "[snapshot_service] No manifest found, falling back to filesystem scan for job {}",
            job_id
        );
        self.list_snapshots_from_filesystem(job_id, dest_path)
    }

    /// Read snapshots from manifest.json (preferred method)
    fn list_snapshots_from_manifest(&self, dest_path: &str) -> Option<Vec<SnapshotMetadata>> {
        // Use blocking read since this is a sync function
        let manifest_path = manifest_service::get_manifest_path(dest_path);

        let data = std::fs::read_to_string(&manifest_path).ok()?;
        let manifest: crate::types::manifest::BackupManifest =
            serde_json::from_str(&data).ok()?;

        let mut snapshots: Vec<SnapshotMetadata> = manifest
            .snapshots
            .iter()
            .map(|s| {
                let full_path = Path::new(dest_path)
                    .join(&s.folder_name)
                    .to_string_lossy()
                    .to_string();

                SnapshotMetadata {
                    id: s.id.clone(),
                    timestamp: s.timestamp,
                    date: chrono::DateTime::from_timestamp(s.timestamp / 1000, 0)
                        .map(|d| d.to_rfc3339())
                        .unwrap_or_default(),
                    size_bytes: s.total_size,
                    file_count: s.file_count,
                    path: full_path,
                }
            })
            .collect();

        snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Some(snapshots)
    }

    /// Fall back to filesystem scan with cache lookup (legacy method)
    fn list_snapshots_from_filesystem(
        &self,
        job_id: &str,
        dest_path: &str,
    ) -> Result<Vec<SnapshotMetadata>> {
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

                // Try cache first, log warning if missing
                let (size_bytes, file_count) = match self.load_cached_stats(job_id, timestamp) {
                    Some(stats) => stats,
                    None => {
                        log::warn!(
                            "[snapshot_service] No cached stats for snapshot {} (job {}), returning zeros. \
                             Consider running index_snapshot() to populate stats.",
                            timestamp,
                            job_id
                        );
                        (0, 0)
                    }
                };

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
                    file_type::DIR.to_string()
                } else {
                    file_type::FILE.to_string()
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
            if file_type::is_dir(&node.node_type) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_service() -> (SnapshotService, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let service = SnapshotService::new(temp_dir.path());
        (service, temp_dir)
    }

    #[test]
    fn test_parse_backup_timestamp() {
        let (service, _temp) = create_test_service();
        let re = Regex::new(r"^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})$").unwrap();

        // Test: 2024-03-15-143022
        let caps = re.captures("2024-03-15-143022").unwrap();
        let ts = service.parse_backup_timestamp(&caps);

        // Should be March 15, 2024 at 14:30:22 UTC
        let expected = chrono::NaiveDate::from_ymd_opt(2024, 3, 15)
            .unwrap()
            .and_hms_opt(14, 30, 22)
            .unwrap()
            .and_utc()
            .timestamp_millis();

        assert_eq!(ts, expected);
    }

    #[test]
    fn test_parse_backup_timestamp_midnight() {
        let (service, _temp) = create_test_service();
        let re = Regex::new(r"^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})$").unwrap();

        let caps = re.captures("2025-01-01-000000").unwrap();
        let ts = service.parse_backup_timestamp(&caps);

        let expected = chrono::NaiveDate::from_ymd_opt(2025, 1, 1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp_millis();

        assert_eq!(ts, expected);
    }

    #[test]
    fn test_calculate_stats_empty() {
        let (service, _temp) = create_test_service();
        let nodes: Vec<FileNode> = vec![];

        let (size, count) = service.calculate_stats(&nodes);
        assert_eq!(size, 0);
        assert_eq!(count, 0);
    }

    #[test]
    fn test_calculate_stats_files_only() {
        let (service, _temp) = create_test_service();
        let nodes = vec![
            FileNode {
                id: "file1".to_string(),
                name: "file1.txt".to_string(),
                node_type: file_type::FILE.to_string(),
                size: 100,
                modified: 0,
                children: None,
                path: "/test/file1.txt".to_string(),
            },
            FileNode {
                id: "file2".to_string(),
                name: "file2.txt".to_string(),
                node_type: file_type::FILE.to_string(),
                size: 200,
                modified: 0,
                children: None,
                path: "/test/file2.txt".to_string(),
            },
        ];

        let (size, count) = service.calculate_stats(&nodes);
        assert_eq!(size, 300);
        assert_eq!(count, 2);
    }

    #[test]
    fn test_calculate_stats_nested_folders() {
        let (service, _temp) = create_test_service();
        let nodes = vec![FileNode {
            id: "folder1".to_string(),
            name: "folder1".to_string(),
            node_type: file_type::DIR.to_string(),
            size: 0,
            modified: 0,
            path: "/test/folder1".to_string(),
            children: Some(vec![
                FileNode {
                    id: "file1".to_string(),
                    name: "file1.txt".to_string(),
                    node_type: file_type::FILE.to_string(),
                    size: 100,
                    modified: 0,
                    children: None,
                    path: "/test/folder1/file1.txt".to_string(),
                },
                FileNode {
                    id: "subfolder".to_string(),
                    name: "subfolder".to_string(),
                    node_type: file_type::DIR.to_string(),
                    size: 0,
                    modified: 0,
                    path: "/test/folder1/subfolder".to_string(),
                    children: Some(vec![FileNode {
                        id: "file2".to_string(),
                        name: "file2.txt".to_string(),
                        node_type: file_type::FILE.to_string(),
                        size: 500,
                        modified: 0,
                        children: None,
                        path: "/test/folder1/subfolder/file2.txt".to_string(),
                    }]),
                },
            ]),
        }];

        let (size, count) = service.calculate_stats(&nodes);
        assert_eq!(size, 600);
        assert_eq!(count, 2);
    }

    #[test]
    fn test_list_snapshots_empty_dir() {
        let (service, temp) = create_test_service();
        let dest_dir = temp.path().join("dest");
        std::fs::create_dir_all(&dest_dir).unwrap();

        let snapshots = service
            .list_snapshots("job1", dest_dir.to_str().unwrap())
            .unwrap();
        assert!(snapshots.is_empty());
    }

    #[test]
    fn test_list_snapshots_filters_non_matching() {
        let (service, temp) = create_test_service();
        let dest_dir = temp.path().join("dest");
        std::fs::create_dir_all(&dest_dir).unwrap();

        // Create valid snapshot dirs
        std::fs::create_dir_all(dest_dir.join("2024-03-15-140000")).unwrap();
        std::fs::create_dir_all(dest_dir.join("2024-03-16-080000")).unwrap();

        // Create invalid dirs
        std::fs::create_dir_all(dest_dir.join("not-a-snapshot")).unwrap();
        std::fs::create_dir_all(dest_dir.join("latest")).unwrap();

        let snapshots = service
            .list_snapshots("job1", dest_dir.to_str().unwrap())
            .unwrap();

        assert_eq!(snapshots.len(), 2);
    }

    #[test]
    fn test_list_snapshots_sorted_newest_first() {
        let (service, temp) = create_test_service();
        let dest_dir = temp.path().join("dest");
        std::fs::create_dir_all(&dest_dir).unwrap();

        std::fs::create_dir_all(dest_dir.join("2024-01-01-120000")).unwrap();
        std::fs::create_dir_all(dest_dir.join("2024-06-15-090000")).unwrap();
        std::fs::create_dir_all(dest_dir.join("2024-03-10-180000")).unwrap();

        let snapshots = service
            .list_snapshots("job1", dest_dir.to_str().unwrap())
            .unwrap();

        assert_eq!(snapshots.len(), 3);
        assert!(snapshots[0].timestamp > snapshots[1].timestamp);
        assert!(snapshots[1].timestamp > snapshots[2].timestamp);
    }

    #[test]
    fn test_cache_path_format() {
        let (service, _temp) = create_test_service();
        let path = service.get_cache_path("job-123", 1700000000000);

        assert!(path.to_string_lossy().contains("job-123-1700000000000.json"));
    }

    #[test]
    fn test_scan_directory_with_real_files() {
        let (service, temp) = create_test_service();
        let test_dir = temp.path().join("scan-test");
        std::fs::create_dir_all(&test_dir).unwrap();

        // Create files
        std::fs::write(test_dir.join("file1.txt"), "hello").unwrap();
        std::fs::write(test_dir.join("file2.txt"), "world").unwrap();
        std::fs::create_dir_all(test_dir.join("subdir")).unwrap();
        std::fs::write(test_dir.join("subdir/nested.txt"), "nested").unwrap();

        let entries = service.scan_directory(test_dir.to_str().unwrap()).unwrap();

        assert_eq!(entries.len(), 4); // file1, file2, subdir, nested
        assert!(entries.iter().any(|e| e.name == "file1.txt" && !e.is_dir));
        assert!(entries.iter().any(|e| e.name == "subdir" && e.is_dir));
    }

    // =========================================================================
    // Integration tests for manifest-based snapshot loading (TIM-SIM-001)
    // =========================================================================

    #[test]
    fn test_list_snapshots_from_manifest_returns_correct_stats() {
        let (service, temp) = create_test_service();
        let dest_dir = temp.path().join("dest");
        std::fs::create_dir_all(&dest_dir).unwrap();

        // Create .amber-meta directory and manifest.json
        let meta_dir = dest_dir.join(".amber-meta");
        std::fs::create_dir_all(&meta_dir).unwrap();

        // Create manifest with known stats
        let manifest_json = r#"{
            "version": 1,
            "machineId": "test-machine",
            "machineName": "Test",
            "jobId": "job-123",
            "jobName": "Test Job",
            "sourcePath": "/source",
            "createdAt": 1700000000000,
            "updatedAt": 1700000000000,
            "snapshots": [
                {
                    "id": "1700000000000",
                    "timestamp": 1700000000000,
                    "folderName": "2024-01-15-120000",
                    "fileCount": 500,
                    "totalSize": 1048576,
                    "status": "Complete",
                    "durationMs": 5000
                },
                {
                    "id": "1700100000000",
                    "timestamp": 1700100000000,
                    "folderName": "2024-01-16-120000",
                    "fileCount": 750,
                    "totalSize": 2097152,
                    "status": "Complete",
                    "durationMs": 7000
                }
            ]
        }"#;

        std::fs::write(meta_dir.join("manifest.json"), manifest_json).unwrap();

        // List snapshots
        let snapshots = service
            .list_snapshots("job-123", dest_dir.to_str().unwrap())
            .unwrap();

        // Verify stats are loaded from manifest (not zeros!)
        assert_eq!(snapshots.len(), 2);

        // Newest first (sorted by timestamp descending)
        assert_eq!(snapshots[0].file_count, 750);
        assert_eq!(snapshots[0].size_bytes, 2097152);

        assert_eq!(snapshots[1].file_count, 500);
        assert_eq!(snapshots[1].size_bytes, 1048576);
    }

    #[test]
    fn test_list_snapshots_manifest_takes_priority_over_cache() {
        let (service, temp) = create_test_service();
        let dest_dir = temp.path().join("dest");
        std::fs::create_dir_all(&dest_dir).unwrap();

        // Create snapshot directory
        std::fs::create_dir_all(dest_dir.join("2024-01-15-120000")).unwrap();

        // Create a cache file with WRONG stats
        let cache_path = service.get_cache_path("job-123", 1705320000000);
        let wrong_cache = r#"{
            "timestamp": 1705320000000,
            "stats": {"size_bytes": 999, "file_count": 1},
            "tree": []
        }"#;
        std::fs::write(&cache_path, wrong_cache).unwrap();

        // Create manifest with CORRECT stats
        let meta_dir = dest_dir.join(".amber-meta");
        std::fs::create_dir_all(&meta_dir).unwrap();

        let manifest_json = r#"{
            "version": 1,
            "machineId": "test-machine",
            "machineName": "Test",
            "jobId": "job-123",
            "jobName": "Test Job",
            "sourcePath": "/source",
            "createdAt": 1700000000000,
            "updatedAt": 1700000000000,
            "snapshots": [
                {
                    "id": "1705320000000",
                    "timestamp": 1705320000000,
                    "folderName": "2024-01-15-120000",
                    "fileCount": 1000,
                    "totalSize": 5000000,
                    "status": "Complete",
                    "durationMs": 5000
                }
            ]
        }"#;

        std::fs::write(meta_dir.join("manifest.json"), manifest_json).unwrap();

        // List snapshots - should use manifest, not cache
        let snapshots = service
            .list_snapshots("job-123", dest_dir.to_str().unwrap())
            .unwrap();

        assert_eq!(snapshots.len(), 1);
        // Should have manifest values, NOT cache values
        assert_eq!(snapshots[0].file_count, 1000);
        assert_eq!(snapshots[0].size_bytes, 5000000);
    }

    #[test]
    fn test_list_snapshots_falls_back_to_filesystem_without_manifest() {
        let (service, temp) = create_test_service();
        let dest_dir = temp.path().join("dest");
        std::fs::create_dir_all(&dest_dir).unwrap();

        // Create snapshot directories (no manifest)
        std::fs::create_dir_all(dest_dir.join("2024-01-15-120000")).unwrap();
        std::fs::create_dir_all(dest_dir.join("2024-01-16-090000")).unwrap();

        // No manifest, no cache - should return zeros but still find snapshots
        let snapshots = service
            .list_snapshots("job-123", dest_dir.to_str().unwrap())
            .unwrap();

        assert_eq!(snapshots.len(), 2);
        // Without manifest or cache, stats are (0, 0)
        assert_eq!(snapshots[0].file_count, 0);
        assert_eq!(snapshots[0].size_bytes, 0);
    }

    #[test]
    fn test_list_snapshots_from_manifest_constructs_correct_paths() {
        let (service, temp) = create_test_service();
        let dest_dir = temp.path().join("dest");
        std::fs::create_dir_all(&dest_dir).unwrap();

        // Create manifest
        let meta_dir = dest_dir.join(".amber-meta");
        std::fs::create_dir_all(&meta_dir).unwrap();

        let manifest_json = r#"{
            "version": 1,
            "machineId": "test-machine",
            "machineName": "Test",
            "jobId": "job-123",
            "jobName": "Test Job",
            "sourcePath": "/source",
            "createdAt": 1700000000000,
            "updatedAt": 1700000000000,
            "snapshots": [
                {
                    "id": "1700000000000",
                    "timestamp": 1700000000000,
                    "folderName": "2024-01-15-120000",
                    "fileCount": 100,
                    "totalSize": 1000,
                    "status": "Complete",
                    "durationMs": 1000
                }
            ]
        }"#;

        std::fs::write(meta_dir.join("manifest.json"), manifest_json).unwrap();

        let snapshots = service
            .list_snapshots("job-123", dest_dir.to_str().unwrap())
            .unwrap();

        assert_eq!(snapshots.len(), 1);
        // Path should be constructed from dest_path + folder_name
        let expected_path = dest_dir.join("2024-01-15-120000").to_string_lossy().to_string();
        assert_eq!(snapshots[0].path, expected_path);
    }

    #[test]
    fn test_list_snapshots_handles_malformed_manifest_gracefully() {
        let (service, temp) = create_test_service();
        let dest_dir = temp.path().join("dest");
        std::fs::create_dir_all(&dest_dir).unwrap();

        // Create malformed manifest
        let meta_dir = dest_dir.join(".amber-meta");
        std::fs::create_dir_all(&meta_dir).unwrap();
        std::fs::write(meta_dir.join("manifest.json"), "{ invalid json }").unwrap();

        // Create snapshot directory for fallback
        std::fs::create_dir_all(dest_dir.join("2024-01-15-120000")).unwrap();

        // Should fall back to filesystem scan
        let snapshots = service
            .list_snapshots("job-123", dest_dir.to_str().unwrap())
            .unwrap();

        // Should find snapshot via filesystem fallback
        assert_eq!(snapshots.len(), 1);
    }

    #[test]
    fn test_list_snapshots_manifest_generates_correct_date_format() {
        let (service, temp) = create_test_service();
        let dest_dir = temp.path().join("dest");
        std::fs::create_dir_all(&dest_dir).unwrap();

        let meta_dir = dest_dir.join(".amber-meta");
        std::fs::create_dir_all(&meta_dir).unwrap();

        // Timestamp for 2024-01-15 12:00:00 UTC
        let timestamp: i64 = 1705320000000;

        let manifest_json = format!(
            r#"{{
            "version": 1,
            "machineId": "test-machine",
            "machineName": "Test",
            "jobId": "job-123",
            "jobName": "Test Job",
            "sourcePath": "/source",
            "createdAt": {},
            "updatedAt": {},
            "snapshots": [
                {{
                    "id": "{}",
                    "timestamp": {},
                    "folderName": "2024-01-15-120000",
                    "fileCount": 100,
                    "totalSize": 1000,
                    "status": "Complete",
                    "durationMs": 1000
                }}
            ]
        }}"#,
            timestamp, timestamp, timestamp, timestamp
        );

        std::fs::write(meta_dir.join("manifest.json"), manifest_json).unwrap();

        let snapshots = service
            .list_snapshots("job-123", dest_dir.to_str().unwrap())
            .unwrap();

        assert_eq!(snapshots.len(), 1);
        // Date should be RFC3339 format
        assert!(snapshots[0].date.contains("2024-01-15"));
    }
}
