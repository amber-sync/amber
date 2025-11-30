//! SQLite-based snapshot index for fast browsing
//!
//! TIM-46: Replaces JSON file caching with SQLite for instant snapshot browsing.
//! Designed to handle millions of files (full MacBook backup).

use crate::error::{AmberError, Result};
use crate::types::snapshot::FileNode;
use jwalk::WalkDir;
use rayon::prelude::*;
use rusqlite::{params, Connection, Transaction};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Database version for migrations
const DB_VERSION: i32 = 1;

/// Batch size for inserts (performance tuning)
const BATCH_SIZE: usize = 1000;

/// SQLite-based snapshot index service
pub struct IndexService {
    db_path: PathBuf,
    conn: Mutex<Connection>,
}

/// File entry from directory walk
#[derive(Debug, Clone)]
pub struct IndexedFile {
    pub path: String,
    pub name: String,
    pub parent_path: String,
    pub size: i64,
    pub mtime: i64,
    pub inode: Option<i64>,
    pub file_type: FileType,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FileType {
    File,
    Directory,
    Symlink,
}

impl FileType {
    fn as_str(&self) -> &'static str {
        match self {
            FileType::File => "file",
            FileType::Directory => "dir",
            FileType::Symlink => "symlink",
        }
    }

    #[allow(dead_code)]
    fn from_str(s: &str) -> Self {
        match s {
            "dir" => FileType::Directory,
            "symlink" => FileType::Symlink,
            _ => FileType::File,
        }
    }
}

/// Snapshot metadata stored in the index
#[derive(Debug, Clone, serde::Serialize)]
pub struct IndexedSnapshot {
    pub id: i64,
    pub job_id: String,
    pub timestamp: i64,
    pub root_path: String,
    pub file_count: i64,
    pub total_size: i64,
}

impl IndexService {
    /// Create or open the index database
    pub fn new(app_data_dir: &Path) -> Result<Self> {
        let db_path = app_data_dir.join("index.db");

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                AmberError::Index(format!("Failed to create index directory: {}", e))
            })?;
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| AmberError::Index(format!("Failed to open index database: {}", e)))?;

        let service = Self {
            db_path,
            conn: Mutex::new(conn),
        };

        service.initialize_schema()?;
        Ok(service)
    }

    /// Initialize database schema
    fn initialize_schema(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })?;

        // Enable WAL mode for better concurrent read performance
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| AmberError::Index(format!("Failed to set WAL mode: {}", e)))?;

        // Check current version
        let version: i32 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap_or(0);

        if version < DB_VERSION {
            self.run_migrations(&conn, version)?;
        }

        Ok(())
    }

    /// Run database migrations
    fn run_migrations(&self, conn: &Connection, from_version: i32) -> Result<()> {
        if from_version < 1 {
            // Initial schema
            conn.execute_batch(
                r#"
                -- Snapshots table
                CREATE TABLE IF NOT EXISTS snapshots (
                    id INTEGER PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    root_path TEXT NOT NULL,
                    file_count INTEGER DEFAULT 0,
                    total_size INTEGER DEFAULT 0,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    UNIQUE(job_id, timestamp)
                );

                -- Files table (indexed for fast lookup)
                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY,
                    snapshot_id INTEGER NOT NULL,
                    path TEXT NOT NULL,
                    name TEXT NOT NULL,
                    parent_path TEXT NOT NULL,
                    size INTEGER NOT NULL,
                    mtime INTEGER NOT NULL,
                    inode INTEGER,
                    file_type TEXT NOT NULL,
                    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
                );

                -- Indexes for fast queries
                CREATE INDEX IF NOT EXISTS idx_snapshots_job ON snapshots(job_id);
                CREATE INDEX IF NOT EXISTS idx_files_snapshot_parent ON files(snapshot_id, parent_path);
                CREATE INDEX IF NOT EXISTS idx_files_path ON files(snapshot_id, path);
                CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);

                -- Update version
                PRAGMA user_version = 1;
                "#,
            )
            .map_err(|e| AmberError::Index(format!("Migration failed: {}", e)))?;
        }

        Ok(())
    }

    /// Index a snapshot directory using fast parallel walking
    pub fn index_snapshot(
        &self,
        job_id: &str,
        timestamp: i64,
        snapshot_path: &str,
    ) -> Result<IndexedSnapshot> {
        let root_path = Path::new(snapshot_path);
        if !root_path.exists() {
            return Err(AmberError::Index(format!(
                "Snapshot path does not exist: {}",
                snapshot_path
            )));
        }

        // Collect files using jwalk (parallel directory walking)
        let files: Vec<IndexedFile> = self.walk_directory(snapshot_path)?;

        // Calculate stats
        let file_count = files.iter().filter(|f| f.file_type == FileType::File).count() as i64;
        let total_size: i64 = files.iter().map(|f| f.size).sum();

        // Insert into database
        let mut conn = self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })?;

        let tx = conn
            .transaction()
            .map_err(|e| AmberError::Index(format!("Failed to start transaction: {}", e)))?;

        // Delete existing snapshot if re-indexing
        tx.execute(
            "DELETE FROM snapshots WHERE job_id = ? AND timestamp = ?",
            params![job_id, timestamp],
        )
        .map_err(|e| AmberError::Index(format!("Failed to delete existing snapshot: {}", e)))?;

        // Insert snapshot
        tx.execute(
            "INSERT INTO snapshots (job_id, timestamp, root_path, file_count, total_size) VALUES (?, ?, ?, ?, ?)",
            params![job_id, timestamp, snapshot_path, file_count, total_size],
        )
        .map_err(|e| AmberError::Index(format!("Failed to insert snapshot: {}", e)))?;

        let snapshot_id = tx.last_insert_rowid();

        // Batch insert files
        self.batch_insert_files(&tx, snapshot_id, &files)?;

        tx.commit()
            .map_err(|e| AmberError::Index(format!("Failed to commit transaction: {}", e)))?;

        Ok(IndexedSnapshot {
            id: snapshot_id,
            job_id: job_id.to_string(),
            timestamp,
            root_path: snapshot_path.to_string(),
            file_count,
            total_size,
        })
    }

    /// Walk directory using jwalk for parallel performance
    fn walk_directory(&self, root_path: &str) -> Result<Vec<IndexedFile>> {
        let root = Path::new(root_path);
        let root_str = root_path.to_string();

        let entries: Vec<IndexedFile> = WalkDir::new(root)
            .skip_hidden(false)
            .parallelism(jwalk::Parallelism::RayonNewPool(num_cpus::get()))
            .into_iter()
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.path() != root)
            .par_bridge()
            .filter_map(|entry| {
                let path = entry.path();
                let metadata = entry.metadata().ok()?;

                let path_str = path.to_string_lossy().to_string();
                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                let parent_path = path
                    .parent()
                    .map(|p| {
                        p.strip_prefix(&root_str)
                            .unwrap_or(p)
                            .to_string_lossy()
                            .to_string()
                    })
                    .unwrap_or_default();

                let file_type = if metadata.is_dir() {
                    FileType::Directory
                } else if metadata.is_symlink() {
                    FileType::Symlink
                } else {
                    FileType::File
                };

                let mtime = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0);

                #[cfg(unix)]
                let inode = {
                    use std::os::unix::fs::MetadataExt;
                    Some(metadata.ino() as i64)
                };

                #[cfg(not(unix))]
                let inode = None;

                Some(IndexedFile {
                    path: path_str,
                    name,
                    parent_path,
                    size: metadata.len() as i64,
                    mtime,
                    inode,
                    file_type,
                })
            })
            .collect();

        Ok(entries)
    }

    /// Batch insert files for performance
    fn batch_insert_files(
        &self,
        tx: &Transaction,
        snapshot_id: i64,
        files: &[IndexedFile],
    ) -> Result<()> {
        let mut stmt = tx
            .prepare(
                "INSERT INTO files (snapshot_id, path, name, parent_path, size, mtime, inode, file_type)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .map_err(|e| AmberError::Index(format!("Failed to prepare insert statement: {}", e)))?;

        for chunk in files.chunks(BATCH_SIZE) {
            for file in chunk {
                stmt.execute(params![
                    snapshot_id,
                    file.path,
                    file.name,
                    file.parent_path,
                    file.size,
                    file.mtime,
                    file.inode,
                    file.file_type.as_str(),
                ])
                .map_err(|e| AmberError::Index(format!("Failed to insert file: {}", e)))?;
            }
        }

        Ok(())
    }

    /// Get files in a directory (for browsing UI)
    pub fn get_directory_contents(
        &self,
        job_id: &str,
        timestamp: i64,
        parent_path: &str,
    ) -> Result<Vec<FileNode>> {
        let conn = self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })?;

        // Get snapshot ID
        let snapshot_id: i64 = conn
            .query_row(
                "SELECT id FROM snapshots WHERE job_id = ? AND timestamp = ?",
                params![job_id, timestamp],
                |row| row.get(0),
            )
            .map_err(|_| AmberError::Index("Snapshot not found in index".to_string()))?;

        // Get files in directory
        let mut stmt = conn
            .prepare(
                "SELECT path, name, size, mtime, file_type
                 FROM files
                 WHERE snapshot_id = ? AND parent_path = ?
                 ORDER BY file_type DESC, name ASC",
            )
            .map_err(|e| AmberError::Index(format!("Failed to prepare query: {}", e)))?;

        let files = stmt
            .query_map(params![snapshot_id, parent_path], |row| {
                let path: String = row.get(0)?;
                let name: String = row.get(1)?;
                let size: i64 = row.get(2)?;
                let mtime: i64 = row.get(3)?;
                let file_type: String = row.get(4)?;

                let is_dir = file_type == "dir";
                let node_type = if is_dir { "FOLDER" } else { "FILE" };

                Ok(FileNode {
                    id: path.replace('/', "-"),
                    name,
                    node_type: node_type.to_string(),
                    size: size as u64,
                    modified: mtime * 1000, // Convert to millis
                    children: if is_dir { Some(Vec::new()) } else { None },
                    path,
                })
            })
            .map_err(|e| AmberError::Index(format!("Failed to query files: {}", e)))?;

        let mut result = Vec::new();
        for file in files {
            if let Ok(f) = file {
                result.push(f);
            }
        }

        Ok(result)
    }

    /// List all indexed snapshots for a job
    pub fn list_snapshots(&self, job_id: &str) -> Result<Vec<IndexedSnapshot>> {
        let conn = self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })?;

        let mut stmt = conn
            .prepare(
                "SELECT id, job_id, timestamp, root_path, file_count, total_size
                 FROM snapshots
                 WHERE job_id = ?
                 ORDER BY timestamp DESC",
            )
            .map_err(|e| AmberError::Index(format!("Failed to prepare query: {}", e)))?;

        let snapshots = stmt
            .query_map(params![job_id], |row| {
                Ok(IndexedSnapshot {
                    id: row.get(0)?,
                    job_id: row.get(1)?,
                    timestamp: row.get(2)?,
                    root_path: row.get(3)?,
                    file_count: row.get(4)?,
                    total_size: row.get(5)?,
                })
            })
            .map_err(|e| AmberError::Index(format!("Failed to query snapshots: {}", e)))?;

        let mut result = Vec::new();
        for snapshot in snapshots {
            if let Ok(s) = snapshot {
                result.push(s);
            }
        }

        Ok(result)
    }

    /// Check if a snapshot is indexed
    pub fn is_indexed(&self, job_id: &str, timestamp: i64) -> Result<bool> {
        let conn = self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })?;

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM snapshots WHERE job_id = ? AND timestamp = ?",
                params![job_id, timestamp],
                |row| row.get(0),
            )
            .unwrap_or(0);

        Ok(count > 0)
    }

    /// Delete a snapshot from the index
    pub fn delete_snapshot(&self, job_id: &str, timestamp: i64) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })?;

        conn.execute(
            "DELETE FROM snapshots WHERE job_id = ? AND timestamp = ?",
            params![job_id, timestamp],
        )
        .map_err(|e| AmberError::Index(format!("Failed to delete snapshot: {}", e)))?;

        Ok(())
    }

    /// Delete all snapshots for a job
    pub fn delete_job_snapshots(&self, job_id: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })?;

        conn.execute("DELETE FROM snapshots WHERE job_id = ?", params![job_id])
            .map_err(|e| AmberError::Index(format!("Failed to delete job snapshots: {}", e)))?;

        Ok(())
    }

    /// Search files by name pattern
    pub fn search_files(
        &self,
        job_id: &str,
        timestamp: i64,
        pattern: &str,
        limit: usize,
    ) -> Result<Vec<FileNode>> {
        let conn = self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })?;

        // Get snapshot ID
        let snapshot_id: i64 = conn
            .query_row(
                "SELECT id FROM snapshots WHERE job_id = ? AND timestamp = ?",
                params![job_id, timestamp],
                |row| row.get(0),
            )
            .map_err(|_| AmberError::Index("Snapshot not found in index".to_string()))?;

        // Search with LIKE pattern
        let search_pattern = format!("%{}%", pattern);

        let mut stmt = conn
            .prepare(
                "SELECT path, name, size, mtime, file_type
                 FROM files
                 WHERE snapshot_id = ? AND name LIKE ?
                 ORDER BY name ASC
                 LIMIT ?",
            )
            .map_err(|e| AmberError::Index(format!("Failed to prepare query: {}", e)))?;

        let files = stmt
            .query_map(params![snapshot_id, search_pattern, limit as i64], |row| {
                let path: String = row.get(0)?;
                let name: String = row.get(1)?;
                let size: i64 = row.get(2)?;
                let mtime: i64 = row.get(3)?;
                let file_type: String = row.get(4)?;

                let is_dir = file_type == "dir";
                let node_type = if is_dir { "FOLDER" } else { "FILE" };

                Ok(FileNode {
                    id: path.replace('/', "-"),
                    name,
                    node_type: node_type.to_string(),
                    size: size as u64,
                    modified: mtime * 1000,
                    children: if is_dir { Some(Vec::new()) } else { None },
                    path,
                })
            })
            .map_err(|e| AmberError::Index(format!("Failed to search files: {}", e)))?;

        let mut result = Vec::new();
        for file in files {
            if let Ok(f) = file {
                result.push(f);
            }
        }

        Ok(result)
    }

    /// Get snapshot statistics
    pub fn get_snapshot_stats(&self, job_id: &str, timestamp: i64) -> Result<(i64, i64)> {
        let conn = self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })?;

        conn.query_row(
            "SELECT file_count, total_size FROM snapshots WHERE job_id = ? AND timestamp = ?",
            params![job_id, timestamp],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| AmberError::Index("Snapshot not found".to_string()))
    }

    /// Get database path (for debugging)
    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    /// Compact the database (run VACUUM)
    pub fn compact(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })?;

        conn.execute("VACUUM", [])
            .map_err(|e| AmberError::Index(format!("Failed to vacuum database: {}", e)))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_service() -> (IndexService, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let service = IndexService::new(temp_dir.path()).unwrap();
        (service, temp_dir)
    }

    #[test]
    fn test_create_database() {
        let (service, _temp_dir) = create_test_service();
        assert!(service.db_path().exists());
    }

    #[test]
    fn test_index_snapshot() {
        let (service, temp_dir) = create_test_service();

        // Create test directory structure
        let snapshot_dir = temp_dir.path().join("snapshot");
        std::fs::create_dir_all(&snapshot_dir).unwrap();
        std::fs::write(snapshot_dir.join("file1.txt"), "hello").unwrap();
        std::fs::write(snapshot_dir.join("file2.txt"), "world").unwrap();
        std::fs::create_dir_all(snapshot_dir.join("subdir")).unwrap();
        std::fs::write(snapshot_dir.join("subdir/nested.txt"), "nested").unwrap();

        let result = service
            .index_snapshot("job1", 1700000000000, snapshot_dir.to_str().unwrap())
            .unwrap();

        assert_eq!(result.job_id, "job1");
        assert_eq!(result.timestamp, 1700000000000);
        assert_eq!(result.file_count, 3); // 3 files
        assert!(result.total_size > 0);
    }

    #[test]
    fn test_is_indexed() {
        let (service, temp_dir) = create_test_service();

        let snapshot_dir = temp_dir.path().join("snapshot");
        std::fs::create_dir_all(&snapshot_dir).unwrap();
        std::fs::write(snapshot_dir.join("file.txt"), "test").unwrap();

        assert!(!service.is_indexed("job1", 1700000000000).unwrap());

        service
            .index_snapshot("job1", 1700000000000, snapshot_dir.to_str().unwrap())
            .unwrap();

        assert!(service.is_indexed("job1", 1700000000000).unwrap());
    }

    #[test]
    fn test_list_snapshots() {
        let (service, temp_dir) = create_test_service();

        let snapshot_dir = temp_dir.path().join("snapshot");
        std::fs::create_dir_all(&snapshot_dir).unwrap();
        std::fs::write(snapshot_dir.join("file.txt"), "test").unwrap();

        service
            .index_snapshot("job1", 1700000000000, snapshot_dir.to_str().unwrap())
            .unwrap();
        service
            .index_snapshot("job1", 1700000001000, snapshot_dir.to_str().unwrap())
            .unwrap();

        let snapshots = service.list_snapshots("job1").unwrap();
        assert_eq!(snapshots.len(), 2);
        assert!(snapshots[0].timestamp > snapshots[1].timestamp); // Newest first
    }

    #[test]
    fn test_delete_snapshot() {
        let (service, temp_dir) = create_test_service();

        let snapshot_dir = temp_dir.path().join("snapshot");
        std::fs::create_dir_all(&snapshot_dir).unwrap();
        std::fs::write(snapshot_dir.join("file.txt"), "test").unwrap();

        service
            .index_snapshot("job1", 1700000000000, snapshot_dir.to_str().unwrap())
            .unwrap();

        assert!(service.is_indexed("job1", 1700000000000).unwrap());

        service.delete_snapshot("job1", 1700000000000).unwrap();

        assert!(!service.is_indexed("job1", 1700000000000).unwrap());
    }

    #[test]
    fn test_search_files() {
        let (service, temp_dir) = create_test_service();

        let snapshot_dir = temp_dir.path().join("snapshot");
        std::fs::create_dir_all(&snapshot_dir).unwrap();
        std::fs::write(snapshot_dir.join("readme.txt"), "readme").unwrap();
        std::fs::write(snapshot_dir.join("README.md"), "markdown").unwrap();
        std::fs::write(snapshot_dir.join("config.json"), "config").unwrap();

        service
            .index_snapshot("job1", 1700000000000, snapshot_dir.to_str().unwrap())
            .unwrap();

        // Search case-insensitive partial match
        let results = service
            .search_files("job1", 1700000000000, "readme", 100)
            .unwrap();

        // SQLite LIKE is case-insensitive by default
        assert!(!results.is_empty());
    }

    #[test]
    fn test_get_snapshot_stats() {
        let (service, temp_dir) = create_test_service();

        let snapshot_dir = temp_dir.path().join("snapshot");
        std::fs::create_dir_all(&snapshot_dir).unwrap();
        std::fs::write(snapshot_dir.join("file1.txt"), "hello").unwrap(); // 5 bytes
        std::fs::write(snapshot_dir.join("file2.txt"), "world!").unwrap(); // 6 bytes

        service
            .index_snapshot("job1", 1700000000000, snapshot_dir.to_str().unwrap())
            .unwrap();

        let (file_count, total_size) = service
            .get_snapshot_stats("job1", 1700000000000)
            .unwrap();

        assert_eq!(file_count, 2);
        assert_eq!(total_size, 11); // 5 + 6 bytes
    }
}
