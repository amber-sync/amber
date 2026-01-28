//! SQLite-based snapshot index for fast browsing
//!
//! TIM-46: Replaces JSON file caching with SQLite for instant snapshot browsing.
//! Designed to handle millions of files (full MacBook backup).

use crate::error::{AmberError, Result};
use crate::types::snapshot::FileNode;
use crate::utils::make_relative; // TIM-123: Use centralized path utility
use jwalk::WalkDir;
use rayon::prelude::*;
use rusqlite::{params, Connection, Transaction};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

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
    pub fn parse(s: &str) -> Self {
        match s {
            "dir" => FileType::Directory,
            "symlink" => FileType::Symlink,
            _ => FileType::File,
        }
    }
}

/// Snapshot metadata stored in the index
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
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

/// Paginated directory contents with metadata
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryContents {
    pub files: Vec<FileNode>,
    pub total_count: usize,
    pub has_more: bool,
}

/// Largest file info for analytics
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LargestFile {
    pub name: String,
    pub size: i64,
    pub path: String,
}

/// Aggregate statistics for a job (TIM-127)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobAggregateStats {
    /// Total number of snapshots for this job
    pub total_snapshots: i64,
    /// Total size in bytes across all snapshots (logical, not deduplicated)
    pub total_size_bytes: i64,
    /// Total file count across all snapshots
    pub total_files: i64,
    /// Timestamp of the first snapshot (milliseconds), None if no snapshots
    pub first_snapshot_ms: Option<i64>,
    /// Timestamp of the last snapshot (milliseconds), None if no snapshots
    pub last_snapshot_ms: Option<i64>,
}

/// Snapshot density for calendar/timeline visualization (TIM-128)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotDensity {
    /// Period identifier (e.g., "2024-01" for month, "2024-01-15" for day)
    pub period: String,
    /// Number of snapshots in this period
    pub count: i64,
    /// Total size of snapshots in this period (bytes)
    pub total_size: i64,
}

/// TIM-221: Single file change entry in snapshot diff
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffEntry {
    pub path: String,
    pub size_a: Option<i64>, // size in snapshot A (None if added)
    pub size_b: Option<i64>, // size in snapshot B (None if deleted)
}

/// TIM-221: Summary statistics for snapshot diff
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffSummary {
    pub total_added: u32,
    pub total_deleted: u32,
    pub total_modified: u32,
    pub size_delta: i64,
}

/// TIM-221: Complete snapshot diff result
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotDiff {
    pub added: Vec<DiffEntry>,
    pub deleted: Vec<DiffEntry>,
    pub modified: Vec<DiffEntry>,
    pub summary: DiffSummary,
}

impl IndexService {
    /// Create or open the index database at the default app data location
    pub fn new(app_data_dir: &Path) -> Result<Self> {
        let db_path = app_data_dir.join("index.db");
        Self::open_at_path(db_path)
    }

    /// Open an index database at a destination drive (TIM-127)
    /// Path: <dest_path>/.amber-meta/index.db
    pub fn for_destination(dest_path: &str) -> Result<Self> {
        use crate::services::manifest_service;
        let dest_root = Path::new(dest_path);
        if !dest_root.is_dir() {
            return Err(AmberError::InvalidPath(format!(
                "Destination path is not accessible: {}",
                dest_path
            )));
        }
        let db_path = manifest_service::get_index_path(dest_path);
        Self::open_at_path(db_path)
    }

    /// Internal: open database at a specific path
    fn open_at_path(db_path: PathBuf) -> Result<Self> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                AmberError::Index(format!("Failed to create index directory: {}", e))
            })?;
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| AmberError::Index(format!("Failed to open index database: {}", e)))?;

        conn.busy_timeout(Duration::from_secs(5))
            .map_err(|e| AmberError::Index(format!("Failed to set busy timeout: {}", e)))?;

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
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

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
        let required_snapshot_cols = [
            "id",
            "job_id",
            "timestamp",
            "root_path",
            "file_count",
            "total_size",
        ];
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
        let required_file_cols = [
            "id",
            "snapshot_id",
            "path",
            "name",
            "parent_path",
            "size",
            "mtime",
            "file_type",
        ];
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
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

        // Enable WAL mode for better concurrent read performance
        // Also apply performance PRAGMA optimizations for large datasets (150K+ files)
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA foreign_keys = ON;
             PRAGMA cache_size = -64000;      -- 64MB cache for better performance
             PRAGMA temp_store = MEMORY;      -- Store temp tables in memory
             PRAGMA mmap_size = 268435456;    -- 256MB memory-mapped I/O
             PRAGMA synchronous = NORMAL;", // Balanced safety/performance
        )
        .map_err(|e| AmberError::Index(format!("Failed to set database optimizations: {}", e)))?;

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
            // Initial schema (v1)
            conn.execute_batch(
                r#"
                -- =================================================================
                -- SCHEMA DOCUMENTATION
                -- =================================================================
                -- Timestamps:
                --   - snapshots.timestamp: Unix MILLISECONDS
                --   - files.mtime: Unix SECONDS (converted to ms at API boundary)
                --   - snapshots.created_at: Unix SECONDS (default)
                --
                -- File types (files.file_type):
                --   - 'file': Regular file
                --   - 'dir': Directory
                --   - 'symlink': Symbolic link
                --   Note: Always lowercase, matches Rust file_type module
                -- =================================================================

                -- Snapshots table: One entry per backup snapshot
                CREATE TABLE IF NOT EXISTS snapshots (
                    id INTEGER PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,           -- Unix MILLISECONDS
                    root_path TEXT NOT NULL,
                    file_count INTEGER DEFAULT 0,
                    total_size INTEGER DEFAULT 0,         -- Bytes
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),  -- Unix SECONDS
                    UNIQUE(job_id, timestamp)
                );

                -- Files table: All files/directories in each snapshot
                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY,
                    snapshot_id INTEGER NOT NULL,
                    path TEXT NOT NULL,                   -- Relative path from snapshot root
                    name TEXT NOT NULL,                   -- Filename only
                    parent_path TEXT NOT NULL,            -- Parent directory path
                    size INTEGER NOT NULL,                -- Bytes (0 for directories)
                    mtime INTEGER NOT NULL,               -- Unix SECONDS (API multiplies by 1000)
                    inode INTEGER,                        -- Unix inode for dedup detection
                    file_type TEXT NOT NULL,              -- 'file' | 'dir' | 'symlink'
                    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
                );

                -- Indexes for fast queries
                CREATE INDEX IF NOT EXISTS idx_snapshots_job ON snapshots(job_id);
                CREATE INDEX IF NOT EXISTS idx_files_snapshot_parent ON files(snapshot_id, parent_path);
                CREATE INDEX IF NOT EXISTS idx_files_path ON files(snapshot_id, path);
                CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);

                -- Composite indexes for performance optimization (TIM-150K+)
                -- Directory browsing with ORDER BY (avoids sorting in query)
                CREATE INDEX IF NOT EXISTS idx_files_snapshot_parent_type_name
                ON files(snapshot_id, parent_path, file_type DESC, name ASC);

                -- File type statistics aggregation
                CREATE INDEX IF NOT EXISTS idx_files_snapshot_type_size
                ON files(snapshot_id, file_type, size);

                -- Snapshots range queries for timeline views
                CREATE INDEX IF NOT EXISTS idx_snapshots_job_timestamp
                ON snapshots(job_id, timestamp DESC);

                -- Global search join optimization
                CREATE INDEX IF NOT EXISTS idx_snapshots_id_job_timestamp
                ON snapshots(id, job_id, timestamp);

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

        // Analyze tables to update query planner statistics
        conn.execute_batch("ANALYZE;")
            .map_err(|e| AmberError::Index(format!("Failed to analyze database: {}", e)))?;

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
        let file_count = files
            .iter()
            .filter(|f| f.file_type == FileType::File)
            .count() as i64;
        let total_size: i64 = files.iter().map(|f| f.size).sum();

        // Insert into database
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

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

                // TIM-123: Use centralized make_relative utility
                let parent_path = path
                    .parent()
                    .map(|p| make_relative(p, root))
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
    /// Returns all files without pagination (legacy method for backward compatibility)
    pub fn get_directory_contents(
        &self,
        job_id: &str,
        timestamp: i64,
        parent_path: &str,
    ) -> Result<Vec<FileNode>> {
        // Call paginated version with no limits
        let contents =
            self.get_directory_contents_paginated(job_id, timestamp, parent_path, None, None)?;
        Ok(contents.files)
    }

    /// Get files in a directory with pagination support
    pub fn get_directory_contents_paginated(
        &self,
        job_id: &str,
        timestamp: i64,
        parent_path: &str,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> Result<DirectoryContents> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

        // Get snapshot ID
        let snapshot_id: i64 = conn
            .query_row(
                "SELECT id FROM snapshots WHERE job_id = ? AND timestamp = ?",
                params![job_id, timestamp],
                |row| row.get(0),
            )
            .map_err(|_| AmberError::Index("Snapshot not found in index".to_string()))?;

        // Get total count for pagination metadata
        let total_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM files WHERE snapshot_id = ? AND parent_path = ?",
                params![snapshot_id, parent_path],
                |row| row.get(0),
            )
            .map_err(|e| AmberError::Index(format!("Failed to count files: {}", e)))?;

        // Get files in directory with pagination
        let limit_val = limit.unwrap_or(500);
        let offset_val = offset.unwrap_or(0);

        let mut stmt = conn
            .prepare(
                "SELECT path, name, size, mtime, file_type
                 FROM files
                 WHERE snapshot_id = ? AND parent_path = ?
                 ORDER BY file_type DESC, name ASC
                 LIMIT ? OFFSET ?",
            )
            .map_err(|e| AmberError::Index(format!("Failed to prepare query: {}", e)))?;

        let files = stmt
            .query_map(
                params![
                    snapshot_id,
                    parent_path,
                    limit_val as i64,
                    offset_val as i64
                ],
                |row| {
                    let path: String = row.get(0)?;
                    let name: String = row.get(1)?;
                    let size: i64 = row.get(2)?;
                    let mtime: i64 = row.get(3)?;
                    let file_type: String = row.get(4)?;

                    let is_dir = file_type == "dir";
                    let node_type = if is_dir { "dir" } else { "file" };

                    Ok(FileNode {
                        id: path.replace('/', "-"),
                        name,
                        node_type: node_type.to_string(),
                        size: size as u64,
                        modified: mtime * 1000, // Convert to millis
                        children: if is_dir { Some(Vec::new()) } else { None },
                        path,
                    })
                },
            )
            .map_err(|e| AmberError::Index(format!("Failed to query files: {}", e)))?;

        let mut result = Vec::new();
        for f in files.flatten() {
            result.push(f);
        }

        let has_more = offset_val + result.len() < total_count as usize;

        Ok(DirectoryContents {
            files: result,
            total_count: total_count as usize,
            has_more,
        })
    }

    /// List all indexed snapshots for a job
    pub fn list_snapshots(&self, job_id: &str) -> Result<Vec<IndexedSnapshot>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

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
        for s in snapshots.flatten() {
            result.push(s);
        }

        Ok(result)
    }

    /// List snapshots within a date range (for filtering UI)
    /// Time range is inclusive: [start_ms, end_ms]
    pub fn list_snapshots_in_range(
        &self,
        job_id: &str,
        start_ms: i64,
        end_ms: i64,
    ) -> Result<Vec<IndexedSnapshot>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

        let mut stmt = conn
            .prepare(
                "SELECT id, job_id, timestamp, root_path, file_count, total_size
                 FROM snapshots
                 WHERE job_id = ? AND timestamp >= ? AND timestamp <= ?
                 ORDER BY timestamp DESC",
            )
            .map_err(|e| AmberError::Index(format!("Failed to prepare query: {}", e)))?;

        let snapshots = stmt
            .query_map(params![job_id, start_ms, end_ms], |row| {
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
        for s in snapshots.flatten() {
            result.push(s);
        }

        Ok(result)
    }

    /// Get aggregate statistics for all snapshots of a job (TIM-127)
    pub fn get_job_aggregate_stats(&self, job_id: &str) -> Result<JobAggregateStats> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

        // Get aggregate stats from snapshots table in a single query
        let result = conn
            .query_row(
                "SELECT
                    COUNT(*) as total_snapshots,
                    COALESCE(SUM(total_size), 0) as total_size,
                    COALESCE(SUM(file_count), 0) as total_files,
                    MIN(timestamp) as first_snapshot,
                    MAX(timestamp) as last_snapshot
                 FROM snapshots
                 WHERE job_id = ?",
                params![job_id],
                |row| {
                    let total_snapshots: i64 = row.get(0)?;
                    Ok(JobAggregateStats {
                        total_snapshots,
                        total_size_bytes: row.get(1)?,
                        total_files: row.get(2)?,
                        // Only set timestamps if there are snapshots
                        first_snapshot_ms: if total_snapshots > 0 {
                            row.get(3)?
                        } else {
                            None
                        },
                        last_snapshot_ms: if total_snapshots > 0 {
                            row.get(4)?
                        } else {
                            None
                        },
                    })
                },
            )
            .map_err(|e| AmberError::Index(format!("Failed to query aggregate stats: {}", e)))?;

        Ok(result)
    }

    /// Get snapshot density grouped by period (TIM-128: for calendar/timeline visualization)
    /// Period can be: "day", "week", "month", "year"
    pub fn get_snapshot_density(&self, job_id: &str, period: &str) -> Result<Vec<SnapshotDensity>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

        // Validate period input (security: prevent SQL injection via match arm)
        let period_code = match period {
            "day" => 1,
            "week" => 2,
            "month" => 3,
            "year" => 4,
            _ => 3, // Default to month
        };

        // Use CASE expression instead of format! to avoid SQL injection risk
        // Even though the input is validated, this pattern is safer and prevents
        // future refactoring from introducing vulnerabilities
        let query = r#"
            SELECT
                CASE ?1
                    WHEN 1 THEN strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch')
                    WHEN 2 THEN strftime('%Y-W%W', timestamp / 1000, 'unixepoch')
                    WHEN 3 THEN strftime('%Y-%m', timestamp / 1000, 'unixepoch')
                    ELSE strftime('%Y', timestamp / 1000, 'unixepoch')
                END as period,
                COUNT(*) as count,
                SUM(total_size) as total_size
             FROM snapshots
             WHERE job_id = ?2
             GROUP BY period
             ORDER BY period DESC
        "#;

        let mut stmt = conn
            .prepare(query)
            .map_err(|e| AmberError::Index(format!("Failed to prepare query: {}", e)))?;

        let density = stmt
            .query_map(params![period_code, job_id], |row| {
                Ok(SnapshotDensity {
                    period: row.get(0)?,
                    count: row.get(1)?,
                    total_size: row.get(2)?,
                })
            })
            .map_err(|e| AmberError::Index(format!("Failed to query density: {}", e)))?;

        let mut result = Vec::new();
        for entry in density.flatten() {
            result.push(entry);
        }

        Ok(result)
    }

    /// TIM-221: Compare two snapshots and return the differences
    /// Returns added, deleted, and modified files between snapshot A and B
    pub fn compare_snapshots(
        &self,
        job_id: &str,
        timestamp_a: i64,
        timestamp_b: i64,
        limit: Option<usize>,
    ) -> Result<SnapshotDiff> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

        let limit_val = limit.unwrap_or(5000) as i64;

        // Get snapshot IDs for both timestamps
        let snapshot_id_a: i64 = conn
            .query_row(
                "SELECT id FROM snapshots WHERE job_id = ? AND timestamp = ?",
                params![job_id, timestamp_a],
                |row| row.get(0),
            )
            .map_err(|_| {
                AmberError::Index(format!(
                    "Snapshot A not found: job_id={}, timestamp={}",
                    job_id, timestamp_a
                ))
            })?;

        let snapshot_id_b: i64 = conn
            .query_row(
                "SELECT id FROM snapshots WHERE job_id = ? AND timestamp = ?",
                params![job_id, timestamp_b],
                |row| row.get(0),
            )
            .map_err(|_| {
                AmberError::Index(format!(
                    "Snapshot B not found: job_id={}, timestamp={}",
                    job_id, timestamp_b
                ))
            })?;

        // Query for added files (in B but not in A)
        let mut added_stmt = conn
            .prepare(
                r#"
                SELECT b.path, b.size FROM files b
                WHERE b.snapshot_id = ?
                AND b.file_type = 'file'
                AND NOT EXISTS (
                    SELECT 1 FROM files a
                    WHERE a.snapshot_id = ? AND a.path = b.path
                )
                LIMIT ?
                "#,
            )
            .map_err(|e| AmberError::Index(format!("Failed to prepare added query: {}", e)))?;

        let added_rows = added_stmt
            .query_map(params![snapshot_id_b, snapshot_id_a, limit_val], |row| {
                let path: String = row.get(0)?;
                let size: i64 = row.get(1)?;
                Ok(DiffEntry {
                    path,
                    size_a: None,
                    size_b: Some(size),
                })
            })
            .map_err(|e| AmberError::Index(format!("Failed to query added files: {}", e)))?;

        let mut added: Vec<DiffEntry> = Vec::new();
        let mut size_added: i64 = 0;
        for entry in added_rows.flatten() {
            size_added += entry.size_b.unwrap_or(0);
            added.push(entry);
        }

        // Query for deleted files (in A but not in B)
        let mut deleted_stmt = conn
            .prepare(
                r#"
                SELECT a.path, a.size FROM files a
                WHERE a.snapshot_id = ?
                AND a.file_type = 'file'
                AND NOT EXISTS (
                    SELECT 1 FROM files b
                    WHERE b.snapshot_id = ? AND b.path = a.path
                )
                LIMIT ?
                "#,
            )
            .map_err(|e| AmberError::Index(format!("Failed to prepare deleted query: {}", e)))?;

        let deleted_rows = deleted_stmt
            .query_map(params![snapshot_id_a, snapshot_id_b, limit_val], |row| {
                let path: String = row.get(0)?;
                let size: i64 = row.get(1)?;
                Ok(DiffEntry {
                    path,
                    size_a: Some(size),
                    size_b: None,
                })
            })
            .map_err(|e| AmberError::Index(format!("Failed to query deleted files: {}", e)))?;

        let mut deleted: Vec<DiffEntry> = Vec::new();
        let mut size_deleted: i64 = 0;
        for entry in deleted_rows.flatten() {
            size_deleted += entry.size_a.unwrap_or(0);
            deleted.push(entry);
        }

        // Query for modified files (in both but different size)
        let mut modified_stmt = conn
            .prepare(
                r#"
                SELECT a.path, a.size, b.size FROM files a
                INNER JOIN files b ON a.path = b.path
                WHERE a.snapshot_id = ?
                AND b.snapshot_id = ?
                AND a.file_type = 'file'
                AND b.file_type = 'file'
                AND a.size != b.size
                LIMIT ?
                "#,
            )
            .map_err(|e| AmberError::Index(format!("Failed to prepare modified query: {}", e)))?;

        let modified_rows = modified_stmt
            .query_map(params![snapshot_id_a, snapshot_id_b, limit_val], |row| {
                let path: String = row.get(0)?;
                let size_a: i64 = row.get(1)?;
                let size_b: i64 = row.get(2)?;
                Ok(DiffEntry {
                    path,
                    size_a: Some(size_a),
                    size_b: Some(size_b),
                })
            })
            .map_err(|e| AmberError::Index(format!("Failed to query modified files: {}", e)))?;

        let mut modified: Vec<DiffEntry> = Vec::new();
        let mut size_modified_delta: i64 = 0;
        for entry in modified_rows.flatten() {
            let delta = entry.size_b.unwrap_or(0) - entry.size_a.unwrap_or(0);
            size_modified_delta += delta;
            modified.push(entry);
        }

        // Calculate summary statistics
        let size_delta = size_added - size_deleted + size_modified_delta;

        let summary = DiffSummary {
            total_added: added.len() as u32,
            total_deleted: deleted.len() as u32,
            total_modified: modified.len() as u32,
            size_delta,
        };

        Ok(SnapshotDiff {
            added,
            deleted,
            modified,
            summary,
        })
    }

    /// Check if a snapshot is indexed
    pub fn is_indexed(&self, job_id: &str, timestamp: i64) -> Result<bool> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

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
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

        conn.execute(
            "DELETE FROM snapshots WHERE job_id = ? AND timestamp = ?",
            params![job_id, timestamp],
        )
        .map_err(|e| AmberError::Index(format!("Failed to delete snapshot: {}", e)))?;

        Ok(())
    }

    /// Delete all snapshots for a job
    pub fn delete_job_snapshots(&self, job_id: &str) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

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
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

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
                let node_type = if is_dir { "dir" } else { "file" };

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
        for f in files.flatten() {
            result.push(f);
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
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

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

            for item in rows.flatten() {
                result.push(item);
            }
        } else {
            let rows = stmt
                .query_map(params![fts_pattern, limit as i64], |row| {
                    Self::map_global_search_row(row)
                })
                .map_err(|e| AmberError::Index(format!("FTS search failed: {}", e)))?;

            for item in rows.flatten() {
                result.push(item);
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
        let node_type = if is_dir { "dir" } else { "file" };

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
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

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
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

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
        for s in stats.flatten() {
            result.push(s);
        }

        Ok(result)
    }

    /// Get largest files in a snapshot (for analytics)
    pub fn get_largest_files(
        &self,
        job_id: &str,
        timestamp: i64,
        limit: usize,
    ) -> Result<Vec<LargestFile>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

        // Get snapshot ID
        let snapshot_id: i64 = conn
            .query_row(
                "SELECT id FROM snapshots WHERE job_id = ? AND timestamp = ?",
                params![job_id, timestamp],
                |row| row.get(0),
            )
            .map_err(|_| AmberError::Index("Snapshot not found in index".to_string()))?;

        // Query largest files
        let mut stmt = conn
            .prepare(
                r#"
                SELECT name, size, path
                FROM files
                WHERE snapshot_id = ? AND file_type = 'file'
                ORDER BY size DESC
                LIMIT ?
                "#,
            )
            .map_err(|e| AmberError::Index(format!("Failed to prepare query: {}", e)))?;

        let files = stmt
            .query_map(params![snapshot_id, limit as i64], |row| {
                Ok(LargestFile {
                    name: row.get(0)?,
                    size: row.get(1)?,
                    path: row.get(2)?,
                })
            })
            .map_err(|e| AmberError::Index(format!("Failed to query largest files: {}", e)))?;

        let mut result = Vec::new();
        for f in files.flatten() {
            result.push(f);
        }

        Ok(result)
    }

    /// Get database path (for debugging)
    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    /// Compact the database (run VACUUM)
    pub fn compact(&self) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

        conn.execute("VACUUM", [])
            .map_err(|e| AmberError::Index(format!("Failed to vacuum database: {}", e)))?;

        Ok(())
    }

    /// Reconnect to the database (dev only)
    /// Used after replacing the database file to get a fresh connection
    #[cfg(debug_assertions)]
    pub fn reconnect(&self) -> Result<()> {
        let new_conn = Connection::open(&self.db_path)
            .map_err(|e| AmberError::Index(format!("Failed to reconnect to database: {}", e)))?;

        let mut conn = self
            .conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))?;

        *conn = new_conn;
        log::info!("Reconnected to database at {:?}", self.db_path);
        Ok(())
    }

    /// Get connection for dev stats (dev only)
    #[cfg(debug_assertions)]
    pub fn get_connection_for_stats(&self) -> Result<std::sync::MutexGuard<'_, Connection>> {
        self.conn
            .lock()
            .map_err(|e| AmberError::Index(format!("Failed to acquire database lock: {}", e)))
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
    fn test_list_snapshots_in_range() {
        let (service, temp_dir) = create_test_service();

        let snapshot_dir = temp_dir.path().join("snapshot");
        std::fs::create_dir_all(&snapshot_dir).unwrap();
        std::fs::write(snapshot_dir.join("file.txt"), "test").unwrap();

        // Create 5 snapshots with different timestamps
        // Jan 1, Jan 15, Feb 1, Feb 15, Mar 1 (all in 2024)
        let timestamps = [
            1704067200000_i64, // Jan 1, 2024
            1705276800000_i64, // Jan 15, 2024
            1706745600000_i64, // Feb 1, 2024
            1707955200000_i64, // Feb 15, 2024
            1709251200000_i64, // Mar 1, 2024
        ];

        for ts in &timestamps {
            service
                .index_snapshot("job1", *ts, snapshot_dir.to_str().unwrap())
                .unwrap();
        }

        // Query all snapshots
        let all = service
            .list_snapshots_in_range("job1", timestamps[0], timestamps[4])
            .unwrap();
        assert_eq!(all.len(), 5);

        // Query February only (Feb 1 to Feb 29)
        let feb_start = 1706745600000_i64; // Feb 1
        let feb_end = 1709251199999_i64; // Feb 29, 23:59:59.999
        let feb_only = service
            .list_snapshots_in_range("job1", feb_start, feb_end)
            .unwrap();
        assert_eq!(feb_only.len(), 2); // Feb 1 and Feb 15

        // Query with no results
        let future = service
            .list_snapshots_in_range("job1", 1800000000000, 1900000000000)
            .unwrap();
        assert_eq!(future.len(), 0);

        // Verify ordering (newest first)
        assert!(all[0].timestamp > all[1].timestamp);
    }

    #[test]
    fn test_get_job_aggregate_stats() {
        let (service, temp_dir) = create_test_service();

        // Test with no snapshots
        let empty_stats = service.get_job_aggregate_stats("nonexistent").unwrap();
        assert_eq!(empty_stats.total_snapshots, 0);
        assert_eq!(empty_stats.total_size_bytes, 0);
        assert_eq!(empty_stats.total_files, 0);
        assert!(empty_stats.first_snapshot_ms.is_none());
        assert!(empty_stats.last_snapshot_ms.is_none());

        // Create snapshots with different sizes
        let snapshot1 = temp_dir.path().join("snapshot1");
        std::fs::create_dir_all(&snapshot1).unwrap();
        std::fs::write(snapshot1.join("file1.txt"), "hello").unwrap(); // 5 bytes
        std::fs::write(snapshot1.join("file2.txt"), "world!").unwrap(); // 6 bytes

        let snapshot2 = temp_dir.path().join("snapshot2");
        std::fs::create_dir_all(&snapshot2).unwrap();
        std::fs::write(snapshot2.join("file3.txt"), "test data here").unwrap(); // 14 bytes

        // Index both snapshots
        let ts1 = 1704067200000_i64; // Jan 1, 2024
        let ts2 = 1706745600000_i64; // Feb 1, 2024

        service
            .index_snapshot("job1", ts1, snapshot1.to_str().unwrap())
            .unwrap();
        service
            .index_snapshot("job1", ts2, snapshot2.to_str().unwrap())
            .unwrap();

        // Get aggregate stats
        let stats = service.get_job_aggregate_stats("job1").unwrap();

        assert_eq!(stats.total_snapshots, 2);
        assert_eq!(stats.total_files, 3); // 2 + 1 files
        assert_eq!(stats.total_size_bytes, 25); // 5 + 6 + 14 bytes
        assert_eq!(stats.first_snapshot_ms, Some(ts1));
        assert_eq!(stats.last_snapshot_ms, Some(ts2));
    }

    #[test]
    fn test_get_snapshot_density() {
        let (service, temp_dir) = create_test_service();

        let snapshot_dir = temp_dir.path().join("snapshot");
        std::fs::create_dir_all(&snapshot_dir).unwrap();
        std::fs::write(snapshot_dir.join("file.txt"), "test").unwrap();

        // Create snapshots across multiple months
        // Jan 2024: 2 snapshots, Feb 2024: 1 snapshot, Mar 2024: 3 snapshots
        let timestamps = [
            1704067200000_i64, // Jan 1, 2024
            1704153600000_i64, // Jan 2, 2024
            1706745600000_i64, // Feb 1, 2024
            1709251200000_i64, // Mar 1, 2024
            1709337600000_i64, // Mar 2, 2024
            1709424000000_i64, // Mar 3, 2024
        ];

        for ts in &timestamps {
            service
                .index_snapshot("job1", *ts, snapshot_dir.to_str().unwrap())
                .unwrap();
        }

        // Test monthly density
        let monthly = service.get_snapshot_density("job1", "month").unwrap();
        assert_eq!(monthly.len(), 3); // Jan, Feb, Mar
                                      // Results are ordered DESC, so Mar first
        assert_eq!(monthly[0].period, "2024-03");
        assert_eq!(monthly[0].count, 3);
        assert_eq!(monthly[1].period, "2024-02");
        assert_eq!(monthly[1].count, 1);
        assert_eq!(monthly[2].period, "2024-01");
        assert_eq!(monthly[2].count, 2);

        // Test daily density
        let daily = service.get_snapshot_density("job1", "day").unwrap();
        assert_eq!(daily.len(), 6); // 6 unique days

        // Test yearly density
        let yearly = service.get_snapshot_density("job1", "year").unwrap();
        assert_eq!(yearly.len(), 1);
        assert_eq!(yearly[0].period, "2024");
        assert_eq!(yearly[0].count, 6);

        // Test empty job
        let empty = service
            .get_snapshot_density("nonexistent", "month")
            .unwrap();
        assert!(empty.is_empty());
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

        let (file_count, total_size) = service.get_snapshot_stats("job1", 1700000000000).unwrap();

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
        let results = service.search_files_global("readme", None, 100).unwrap();

        // Should find files from both snapshots
        assert!(
            results.len() >= 2,
            "Expected at least 2 results for 'readme'"
        );

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
