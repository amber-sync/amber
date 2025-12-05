#!/bin/bash

# Generate Stress Test Data for Performance Benchmarks
# Creates: 40 snapshots, 2000 files each, ~80K total files, 30GB simulated

set -e

DB_PATH="${1:-./stress-test.db}"
NUM_SNAPSHOTS=40
FILES_PER_SNAPSHOT=2000

echo "🚀 Generating stress test database: $DB_PATH"
echo "   Snapshots: $NUM_SNAPSHOTS"
echo "   Files per snapshot: $FILES_PER_SNAPSHOT"
echo "   Total files: $((NUM_SNAPSHOTS * FILES_PER_SNAPSHOT))"
echo ""

# Remove existing database
rm -f "$DB_PATH"

# Create schema
sqlite3 "$DB_PATH" <<EOF
-- Jobs table
CREATE TABLE jobs (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    source_path TEXT NOT NULL,
    dest_path TEXT NOT NULL,
    strategy TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- Snapshots table
CREATE TABLE snapshots (
    id INTEGER PRIMARY KEY,
    job_id INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    manifest_path TEXT NOT NULL,
    state TEXT NOT NULL,
    files_count INTEGER DEFAULT 0,
    total_size INTEGER DEFAULT 0,
    FOREIGN KEY(job_id) REFERENCES jobs(id)
);

-- Files table
CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    snapshot_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    size INTEGER NOT NULL,
    mtime INTEGER NOT NULL,
    checksum TEXT,
    FOREIGN KEY(snapshot_id) REFERENCES snapshots(id)
);

-- Indexes for performance
CREATE INDEX idx_snapshots_job_timestamp ON snapshots(job_id, timestamp DESC);
CREATE INDEX idx_files_snapshot ON files(snapshot_id);
CREATE INDEX idx_files_path ON files(path);
CREATE INDEX idx_files_snapshot_path ON files(snapshot_id, path);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE files_fts USING fts5(
    path,
    content='files',
    content_rowid='id',
    tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER files_fts_insert AFTER INSERT ON files BEGIN
    INSERT INTO files_fts(rowid, path) VALUES (new.id, new.path);
END;

CREATE TRIGGER files_fts_delete AFTER DELETE ON files BEGIN
    INSERT INTO files_fts(files_fts, rowid, path) VALUES('delete', old.id, old.path);
END;

CREATE TRIGGER files_fts_update AFTER UPDATE ON files BEGIN
    INSERT INTO files_fts(files_fts, rowid, path) VALUES('delete', old.id, old.path);
    INSERT INTO files_fts(rowid, path) VALUES (new.id, new.path);
END;

-- Enable WAL mode for better performance
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=-64000;  -- 64MB cache
EOF

echo "✓ Schema created"

# Insert test job
sqlite3 "$DB_PATH" <<EOF
INSERT INTO jobs (id, name, source_path, dest_path, strategy, created_at)
VALUES (1, 'Stress Test Job', '/source/data', '/backup/data', 'incremental', 1700000000);
EOF

echo "✓ Test job inserted"

# Generate snapshots with files
echo "⏳ Generating snapshots and files..."

for ((snapshot=1; snapshot<=NUM_SNAPSHOTS; snapshot++)); do
    timestamp=$((1700000000 + snapshot * 3600))

    # Insert snapshot
    sqlite3 "$DB_PATH" <<EOF
INSERT INTO snapshots (id, job_id, timestamp, manifest_path, state)
VALUES ($snapshot, 1, $timestamp, '/manifests/snap_$snapshot.json', 'completed');
EOF

    # Generate files for this snapshot
    echo "   Snapshot $snapshot/$NUM_SNAPSHOTS: generating $FILES_PER_SNAPSHOT files..."

    # Use a temporary SQL file for bulk insert
    temp_sql=$(mktemp)

    echo "BEGIN TRANSACTION;" > "$temp_sql"

    for ((file=0; file<FILES_PER_SNAPSHOT; file++)); do
        folder=$((file / 100))
        size=$((1024 * (file % 1000 + 1)))
        mtime=$((1700000000 + file))
        checksum=$(echo -n "/data/folder$folder/file_$file.txt" | md5sum | cut -d' ' -f1)

        # Create diverse file paths
        if [ $((file % 5)) -eq 0 ]; then
            # Image files
            path="/data/photos/vacation_${snapshot}_${file}.jpg"
        elif [ $((file % 7)) -eq 0 ]; then
            # Document files
            path="/data/documents/report_${snapshot}_${file}.pdf"
        elif [ $((file % 11)) -eq 0 ]; then
            # Code files
            path="/data/projects/src/module_${file}.rs"
        else
            # Regular files
            path="/data/folder$folder/file_$file.txt"
        fi

        echo "INSERT INTO files (snapshot_id, path, size, mtime, checksum) VALUES ($snapshot, '$path', $size, $mtime, '$checksum');" >> "$temp_sql"
    done

    echo "COMMIT;" >> "$temp_sql"

    # Execute bulk insert
    sqlite3 "$DB_PATH" < "$temp_sql"
    rm "$temp_sql"

    # Update snapshot statistics
    sqlite3 "$DB_PATH" <<EOF
UPDATE snapshots
SET files_count = (SELECT COUNT(*) FROM files WHERE snapshot_id = $snapshot),
    total_size = (SELECT SUM(size) FROM files WHERE snapshot_id = $snapshot)
WHERE id = $snapshot;
EOF

    echo "   ✓ Snapshot $snapshot complete"
done

# Rebuild FTS index
echo "⏳ Rebuilding FTS5 index..."
sqlite3 "$DB_PATH" "INSERT INTO files_fts(files_fts) VALUES('optimize');"

# Analyze database for query optimization
echo "⏳ Analyzing database..."
sqlite3 "$DB_PATH" "ANALYZE;"

# Print statistics
echo ""
echo "📊 Database Statistics:"
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT
    'Total Snapshots' as Metric,
    COUNT(*) as Value
FROM snapshots
UNION ALL
SELECT
    'Total Files',
    COUNT(*)
FROM files
UNION ALL
SELECT
    'Total Size (GB)',
    ROUND(SUM(size) / 1024.0 / 1024.0 / 1024.0, 2)
FROM files
UNION ALL
SELECT
    'Database Size (MB)',
    ROUND((SELECT page_count * page_size / 1024.0 / 1024.0 FROM pragma_page_count(), pragma_page_size()), 2)
FROM pragma_page_count()
LIMIT 1;
EOF

echo ""
echo "✅ Stress test database generated: $DB_PATH"
echo ""
echo "🔍 Sample queries to verify:"
echo "   sqlite3 $DB_PATH \"SELECT COUNT(*) FROM snapshots;\""
echo "   sqlite3 $DB_PATH \"SELECT COUNT(*) FROM files;\""
echo "   sqlite3 $DB_PATH \"SELECT * FROM files_fts WHERE files_fts MATCH 'vacation*' LIMIT 10;\""
