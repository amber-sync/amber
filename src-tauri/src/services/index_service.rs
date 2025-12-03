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
const DB_VERSION: i32 = 2;

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
    pub fn as_str(&self) -> &'static str {
        match self {
            FileType::File => "file",
            FileType::Directory => "dir",
            FileType::Symlink => "symlink",
        }
    }

    #[allow(dead_code)]
    pub fn from_str(s: &str) -> Self {
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

/// Global search result with snapshot context
#[derive(Debug, Clone, serde::Serialize)]
pub struct GlobalSearchResult {
    pub file: FileNode,
    pub job_id: String,
    pub job_name: Option<String>,
    pub snapshot_timestamp: i64,
    pub rank: f64,
}

/// File type statistics (aggregated by extension)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTypeStats {
    pub extension: String,
    pub count: i64,
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

    /// Get the path to the database file
    pub fn get_db_path(&self) -> &Path {
        &self.db_path
    }

    /// Validate that the database schema matches what we expect.
    /// Returns Ok(()) if valid, or an error describing the mismatch.
    /// This is useful for detecting when mock data was generated with an old schema.
    pub fn validate_schema(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })?;

        // Check user_version
        let version: i32 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap_or(0);

        if version != DB_VERSION {
            return Err(AmberError::Index(format!(
                "Database schema version mismatch: found v{}, expected v{}. \
                 Please regenerate mock data or clear the database.",
                version, DB_VERSION
            )));
        }

        // Check required columns in snapshots table
        let required_snapshot_cols = ["id", "job_id", "timestamp", "root_path", "file_count", "total_size"];
        for col in required_snapshot_cols {
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM pragma_table_info('snapshots') WHERE name = ?",
                    [col],
                    |row| row.get(0),
                )
                .unwrap_or(false);

            if !exists {
                return Err(AmberError::Index(format!(
                    "Missing column '{}' in snapshots table. Schema mismatch detected. \
                     Please regenerate mock data with: python3 scripts/generate-mock-data.py",
                    col
                )));
            }
        }

        // Check required columns in files table
        let required_file_cols = ["id", "snapshot_id", "path", "name", "parent_path", "size", "mtime", "file_type"];
        for col in required_file_cols {
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM pragma_table_info('files') WHERE name = ?",
                    [col],
                    |row| row.get(0),
                )
                .unwrap_or(false);

            if !exists {
                return Err(AmberError::Index(format!(
                    "Missing column '{}' in files table. Schema mismatch detected. \
                     Please regenerate mock data with: python3 scripts/generate-mock-data.py",
                    col
                )));
            }
        }

        log::info!("Database schema validation passed (version {})", version);
        Ok(())
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
            .map_err(|e| AmberError::Index(format!("Migration v1 failed: {}", e)))?;
        }

        if from_version < 2 {
            // Add FTS5 for instant full-text search (TIM-101)
            conn.execute_batch(
                r#"
                -- FTS5 virtual table for fast full-text search
                -- Uses external content table (files) to avoid data duplication
                CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
                    name,
                    path,
                    content=files,
                    content_rowid=id,
                    tokenize='unicode61 remove_diacritics 1'
                );

                -- Triggers to keep FTS index in sync with files table
                CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
                    INSERT INTO files_fts(rowid, name, path) VALUES (new.id, new.name, new.path);
                END;

                CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
                    INSERT INTO files_fts(files_fts, rowid, name, path) VALUES('delete', old.id, old.name, old.path);
                END;

                CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
                    INSERT INTO files_fts(files_fts, rowid, name, path) VALUES('delete', old.id, old.name, old.path);
                    INSERT INTO files_fts(rowid, name, path) VALUES (new.id, new.name, new.path);
                END;

                -- Update version
                PRAGMA user_version = 2;
                "#,
            )
            .map_err(|e| AmberError::Index(format!("Migration v2 (FTS5) failed: {}", e)))?;

            // Rebuild FTS index from existing data
            self.rebuild_fts_index(conn)?;
        }

        Ok(())
    }

    /// Rebuild FTS index from existing files table
    fn rebuild_fts_index(&self, conn: &Connection) -> Result<()> {
        // This populates the FTS index from existing data
        conn.execute_batch(
            r#"
            INSERT INTO files_fts(files_fts) VALUES('rebuild');
            "#,
        )
        .map_err(|e| AmberError::Index(format!("Failed to rebuild FTS index: {}", e)))?;

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

    /// Search files globally across all snapshots using FTS5
    /// Returns results ranked by relevance with snapshot context
    pub fn search_files_global(
        &self,
        pattern: &str,
        job_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<GlobalSearchResult>> {
        let conn = self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })?;

        // Build the FTS5 query - support prefix matching with *
        let fts_pattern = if pattern.contains('*') || pattern.contains('"') {
            // User provided explicit FTS syntax
            pattern.to_string()
        } else {
            // Add prefix matching for better UX (e.g., "read" matches "readme")
            format!("{}*", pattern)
        };

        // Query with optional job_id filter
        let query = if job_id.is_some() {
            r#"
            SELECT
                f.path, f.name, f.size, f.mtime, f.file_type,
                s.job_id, s.timestamp,
                bm25(files_fts, 10.0, 1.0) as rank
            FROM files_fts fts
            JOIN files f ON fts.rowid = f.id
            JOIN snapshots s ON f.snapshot_id = s.id
            WHERE files_fts MATCH ?1
              AND s.job_id = ?2
            ORDER BY rank
            LIMIT ?3
            "#
        } else {
            r#"
            SELECT
                f.path, f.name, f.size, f.mtime, f.file_type,
                s.job_id, s.timestamp,
                bm25(files_fts, 10.0, 1.0) as rank
            FROM files_fts fts
            JOIN files f ON fts.rowid = f.id
            JOIN snapshots s ON f.snapshot_id = s.id
            WHERE files_fts MATCH ?1
            ORDER BY rank
            LIMIT ?2
            "#
        };

        let mut stmt = conn
            .prepare(query)
            .map_err(|e| AmberError::Index(format!("Failed to prepare FTS query: {}", e)))?;

        let mut result = Vec::new();

        if let Some(jid) = job_id {
            let rows = stmt
                .query_map(params![fts_pattern, jid, limit as i64], |row| {
                    Self::map_global_search_row(row)
                })
                .map_err(|e| AmberError::Index(format!("FTS search failed: {}", e)))?;

            for r in rows {
                if let Ok(item) = r {
                    result.push(item);
                }
            }
        } else {
            let rows = stmt
                .query_map(params![fts_pattern, limit as i64], |row| {
                    Self::map_global_search_row(row)
                })
                .map_err(|e| AmberError::Index(format!("FTS search failed: {}", e)))?;

            for r in rows {
                if let Ok(item) = r {
                    result.push(item);
                }
            }
        }

        Ok(result)
    }

    /// Helper to map a row to GlobalSearchResult
    fn map_global_search_row(row: &rusqlite::Row) -> rusqlite::Result<GlobalSearchResult> {
        let path: String = row.get(0)?;
        let name: String = row.get(1)?;
        let size: i64 = row.get(2)?;
        let mtime: i64 = row.get(3)?;
        let file_type: String = row.get(4)?;
        let job_id: String = row.get(5)?;
        let timestamp: i64 = row.get(6)?;
        let rank: f64 = row.get(7)?;

        let is_dir = file_type == "dir";
        let node_type = if is_dir { "FOLDER" } else { "FILE" };

        Ok(GlobalSearchResult {
            file: FileNode {
                id: path.replace('/', "-"),
                name,
                node_type: node_type.to_string(),
                size: size as u64,
                modified: mtime * 1000,
                children: if is_dir { Some(Vec::new()) } else { None },
                path,
            },
            job_id,
            job_name: None, // Will be populated by the caller if needed
            snapshot_timestamp: timestamp,
            rank: -rank, // bm25 returns negative scores, higher is better
        })
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

    /// Get file type statistics for a snapshot (aggregated by extension)
    pub fn get_file_type_stats(
        &self,
        job_id: &str,
        timestamp: i64,
        limit: usize,
    ) -> Result<Vec<FileTypeStats>> {
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

        // Query file extensions with aggregated stats
        // Extract extension using SUBSTR and INSTR, group by it
        let mut stmt = conn
            .prepare(
                r#"
                SELECT
                    CASE
                        WHEN INSTR(name, '.') > 0
                        THEN LOWER(SUBSTR(name, INSTR(name, '.') + 1))
                        ELSE ''
                    END as ext,
                    COUNT(*) as count,
                    SUM(size) as total_size
                FROM files
                WHERE snapshot_id = ? AND file_type = 'file'
                GROUP BY ext
                ORDER BY total_size DESC
                LIMIT ?
                "#,
            )
            .map_err(|e| AmberError::Index(format!("Failed to prepare query: {}", e)))?;

        let stats = stmt
            .query_map(params![snapshot_id, limit as i64], |row| {
                Ok(FileTypeStats {
                    extension: row.get(0)?,
                    count: row.get(1)?,
                    total_size: row.get(2)?,
                })
            })
            .map_err(|e| AmberError::Index(format!("Failed to query file types: {}", e)))?;

        let mut result = Vec::new();
        for stat in stats {
            if let Ok(s) = stat {
                result.push(s);
            }
        }

        Ok(result)
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

    /// Get connection for dev stats (dev only)
    #[cfg(debug_assertions)]
    pub fn get_connection_for_stats(
        &self,
    ) -> Result<std::sync::MutexGuard<'_, Connection>> {
        self.conn.lock().map_err(|e| {
            AmberError::Index(format!("Failed to acquire database lock: {}", e))
        })
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

    #[test]
    fn test_search_files_global_fts5() {
        let (service, temp_dir) = create_test_service();

        // Create multiple snapshots across multiple jobs
        let snapshot1_dir = temp_dir.path().join("snapshot1");
        std::fs::create_dir_all(&snapshot1_dir).unwrap();
        std::fs::write(snapshot1_dir.join("readme.txt"), "readme content").unwrap();
        std::fs::write(snapshot1_dir.join("config.json"), "config content").unwrap();

        let snapshot2_dir = temp_dir.path().join("snapshot2");
        std::fs::create_dir_all(&snapshot2_dir).unwrap();
        std::fs::write(snapshot2_dir.join("README.md"), "markdown readme").unwrap();
        std::fs::write(snapshot2_dir.join("app.js"), "javascript").unwrap();

        // Index both snapshots (different jobs)
        service
            .index_snapshot("job1", 1700000000000, snapshot1_dir.to_str().unwrap())
            .unwrap();
        service
            .index_snapshot("job2", 1700000001000, snapshot2_dir.to_str().unwrap())
            .unwrap();

        // Global FTS5 search across ALL snapshots
        let results = service
            .search_files_global("readme", None, 100)
            .unwrap();

        // Should find files from both snapshots
        assert!(results.len() >= 2, "Expected at least 2 results for 'readme'");

        // Verify results have correct structure
        for result in &results {
            assert!(!result.file.name.is_empty());
            assert!(!result.job_id.is_empty());
            assert!(result.snapshot_timestamp > 0);
        }

        // Test with job_id filter
        let job1_results = service
            .search_files_global("readme", Some("job1"), 100)
            .unwrap();

        // Should only find files from job1
        for result in &job1_results {
            assert_eq!(result.job_id, "job1");
        }
    }
}
