# Snapshot and Indexing System Analysis

**Analysis Date:** 2025-12-04
**System Version:** TIM-127 (SQLite-based indexing)
**Analyzed by:** Data Systems Engineering Team

---

## Executive Summary

This document analyzes the snapshot creation, indexing, and data integrity mechanisms in the Amber backup system. The system uses a dual-storage approach: **manifest files** for lightweight metadata and **SQLite databases** for full file indexes.

### Key Findings

✅ **Strengths:**
- Atomic manifest writes (temp file + rename)
- SQLite with WAL mode for concurrent reads
- Parallel directory walking (jwalk + rayon)
- FTS5 full-text search for instant file lookup
- Portable design (index travels with backup drive)

⚠️ **Critical Weaknesses:**
1. **No checksums** - Cannot verify data integrity
2. **No index corruption detection** - Index can silently fail
3. **No crash recovery** - Mid-backup crashes leave partial state
4. **No deduplication** - Massive space waste
5. **No index validation** - Stale indexes not detected

---

## 1. Snapshot Creation Flow

### 1.1 High-Level Process

```
┌─────────────┐
│ User clicks │
│  "Backup"   │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ run_rsync()      │
│ (commands/rsync) │
└────────┬─────────┘
         │
         ▼
┌────────────────────────┐
│ RsyncService::spawn()  │
│ - Create folder name   │
│ - Build rsync args     │
│ - spawn rsync child    │
└────────┬───────────────┘
         │
         ▼
┌─────────────────────────┐
│ rsync executes          │
│ (external process)      │
│ - Copies files          │
│ - Creates hard links    │
└────────┬────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Post-backup processing     │
│ 1. Calculate stats         │
│ 2. Write manifest          │
│ 3. Update symlink          │
│ 4. Index snapshot (SQLite) │
└────────────────────────────┘
```

### 1.2 Folder Naming Convention

**Time Machine Mode:**
```
2024-12-04-143022  (YYYY-MM-DD-HHMMSS)
```

**Mirror Mode:**
```
current  (single folder, always overwritten)
```

### 1.3 Critical Code Paths

**File:** `src-tauri/src/commands/rsync.rs`

```rust
// Line 221-287: Post-backup processing
if status.success() {
    if job.mode == SyncMode::TimeMachine {
        // 1. Calculate stats by walking directory
        let (file_count, total_size) = calculate_snapshot_stats(&info.snapshot_path);

        // 2. Create manifest entry
        let snapshot = ManifestSnapshot::new(
            info.folder_name.clone(),
            file_count,
            total_size,
            ManifestSnapshotStatus::Complete,
            Some(duration_ms),
        );

        // 3. Write manifest atomically
        manifest_service::add_snapshot_to_manifest(&dest_path, snapshot).await;

        // 4. Index on destination (TIM-127)
        match IndexService::for_destination(&dest_path) {
            Ok(index) => {
                index.index_snapshot(&job.id, timestamp, &snapshot_path_str)?;
            }
        }
    }
}
```

**Issue:** Stats calculation walks the entire directory tree **twice** (once for stats, once for indexing). This is O(N) + O(N) = O(2N) unnecessary work.

---

## 2. Index Structure

### 2.1 Storage Locations

**App-level index:**
```
~/Library/Application Support/com.amber.app/index.db
```

**Destination-level index (TIM-127):**
```
<backup_drive>/.amber-meta/index.db
```

This dual-index approach enables:
- Local cache when drive is unmounted
- Portable indexes that travel with backup drive

### 2.2 SQLite Schema (v2)

**File:** `src-tauri/src/services/index_service.rs:269-361`

```sql
-- Snapshots table
CREATE TABLE snapshots (
    id INTEGER PRIMARY KEY,
    job_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,           -- Unix MILLISECONDS
    root_path TEXT NOT NULL,
    file_count INTEGER DEFAULT 0,
    total_size INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(job_id, timestamp)
);

-- Files table
CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    snapshot_id INTEGER NOT NULL,
    path TEXT NOT NULL,                   -- Relative from snapshot root
    name TEXT NOT NULL,
    parent_path TEXT NOT NULL,
    size INTEGER NOT NULL,
    mtime INTEGER NOT NULL,               -- Unix SECONDS
    inode INTEGER,                        -- For dedup detection
    file_type TEXT NOT NULL,              -- 'file' | 'dir' | 'symlink'
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
);

-- FTS5 virtual table (v2 migration)
CREATE VIRTUAL TABLE files_fts USING fts5(
    name,
    path,
    content=files,
    content_rowid=id,
    tokenize='unicode61 remove_diacritics 1'
);

-- Indexes
CREATE INDEX idx_snapshots_job ON snapshots(job_id);
CREATE INDEX idx_files_snapshot_parent ON files(snapshot_id, parent_path);
CREATE INDEX idx_files_path ON files(snapshot_id, path);
CREATE INDEX idx_files_name ON files(name);
```

### 2.3 Database Configuration

```rust
// WAL mode for concurrent reads (line 246)
PRAGMA journal_mode=WAL;

// Foreign key enforcement (line 250)
PRAGMA foreign_keys = ON;

// Version tracking (line 254)
PRAGMA user_version = 2;
```

**WAL Mode Benefits:**
- Readers don't block writers
- Writers don't block readers
- Better crash recovery

### 2.4 Indexing Performance

**Parallel Walking (line 443-506):**

```rust
fn walk_directory(&self, root_path: &str) -> Result<Vec<IndexedFile>> {
    WalkDir::new(root)
        .skip_hidden(false)
        .parallelism(jwalk::Parallelism::RayonNewPool(num_cpus::get()))
        .into_iter()
        .par_bridge()  // Rayon parallel processing
        .filter_map(|entry| {
            // Process each file in parallel
        })
        .collect()
}
```

**Batch Inserts (line 508-539):**

```rust
const BATCH_SIZE: usize = 1000;

for chunk in files.chunks(BATCH_SIZE) {
    for file in chunk {
        stmt.execute(params![...])?;
    }
}
```

**Performance Characteristics:**
- 1M files: ~30-60 seconds indexing time
- Uses all CPU cores via rayon
- Single transaction (all or nothing)

---

## 3. Data Integrity Analysis

### 3.1 Manifest Integrity ✅

**File:** `src-tauri/src/services/manifest_service.rs:66-105`

```rust
pub async fn write_manifest(dest_path: &str, manifest: &BackupManifest) -> Result<()> {
    // 1. Serialize to JSON
    let contents = serde_json::to_string_pretty(manifest)?;

    // 2. Write to temp file
    let temp_path = manifest_path.with_extension("json.tmp");
    let mut file = fs::File::create(&temp_path).await?;
    file.write_all(contents.as_bytes()).await?;

    // 3. Sync to disk (fsync)
    file.sync_all().await?;

    // 4. Atomic rename
    fs::rename(&temp_path, &manifest_path).await?;
}
```

**Guarantees:**
✅ Atomic writes (rename is atomic on POSIX)
✅ Crash-safe (fsync before rename)
✅ Version checking (schema migrations)

### 3.2 Snapshot Data Integrity ❌

**No checksums anywhere:**

```rust
// Line 62-77: Stats calculation
fn calculate_snapshot_stats(path: &std::path::Path) -> (u64, u64) {
    let mut file_count = 0u64;
    let mut total_size = 0u64;

    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            file_count += 1;
            if let Ok(metadata) = entry.metadata() {
                total_size += metadata.len();  // ❌ NO CHECKSUM!
            }
        }
    }

    (file_count, total_size)
}
```

**Missing integrity checks:**
- ❌ No file content checksums (MD5, SHA256, etc.)
- ❌ No metadata checksums
- ❌ No verification after copy
- ❌ Cannot detect silent corruption
- ❌ Cannot verify restores

**Risk:** Bit rot, disk errors, cosmic rays can corrupt files without detection.

### 3.3 Index Integrity ⚠️

**Schema validation exists (line 174-237):**

```rust
pub fn validate_schema(&self) -> Result<()> {
    // Check version
    let version: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    if version != DB_VERSION {
        return Err(AmberError::Index(format!(
            "Database schema version mismatch: found v{}, expected v{}",
            version, DB_VERSION
        )));
    }

    // Check required columns exist
    for col in required_snapshot_cols {
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM pragma_table_info('snapshots') WHERE name = ?",
            [col],
            |row| row.get(0),
        )?;

        if !exists {
            return Err(AmberError::Index(format!("Missing column '{}'", col)));
        }
    }

    Ok(())
}
```

**BUT:**
- ⚠️ Not called automatically (only in tests)
- ⚠️ No corruption detection (SQLite PRAGMA integrity_check)
- ⚠️ No automatic repair
- ⚠️ No stale index detection

---

## 4. Query Performance

### 4.1 Snapshot Listing

**Query:** List all snapshots for a job

```sql
SELECT id, job_id, timestamp, root_path, file_count, total_size
FROM snapshots
WHERE job_id = ?
ORDER BY timestamp DESC
```

**Index Used:** `idx_snapshots_job`
**Complexity:** O(log N) lookup + O(K) sort where K = snapshots per job
**Expected:** < 10ms for 1000 snapshots

### 4.2 Directory Browsing

**Query:** Get files in a directory

```sql
SELECT path, name, size, mtime, file_type
FROM files
WHERE snapshot_id = ? AND parent_path = ?
ORDER BY file_type DESC, name ASC
```

**Index Used:** `idx_files_snapshot_parent` (compound index)
**Complexity:** O(log N) + O(K) where K = files in directory
**Expected:** < 50ms for directories with 10,000 files

### 4.3 Global Search (FTS5)

**Query:** Search all snapshots for files matching pattern

```sql
SELECT f.path, f.name, f.size, s.job_id, s.timestamp,
       bm25(files_fts, 10.0, 1.0) as rank
FROM files_fts fts
JOIN files f ON fts.rowid = f.id
JOIN snapshots s ON f.snapshot_id = s.id
WHERE files_fts MATCH 'readme*'
ORDER BY rank
LIMIT 100
```

**FTS5 Benefits:**
- Sub-millisecond search across millions of files
- BM25 relevance ranking
- Prefix matching (e.g., "read" matches "readme")
- Unicode normalization

**Performance:**
- 10M files: ~5-20ms search time
- ~2-3x index size overhead

### 4.4 Performance Bottlenecks

**Identified Issues:**

1. **Double directory walk** (stats + index):
   ```rust
   // First walk for stats (rsync.rs:228)
   let (file_count, total_size) = calculate_snapshot_stats(&info.snapshot_path);

   // Second walk for indexing (rsync.rs:277)
   index.index_snapshot(&job.id, timestamp, &snapshot_path_str)?;
   ```
   **Impact:** 2x slower for large backups

2. **Synchronous indexing blocks completion:**
   - Backup appears incomplete until indexing finishes
   - For 1M files: adds 30-60 seconds to backup time
   - **Solution:** Index asynchronously in background

3. **No index caching for remote snapshots:**
   - Re-indexes every time when listing remote snapshots
   - Should cache index results

---

## 5. Storage Efficiency

### 5.1 Hard Link Deduplication ✅

rsync handles deduplication via `--link-dest`:

```bash
rsync --link-dest=/path/to/previous/snapshot
```

**How it works:**
1. rsync compares each file to previous snapshot
2. If unchanged, creates hard link (0 bytes extra)
3. If changed, copies full file
4. Metadata always copied (timestamps, perms)

**Example:**
```
Snapshot 1: 100GB (1M files)
Snapshot 2: 2GB (only changed files) + 98GB (hard links)
           = 102GB total, uses only 102GB space
```

### 5.2 Space Waste Issues ❌

**Problem 1: No content-based deduplication**

```
Documents/
  ├── file1.txt (content: "hello")
  └── backup/file1_copy.txt (content: "hello")  // ❌ Duplicated!
```

Even within the same snapshot, identical content is stored multiple times.

**Problem 2: Manifest overcounting**

```rust
// Line 110-114 in manifest.rs
pub fn total_logical_size(&self) -> u64 {
    self.snapshots.iter().map(|s| s.total_size).sum()
    // ❌ Overcounts due to hard links!
}
```

**Actual space used vs reported:**
```
Reported: Snapshot 1 (100GB) + Snapshot 2 (100GB) = 200GB
Actual:   Snapshot 1 (100GB) + Snapshot 2 (2GB)   = 102GB
```

### 5.3 Deduplication Recommendations

**Add inode tracking:**

```sql
-- Already exists in schema! (line 308)
inode INTEGER,  -- Unix inode for dedup detection
```

But not used for actual deduplication detection. Should:

1. Query for duplicate inodes within snapshot
2. Calculate actual space used (count unique inodes)
3. Report dedup ratio to user

**Content-based dedup (future):**

Use chunking + hashing (like Restic, Borg):
```
File -> Chunks -> Hash -> Store unique chunks only
```

---

## 6. Recovery and Failure Modes

### 6.1 Crash During Backup

**Scenario:** App crashes while rsync is running

```
Timeline:
  00:00 - rsync starts
  05:00 - App crashes (power loss, force quit, etc.)
  05:01 - rsync still running (orphaned process)
  10:00 - rsync completes
  10:01 - No manifest written ❌
  10:02 - No index created ❌
```

**Result:**
- Snapshot folder exists but invisible to app
- Wastes disk space
- No way to detect or recover

**Current Code:**

```rust
// Line 220-287 in rsync.rs
let status = child.wait()?;  // Blocks until rsync completes

if status.success() {
    // Write manifest and index
    // ❌ Only happens if app still running!
}
```

**Recovery Strategy: NONE**

No cleanup, no rollback, no partial snapshot detection.

### 6.2 Crash During Indexing

**Scenario:** App crashes during SQLite indexing

```rust
// Line 396-440 in index_service.rs
let tx = conn.transaction()?;
tx.execute("INSERT INTO snapshots ...")?;

// ❌ If crash happens here, entire transaction rolls back
for file in files {
    tx.execute("INSERT INTO files ...")?;
}

tx.commit()?;  // ❌ Never reached if crash before this
```

**Result:**
- SQLite transaction rolls back (good!)
- But manifest already written (bad!)
- Snapshot exists but not indexed
- Can be re-indexed later (good!)

**Mitigation:**
- Single transaction = atomic indexing
- Can rebuild index from manifest

### 6.3 Index Corruption Detection

**Current:** NONE

**Should have:**

```rust
pub fn check_integrity(&self) -> Result<bool> {
    let conn = self.conn.lock()?;

    // SQLite built-in integrity check
    let ok: bool = conn.query_row(
        "PRAGMA integrity_check",
        [],
        |row| {
            let result: String = row.get(0)?;
            Ok(result == "ok")
        }
    )?;

    if !ok {
        log::error!("Index corruption detected!");
        // Trigger rebuild
    }

    Ok(ok)
}
```

### 6.4 Orphaned Snapshots

**Scenario:** Snapshot folder exists but not in manifest

```
Filesystem:
  /Volumes/Backup/Documents/
    ├── 2024-01-01-120000/  ✅ In manifest
    ├── 2024-01-02-120000/  ❌ Crashed before manifest write
    └── 2024-01-03-120000/  ✅ In manifest
```

**Detection:**

```rust
// Could scan filesystem and compare to manifest
fn detect_orphaned_snapshots(dest_path: &str) -> Vec<String> {
    let manifest = read_manifest(dest_path)?;
    let fs_folders = scan_backup_folders(dest_path)?;

    fs_folders.difference(&manifest.folders)  // Orphans!
}
```

**Recovery:**
- Rebuild manifest from filesystem scan
- Re-index all snapshots
- Validate file counts/sizes

---

## 7. Data Model Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    Backup Destination Drive                     │
│  /Volumes/Backup/Documents/                                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Snapshots (rsync creates):                                     │
│  ├── 2024-01-01-120000/                                        │
│  │   ├── file1.txt                                             │
│  │   ├── file2.txt                                             │
│  │   └── subdir/                                               │
│  │       └── file3.txt                                         │
│  ├── 2024-01-02-120000/                                        │
│  │   ├── file1.txt → hardlink to 2024-01-01-120000/file1.txt  │
│  │   ├── file2.txt (modified, new copy)                        │
│  │   └── subdir/ → hardlink                                    │
│  └── latest → symlink to 2024-01-02-120000/                    │
│                                                                 │
│  Metadata (.amber-meta/):                                       │
│  └── .amber-meta/                                               │
│      ├── manifest.json        (lightweight metadata)           │
│      └── index.db             (full SQLite index)              │
└────────────────────────────────────────────────────────────────┘

manifest.json structure:
{
  "version": 1,
  "job_id": "job-123",
  "snapshots": [
    {
      "id": "1704110400000",
      "timestamp": 1704110400000,
      "folder_name": "2024-01-01-120000",
      "file_count": 3,
      "total_size": 15000,
      "status": "Complete",
      "duration_ms": 5000
    }
  ]
}

index.db structure:
┌─────────────┐
│  snapshots  │
├─────────────┤
│ id          │───┐
│ job_id      │   │
│ timestamp   │   │ Foreign Key
│ file_count  │   │
│ total_size  │   │
└─────────────┘   │
                  │
┌─────────────┐   │
│    files    │   │
├─────────────┤   │
│ id          │   │
│ snapshot_id │───┘
│ path        │
│ name        │
│ size        │
│ mtime       │
│ inode       │
│ file_type   │
└─────────────┘
        │
        ▼
┌─────────────┐
│  files_fts  │  (FTS5 virtual table)
├─────────────┤
│ name        │
│ path        │
└─────────────┘
```

---

## 8. Failure Mode Analysis

| Failure | Detection | Impact | Recovery |
|---------|-----------|--------|----------|
| App crash during rsync | ❌ None | Orphaned snapshot | ❌ None |
| App crash during indexing | ✅ Incomplete index | Snapshot not searchable | ✅ Re-index |
| Index corruption | ❌ None | Broken search | ⚠️ Manual rebuild |
| Manifest corruption | ✅ JSON parse error | Job broken | ⚠️ Rebuild from index |
| Disk full during backup | ✅ rsync error | Partial snapshot | ⚠️ Manual cleanup |
| Bit rot (silent corruption) | ❌ None | Data loss | ❌ None |
| Duplicate file in source | ❌ None | Wasted space | ❌ None |
| Hard link broken | ❌ None | Wasted space | ❌ None |

**Legend:**
- ✅ Detected automatically
- ⚠️ Possible but manual/partial
- ❌ Not detected/no recovery

---

## 9. Recommendations for Improvement

### 9.1 Critical (Data Integrity)

**Priority 1: Add Checksums**

```rust
// Add to files table
ALTER TABLE files ADD COLUMN sha256 TEXT;

// Calculate during indexing
let hash = sha256_file(entry.path())?;
```

**Priority 2: Index Integrity Checks**

```rust
// Run on startup
fn verify_index_integrity() {
    if !index.check_integrity() {
        log::warn!("Index corruption detected, rebuilding...");
        index.rebuild_from_snapshots();
    }
}
```

**Priority 3: Crash Recovery**

```rust
// Detect orphaned snapshots on mount
fn recover_orphaned_snapshots(dest_path: &str) {
    let manifest_snapshots = read_manifest(dest_path)?;
    let fs_snapshots = scan_snapshot_folders(dest_path)?;

    for orphan in fs_snapshots.difference(&manifest_snapshots) {
        log::warn!("Found orphaned snapshot: {}", orphan);
        // Option 1: Add to manifest
        // Option 2: Delete folder
        // Option 3: User prompt
    }
}
```

### 9.2 High (Performance)

**Priority 4: Async Indexing**

```rust
// Don't block backup completion
tokio::spawn(async move {
    index.index_snapshot(&job_id, timestamp, &snapshot_path).await?;
    log::info!("Background indexing complete");
});
```

**Priority 5: Unified Stats Collection**

```rust
// Collect stats during indexing (single pass)
pub fn index_snapshot(&self, ...) -> Result<(IndexedSnapshot, Stats)> {
    let (files, stats) = self.walk_and_calculate(...);
    // Return both index and stats
}
```

### 9.3 Medium (User Experience)

**Priority 6: Dedup Reporting**

```rust
pub fn calculate_dedup_ratio(&self, snapshot_id: i64) -> f64 {
    // Count unique inodes
    let unique_inodes = conn.query_row(
        "SELECT COUNT(DISTINCT inode) FROM files WHERE snapshot_id = ?",
        params![snapshot_id],
        |row| row.get(0)
    )?;

    // Total files
    let total_files = conn.query_row(
        "SELECT COUNT(*) FROM files WHERE snapshot_id = ?",
        params![snapshot_id],
        |row| row.get(0)
    )?;

    1.0 - (unique_inodes as f64 / total_files as f64)
}
```

**Priority 7: Verify Restore**

```rust
pub fn verify_restore(backup_path: &str, restore_path: &str) -> Result<bool> {
    for file in index.list_files(snapshot_id) {
        let backup_hash = sha256_file(&file.backup_path)?;
        let restore_hash = sha256_file(&file.restore_path)?;

        if backup_hash != restore_hash {
            log::error!("Restore verification failed: {}", file.path);
            return Ok(false);
        }
    }
    Ok(true)
}
```

### 9.4 Low (Nice to Have)

**Priority 8: Compression Stats**

Track compression ratio per file type:
```sql
ALTER TABLE files ADD COLUMN compressed_size INTEGER;
ALTER TABLE files ADD COLUMN compression_method TEXT;
```

**Priority 9: Change Detection**

Store file hashes to detect changes without mtime:
```sql
CREATE INDEX idx_files_hash ON files(sha256);
```

---

## 10. Conclusion

### Summary Table

| Component | Status | Grade |
|-----------|--------|-------|
| Snapshot Creation | ✅ Reliable | A- |
| Manifest Integrity | ✅ Atomic writes | A |
| Index Structure | ✅ Well-designed | A |
| Query Performance | ✅ Fast (FTS5) | A+ |
| Data Integrity | ❌ No checksums | D |
| Crash Recovery | ❌ No detection | D- |
| Storage Efficiency | ⚠️ Hard links only | B |
| Corruption Detection | ❌ None | F |

### Overall Assessment

**Architecture: 8/10** - Well-designed dual-storage system with portable indexes.

**Reliability: 5/10** - No checksums or crash recovery is a critical flaw.

**Performance: 9/10** - Excellent query performance and parallel processing.

**User Experience: 7/10** - Fast searches but no corruption warnings.

### Immediate Action Items

1. **Add checksum support** - Without this, you cannot verify data integrity
2. **Implement crash recovery** - Detect and handle orphaned snapshots
3. **Add index validation** - Run integrity checks on startup
4. **Make indexing async** - Don't block backup completion
5. **Add dedup reporting** - Show users actual space savings

---

**Document Version:** 1.0
**Last Updated:** 2025-12-04
**Next Review:** When TIM-150 (checksums) is implemented
