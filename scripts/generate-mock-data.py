#!/usr/bin/env python3
"""
Generate realistic Time Machine-style mock backup data for Amber.

Creates REAL files on disk with proper hard links between snapshots,
exactly like Time Machine does. This allows the app to:
- Browse actual file trees
- Show real file sizes
- Display proper analytics

Usage:
    python3 scripts/generate-mock-data.py

Output:
    mock-data/dev-documents-backup/YYYY-MM-DD-HHMMSS/  (actual files)
    mock-data/dev-media-archive/YYYY-MM-DD-HHMMSS/    (actual files)
    mock-data/index.db                                (SQLite index)
    mock-data/jobs.json                               (job definitions)

TIMESTAMP CONVENTIONS:
    - mtime in SQLite: Unix SECONDS (Rust multiplies by 1000 for frontend)
    - timestamp in snapshots table: Unix MILLISECONDS
    - manifest.json timestamps: Unix MILLISECONDS
    - folder names: YYYY-MM-DD-HHMMSS format

This matches the Rust backend's expectations in index_service.rs:531
where mtime is multiplied by 1000 before sending to frontend.
"""

import sqlite3
import os
import sys
import random
import shutil
from datetime import datetime, timedelta
from pathlib import Path
import time
import hashlib

# Output paths
SCRIPT_DIR = Path(__file__).parent.parent
MOCK_DATA_DIR = SCRIPT_DIR / "mock-data"
JOBS_JSON_PATH = MOCK_DATA_DIR / "jobs.json"

def get_dest_db_path(job_id: str) -> Path:
    """Get the per-destination index.db path (TIM-127 architecture)."""
    return MOCK_DATA_DIR / job_id / ".amber-meta" / "index.db"

# Configuration - smaller but REAL files
NUM_SNAPSHOTS_DOCS = 12  # ~3 months of weekly backups
NUM_SNAPSHOTS_MEDIA = 8  # ~2 months of weekly backups
FILES_PER_JOB = 500  # Number of actual files to create
CHANGE_RATE = 0.15  # 15% of files change between snapshots

# File templates for realistic content
DOCUMENT_TYPES = [
    ("txt", 100, 5000, "notes draft document readme changelog"),
    ("md", 200, 8000, "README documentation guide tutorial"),
    ("json", 50, 2000, "config package settings manifest"),
    ("csv", 500, 50000, "data export report analytics"),
    ("py", 200, 10000, "script utils main app test"),
    ("js", 200, 8000, "index app utils helpers components"),
    ("html", 300, 15000, "index page template layout"),
    ("css", 100, 5000, "styles main theme variables"),
]

MEDIA_TYPES = [
    ("jpg", 50000, 500000, "photo image picture"),
    ("png", 20000, 200000, "screenshot icon logo"),
    ("mp3", 1000000, 5000000, "audio track song"),
    ("mp4", 5000000, 50000000, "video clip recording"),
    ("pdf", 100000, 2000000, "document report manual"),
]

# Job definitions
JOBS = [
    {
        "id": "dev-documents-backup",
        "name": "Documents Backup",
        "source_path": "/Users/demo/Documents",
        "file_types": DOCUMENT_TYPES,
        "num_snapshots": NUM_SNAPSHOTS_DOCS,
        "directories": [
            "Projects/webapp",
            "Projects/api",
            "Projects/scripts",
            "Notes",
            "Work/reports",
            "Work/presentations",
            "Personal",
            "Archive",
        ],
    },
    {
        "id": "dev-media-archive",
        "name": "Media Archive",
        "source_path": "/Users/demo/Media",
        "file_types": MEDIA_TYPES,
        "num_snapshots": NUM_SNAPSHOTS_MEDIA,
        "directories": [
            "Photos/2024",
            "Photos/2023",
            "Videos/Projects",
            "Videos/Archive",
            "Music/Library",
            "Documents",
        ],
    },
]

# Track generated data
GENERATED_SNAPSHOTS = {}
CUMULATIVE_SIZES = {}


def create_schema(conn: sqlite3.Connection):
    """Create SQLite schema for file index.

    IMPORTANT: This schema MUST match src-tauri/src/services/index_service.rs exactly!
    The Rust code uses PRAGMA user_version for schema versioning.
    """
    conn.executescript("""
        -- Schema v1: Core tables
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

        CREATE INDEX IF NOT EXISTS idx_snapshots_job ON snapshots(job_id);
        CREATE INDEX IF NOT EXISTS idx_files_snapshot_parent ON files(snapshot_id, parent_path);
        CREATE INDEX IF NOT EXISTS idx_files_path ON files(snapshot_id, path);
        CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);

        -- Schema v2: FTS5 for full-text search
        CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
            name,
            path,
            content=files,
            content_rowid=id,
            tokenize='unicode61 remove_diacritics 1'
        );

        -- Triggers to keep FTS index in sync
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

        -- Set schema version to match Rust code
        PRAGMA user_version = 2;
    """)
    conn.commit()


def generate_file_content(file_type: str, size: int, seed: int) -> bytes:
    """Generate deterministic file content based on seed."""
    rng = random.Random(seed)

    if file_type in ["jpg", "png", "mp3", "mp4", "pdf"]:
        # Binary files - random bytes
        return bytes(rng.getrandbits(8) for _ in range(size))
    else:
        # Text files - generate readable content
        words = "the quick brown fox jumps over lazy dog lorem ipsum dolor sit amet consectetur adipiscing elit".split()
        content = []
        while len(" ".join(content)) < size:
            content.append(rng.choice(words))
        return " ".join(content)[:size].encode('utf-8')


def timestamp_to_folder_name(ts_ms: int) -> str:
    """Convert millisecond timestamp to Time Machine folder format."""
    dt = datetime.fromtimestamp(ts_ms / 1000)
    return dt.strftime("%Y-%m-%d-%H%M%S")


def create_file_on_disk(file_path: Path, content: bytes):
    """Create a file with content on disk."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, 'wb') as f:
        f.write(content)


def create_hard_link(source: Path, target: Path):
    """Create a hard link from target to source."""
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        target.unlink()
    os.link(source, target)


def generate_job_files(job: dict, rng: random.Random) -> list:
    """Generate the list of files for a job (metadata only)."""
    files = []
    file_types = job["file_types"]
    directories = job["directories"]

    for i in range(FILES_PER_JOB):
        # Pick random directory and file type
        directory = rng.choice(directories)
        ext, min_size, max_size, name_parts = rng.choice(file_types)

        # Generate file name
        name_part = rng.choice(name_parts.split())
        suffix = rng.randint(1, 999)
        filename = f"{name_part}_{suffix:03d}.{ext}"

        # Generate size
        size = rng.randint(min_size, max_size)

        # Content seed for deterministic generation
        content_seed = hash(f"{job['id']}_{directory}_{filename}")

        files.append({
            "directory": directory,
            "filename": filename,
            "size": size,
            "extension": ext,
            "content_seed": content_seed,
            "modified": 0,  # Will be set per-snapshot
        })

    return files


def create_snapshot(job: dict, snapshot_num: int, total_snapshots: int,
                    base_files: list, prev_snapshot_path: Path | None,
                    conn: sqlite3.Connection, rng: random.Random) -> dict:
    """Create a single snapshot with real files and hard links."""

    job_id = job["id"]
    job_dir = MOCK_DATA_DIR / job_id

    # Calculate timestamp (going backwards from now)
    now = datetime.now()
    days_ago = (total_snapshots - snapshot_num) * 7  # Weekly snapshots
    snapshot_time = now - timedelta(days=days_ago, hours=rng.randint(0, 12))
    timestamp_ms = int(snapshot_time.timestamp() * 1000)  # Milliseconds for manifest/folder names
    timestamp_sec = int(snapshot_time.timestamp())        # Seconds for mtime (Rust multiplies by 1000)

    folder_name = timestamp_to_folder_name(timestamp_ms)
    snapshot_path = job_dir / folder_name
    snapshot_path.mkdir(parents=True, exist_ok=True)

    print(f"    Creating snapshot {snapshot_num}/{total_snapshots}: {folder_name}")

    # Determine which files to change this snapshot
    files_to_change = set()
    if snapshot_num > 1:
        num_changes = int(len(base_files) * CHANGE_RATE)
        files_to_change = set(rng.sample(range(len(base_files)), num_changes))

    # Add some new files occasionally
    if snapshot_num > 1 and rng.random() > 0.7:
        new_file_count = rng.randint(5, 20)
        for _ in range(new_file_count):
            ext, min_size, max_size, name_parts = rng.choice(job["file_types"])
            name_part = rng.choice(name_parts.split())
            filename = f"{name_part}_new_{rng.randint(1000, 9999)}.{ext}"
            base_files.append({
                "directory": rng.choice(job["directories"]),
                "filename": filename,
                "size": rng.randint(min_size, max_size),
                "extension": ext,
                "content_seed": rng.randint(0, 999999999),
                "modified": 0,
            })
            files_to_change.add(len(base_files) - 1)

    # Track totals
    total_size = 0
    file_count = 0
    db_files = []
    directories_seen = set()

    # Process each file
    for i, file_info in enumerate(base_files):
        file_path = snapshot_path / file_info["directory"] / file_info["filename"]
        relative_path = f"{file_info['directory']}/{file_info['filename']}"
        parent_path = file_info["directory"]

        # Track directories
        parts = file_info["directory"].split("/")
        for j in range(len(parts)):
            dir_path = "/".join(parts[:j+1])
            directories_seen.add(dir_path)

        if i in files_to_change or prev_snapshot_path is None:
            # Create new file content
            if i in files_to_change:
                # Modify the content seed for changed files
                file_info["content_seed"] = rng.randint(0, 999999999)
                file_info["size"] = rng.randint(
                    file_info["size"] // 2,
                    file_info["size"] * 2
                )

            content = generate_file_content(
                file_info["extension"],
                min(file_info["size"], 10000),  # Cap actual size for speed
                file_info["content_seed"]
            )
            create_file_on_disk(file_path, content)
            # Store mtime as SECONDS (Rust index_service.rs:531 multiplies by 1000 for frontend)
            file_info["modified"] = timestamp_sec
        else:
            # Hard link from previous snapshot
            prev_file_path = prev_snapshot_path / file_info["directory"] / file_info["filename"]
            if prev_file_path.exists():
                create_hard_link(prev_file_path, file_path)
            else:
                # File doesn't exist in prev, create it
                content = generate_file_content(
                    file_info["extension"],
                    min(file_info["size"], 10000),
                    file_info["content_seed"]
                )
                create_file_on_disk(file_path, content)
                # Store mtime as SECONDS (Rust index_service.rs:531 multiplies by 1000 for frontend)
                file_info["modified"] = timestamp_sec

        total_size += file_info["size"]
        file_count += 1

        # Queue for DB insert (column names must match Rust schema!)
        db_files.append({
            "name": file_info["filename"],
            "path": relative_path,
            "parent_path": parent_path,
            "file_type": "file",  # Must be lowercase to match FileType::File.as_str()
            "size": file_info["size"],
            "mtime": file_info["modified"],  # Unix SECONDS (Rust multiplies by 1000 for frontend)
        })

    # Insert snapshot into DB (must include root_path!)
    root_path = str(snapshot_path)
    cursor = conn.execute("""
        INSERT INTO snapshots (job_id, timestamp, root_path, file_count, total_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (job_id, timestamp_ms, root_path, file_count, total_size, int(time.time())))
    snapshot_id = cursor.lastrowid

    # Insert directories
    for dir_path in sorted(directories_seen):
        parts = dir_path.split("/")
        dir_name = parts[-1]
        parent = "/".join(parts[:-1]) if len(parts) > 1 else ""

        # mtime stored as SECONDS (Rust multiplies by 1000 for frontend)
        conn.execute("""
            INSERT INTO files (snapshot_id, path, name, parent_path, size, mtime, inode, file_type)
            VALUES (?, ?, ?, ?, 0, ?, NULL, 'dir')
        """, (snapshot_id, dir_path, dir_name, parent, timestamp_sec))

    # Insert files (column names must match Rust schema!)
    for f in db_files:
        conn.execute("""
            INSERT INTO files (snapshot_id, path, name, parent_path, size, mtime, inode, file_type)
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
        """, (snapshot_id, f["path"], f["name"], f["parent_path"], f["size"], f["mtime"], f["file_type"]))

    conn.commit()

    # Track cumulative size for job
    if job_id not in CUMULATIVE_SIZES:
        CUMULATIVE_SIZES[job_id] = 50_000_000_000 if "documents" in job_id else 200_000_000_000

    # Realistic growth
    growth = rng.randint(500_000_000, 3_000_000_000) if "documents" in job_id else rng.randint(2_000_000_000, 10_000_000_000)
    if rng.random() > 0.9:
        growth *= rng.randint(3, 6)  # Occasional spike
    CUMULATIVE_SIZES[job_id] += growth

    # Track snapshot for jobs.json
    if job_id not in GENERATED_SNAPSHOTS:
        GENERATED_SNAPSHOTS[job_id] = []

    GENERATED_SNAPSHOTS[job_id].append({
        "id": str(timestamp_ms),
        "timestamp": timestamp_ms,
        "sizeBytes": total_size,  # Use actual per-snapshot size, not cumulative
        "fileCount": file_count + len(directories_seen),
        "changesCount": len(files_to_change),
        "status": "Complete",
        "path": str(snapshot_path.resolve()),
    })

    return {
        "path": snapshot_path,
        "timestamp": timestamp_ms,
        "file_count": file_count,
        "total_size": total_size,
    }


def generate_job(job: dict) -> sqlite3.Connection:
    """Generate all snapshots for a job with per-destination database.

    Returns the database connection for FTS population.
    """
    print(f"\nGenerating job: {job['name']}")
    print(f"  Snapshots: {job['num_snapshots']}")
    print(f"  Files per snapshot: ~{FILES_PER_JOB}")

    rng = random.Random(hash(job["id"]))

    # Clean up old data
    job_dir = MOCK_DATA_DIR / job["id"]
    if job_dir.exists():
        print(f"  Removing old data: {job_dir}")
        shutil.rmtree(job_dir)
    job_dir.mkdir(parents=True, exist_ok=True)

    # Create per-destination .amber-meta directory and database (TIM-127)
    db_path = get_dest_db_path(job["id"])
    db_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"  Creating database: {db_path}")
    conn = sqlite3.connect(db_path)
    create_schema(conn)

    # Generate base file list
    base_files = generate_job_files(job, rng)

    prev_snapshot_path = None
    for i in range(1, job["num_snapshots"] + 1):
        result = create_snapshot(
            job, i, job["num_snapshots"],
            base_files, prev_snapshot_path,
            conn, rng
        )
        prev_snapshot_path = result["path"]

    print(f"  Total files across snapshots: {len(base_files)}")
    return conn


def populate_fts(conn: sqlite3.Connection):
    """Populate FTS5 index."""
    print("\nPopulating FTS5 index...")
    conn.execute("INSERT INTO files_fts(files_fts) VALUES('rebuild')")
    conn.commit()


def generate_manifest(job: dict):
    """Generate manifest.json for a job (the new repository-centric format).

    The manifest is stored at: {dest_path}/.amber-meta/manifest.json
    This is what the frontend reads to display snapshots.
    """
    import json
    import socket

    job_id = job["id"]
    job_dir = MOCK_DATA_DIR / job_id
    meta_dir = job_dir / ".amber-meta"
    meta_dir.mkdir(parents=True, exist_ok=True)

    now_ms = int(datetime.now().timestamp() * 1000)
    snapshots = GENERATED_SNAPSHOTS.get(job_id, [])

    # Convert snapshots to manifest format (camelCase)
    manifest_snapshots = []
    for s in sorted(snapshots, key=lambda x: x["timestamp"]):
        # Folder name is YYYY-MM-DD-HHMMSS
        dt = datetime.fromtimestamp(s["timestamp"] / 1000)
        folder_name = dt.strftime("%Y-%m-%d-%H%M%S")

        manifest_snapshots.append({
            "id": str(s["timestamp"]),
            "timestamp": s["timestamp"],
            "folderName": folder_name,
            "fileCount": s["fileCount"],
            "totalSize": s["sizeBytes"],
            "status": "Complete",
            "durationMs": random.randint(5000, 30000),  # Fake duration
            "changesCount": s.get("changesCount", 0)  # Number of files changed since last backup
        })

    # Build manifest
    hostname = socket.gethostname()
    manifest = {
        "version": 1,
        "machineId": f"{hostname}-mock",
        "machineName": hostname,
        "jobId": job_id,
        "jobName": job["name"],
        "sourcePath": job["source_path"],
        "createdAt": snapshots[0]["timestamp"] if snapshots else now_ms,
        "updatedAt": snapshots[-1]["timestamp"] if snapshots else now_ms,
        "snapshots": manifest_snapshots
    }

    manifest_path = meta_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"  Generated manifest: {manifest_path}")
    print(f"    Snapshots: {len(manifest_snapshots)}")


def generate_jobs_json():
    """Generate jobs.json for the app.

    Note: snapshots field is included for backwards compatibility but
    the frontend should load snapshots from manifest.json via getJobsWithStatus().
    """
    import json

    jobs_data = []
    now_ms = int(datetime.now().timestamp() * 1000)

    for job in JOBS:
        job_id = job["id"]
        dest_path = str((MOCK_DATA_DIR / job_id).resolve())

        snapshots = GENERATED_SNAPSHOTS.get(job_id, [])
        snapshots_sorted = sorted(snapshots, key=lambda s: s["timestamp"], reverse=True)
        last_run = snapshots_sorted[0]["timestamp"] if snapshots_sorted else now_ms

        jobs_data.append({
            "id": job_id,
            "name": job["name"],
            "sourcePath": job["source_path"],
            "destPath": dest_path,
            "mode": "TIME_MACHINE",
            "status": "SUCCESS",
            "destinationType": "LOCAL",
            "scheduleInterval": 1440,
            "schedule": None,
            "config": {
                "recursive": True,
                "compress": False,
                "archive": True,
                "delete": False,
                "verbose": True,
                "excludePatterns": [],
                "linkDest": None,
                "customFlags": "",
                "customCommand": None
            },
            "sshConfig": None,
            "cloudConfig": None,
            "lastRun": last_run,
            # Note: snapshots are NOT included here anymore - they come from manifest.json
        })

    with open(JOBS_JSON_PATH, "w") as f:
        json.dump(jobs_data, f, indent=2)

    print(f"\nGenerated {JOBS_JSON_PATH}")
    for job_data in jobs_data:
        print(f"  {job_data['id']}")


def main():
    print("=" * 60)
    print("Amber Time Machine Mock Data Generator")
    print("=" * 60)
    print(f"Creating REAL files with hard links between snapshots")
    print(f"Output: {MOCK_DATA_DIR}")
    print(f"Using TIM-127 destination-centric architecture: <dest>/.amber-meta/index.db")
    print()

    # Ensure output directory exists
    MOCK_DATA_DIR.mkdir(parents=True, exist_ok=True)

    start_time = time.time()

    # Generate each job with its own per-destination database
    job_connections = []
    for job in JOBS:
        conn = generate_job(job)
        job_connections.append((job, conn))

    # Populate FTS for each job's database
    print("\nPopulating FTS5 indexes...")
    for job, conn in job_connections:
        populate_fts(conn)
        conn.close()

    # Generate manifest.json for each job (for frontend to load snapshots)
    print("\nGenerating manifests...")
    for job in JOBS:
        generate_manifest(job)

    # Generate jobs.json
    generate_jobs_json()

    # Stats
    elapsed = time.time() - start_time

    # Calculate total DB size across all destinations
    total_db_size = sum(
        get_dest_db_path(job["id"]).stat().st_size
        for job in JOBS
        if get_dest_db_path(job["id"]).exists()
    )
    db_size_mb = total_db_size / (1024 * 1024)

    # Count total files on disk
    total_files = sum(
        len(list((MOCK_DATA_DIR / job["id"]).rglob("*")))
        for job in JOBS
    )

    print()
    print("=" * 60)
    print("Generation Complete!")
    print("=" * 60)
    print(f"  Total snapshots: {sum(job['num_snapshots'] for job in JOBS)}")
    print(f"  Files on disk: {total_files:,}")
    print(f"  Total database size: {db_size_mb:.1f} MB")
    print(f"  Time elapsed: {elapsed:.1f} seconds")
    print()
    print("Output files (destination-centric):")
    print(f"  {JOBS_JSON_PATH}")
    for job in JOBS:
        print(f"  {MOCK_DATA_DIR / job['id']}/")
        print(f"    └── .amber-meta/")
        print(f"        ├── manifest.json")
        print(f"        └── index.db")
    print()
    print("To use: Press Cmd+Shift+D in the app and click 'Seed Mock Data'")


if __name__ == "__main__":
    main()
