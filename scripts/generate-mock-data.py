#!/usr/bin/env python3
"""
Generate realistic mock backup data for Amber development testing.

This script creates a SQLite database with:
- 2 backup jobs (Documents & Media) with different characteristics
- 85 snapshots spanning 2 years
- ~3-4 million file entries with realistic directory structures
- Various file types, sizes, and modification times

Run once, then the app can copy the generated database for instant seeding.

Usage:
    python3 scripts/generate-mock-data.py

Output:
    mock-data/dev-index.db (~800MB-1GB)
"""

import sqlite3
import random
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
import time

# Output path
SCRIPT_DIR = Path(__file__).parent.parent
MOCK_DATA_DIR = SCRIPT_DIR / "mock-data"
DB_PATH = MOCK_DATA_DIR / "dev-index.db"

# Also generate jobs.json for the app
JOBS_JSON_PATH = MOCK_DATA_DIR / "jobs.json"

# ============================================================================
# File Templates - Realistic file names and sizes
# ============================================================================

DOCUMENT_TEMPLATES = [
    # (extension, name_parts, min_size, max_size)
    ("pdf", ["report", "invoice", "contract", "proposal", "presentation", "manual", "guide", "whitepaper", "thesis", "resume", "specification", "datasheet", "brochure"], 50_000, 15_000_000),
    ("docx", ["document", "letter", "memo", "notes", "draft", "review", "summary", "analysis", "plan", "outline", "meeting-notes", "agenda", "minutes"], 20_000, 5_000_000),
    ("xlsx", ["spreadsheet", "budget", "forecast", "data", "analysis", "tracker", "schedule", "inventory", "ledger", "metrics", "expenses", "revenue", "quarterly"], 30_000, 8_000_000),
    ("pptx", ["slides", "presentation", "deck", "pitch", "keynote", "overview", "summary", "roadmap", "strategy", "training", "onboarding", "quarterly-review"], 500_000, 50_000_000),
    ("txt", ["notes", "readme", "log", "todo", "changelog", "license", "config", "manifest", "index", "list", "scratch", "ideas"], 100, 100_000),
    ("md", ["README", "CHANGELOG", "CONTRIBUTING", "docs", "notes", "guide", "tutorial", "reference", "api", "spec", "architecture", "design"], 500, 50_000),
    ("json", ["config", "package", "settings", "manifest", "data", "schema", "tsconfig", "eslint", "prettier", "babel", "workspace"], 200, 500_000),
    ("yaml", ["config", "docker-compose", "ci", "workflow", "kubernetes", "helm", "ansible", "terraform", "cloudformation", "settings", "pipeline"], 200, 100_000),
    ("csv", ["data", "export", "report", "analytics", "users", "transactions", "logs", "metrics", "inventory", "contacts"], 10_000, 50_000_000),
]

CODE_TEMPLATES = [
    ("ts", ["index", "app", "utils", "helpers", "types", "constants", "hooks", "components", "services", "api", "store", "reducer", "actions", "middleware"], 500, 50_000),
    ("tsx", ["App", "Component", "Page", "Layout", "Header", "Footer", "Sidebar", "Modal", "Button", "Form", "Input", "Table", "Card", "List", "Chart"], 1_000, 80_000),
    ("js", ["index", "main", "app", "utils", "config", "helpers", "constants", "setup", "bootstrap", "init", "server", "client", "worker"], 500, 50_000),
    ("jsx", ["App", "Component", "Page", "Widget", "Card", "List", "Table", "Chart", "Form", "Input", "Dialog", "Tooltip", "Menu"], 1_000, 60_000),
    ("rs", ["main", "lib", "mod", "utils", "types", "error", "config", "service", "handler", "state", "commands", "models", "tests"], 1_000, 100_000),
    ("py", ["main", "app", "utils", "helpers", "models", "views", "tests", "config", "setup", "init", "api", "services", "tasks", "celery"], 500, 80_000),
    ("go", ["main", "server", "handler", "model", "service", "utils", "config", "middleware", "router", "db", "api", "client"], 1_000, 60_000),
    ("css", ["styles", "main", "app", "components", "layout", "theme", "variables", "utilities", "reset", "global", "animations"], 500, 200_000),
    ("scss", ["styles", "main", "variables", "mixins", "components", "layout", "theme", "utils", "base", "vendor", "abstracts"], 500, 150_000),
    ("html", ["index", "about", "contact", "products", "services", "blog", "portfolio", "404", "landing", "template", "email"], 1_000, 100_000),
    ("sql", ["schema", "migrations", "seeds", "queries", "views", "procedures", "triggers", "indexes", "backup"], 500, 500_000),
    ("sh", ["build", "deploy", "test", "setup", "install", "run", "start", "stop", "clean", "lint"], 200, 20_000),
    ("swift", ["AppDelegate", "ViewController", "Model", "View", "Service", "Manager", "Helper", "Extension", "Protocol"], 1_000, 80_000),
    ("kt", ["MainActivity", "Application", "ViewModel", "Repository", "Service", "Adapter", "Fragment", "Dialog"], 1_000, 60_000),
]

MEDIA_TEMPLATES = [
    ("jpg", ["photo", "image", "screenshot", "scan", "capture", "portrait", "landscape", "product", "event", "travel", "family", "vacation", "wedding"], 100_000, 15_000_000),
    ("jpeg", ["IMG", "DSC", "DCIM", "picture", "snapshot", "camera", "phone"], 100_000, 12_000_000),
    ("png", ["screenshot", "icon", "logo", "graphic", "diagram", "chart", "banner", "thumbnail", "avatar", "sprite", "mockup", "wireframe"], 50_000, 10_000_000),
    ("gif", ["animation", "banner", "icon", "reaction", "meme", "loader", "preview", "demo", "tutorial", "clip"], 20_000, 5_000_000),
    ("webp", ["image", "photo", "thumbnail", "preview", "optimized", "compressed"], 30_000, 8_000_000),
    ("svg", ["icon", "logo", "illustration", "graphic", "vector", "badge", "symbol", "chart"], 1_000, 500_000),
    ("mp4", ["video", "recording", "clip", "demo", "tutorial", "presentation", "interview", "webinar", "event", "screen-recording", "meeting"], 5_000_000, 500_000_000),
    ("mov", ["footage", "raw", "edit", "clip", "project", "export", "render", "final", "draft", "review", "iPhone"], 10_000_000, 800_000_000),
    ("avi", ["video", "recording", "capture", "archive", "legacy", "converted"], 10_000_000, 400_000_000),
    ("mkv", ["movie", "series", "episode", "documentary", "concert", "archive"], 100_000_000, 2_000_000_000),
    ("mp3", ["audio", "podcast", "recording", "music", "voice", "interview", "meeting", "note", "memo", "track", "song"], 1_000_000, 20_000_000),
    ("wav", ["recording", "raw", "master", "sample", "loop", "effect", "voice", "instrument", "ambient", "foley"], 5_000_000, 100_000_000),
    ("flac", ["album", "track", "lossless", "master", "archive", "music"], 20_000_000, 80_000_000),
    ("aac", ["audio", "podcast", "audiobook", "voice", "compressed"], 500_000, 15_000_000),
    ("psd", ["design", "mockup", "layout", "banner", "poster", "flyer", "logo", "icon", "template", "composition", "artwork"], 10_000_000, 200_000_000),
    ("ai", ["vector", "logo", "icon", "illustration", "graphic", "design", "artwork", "pattern", "template", "asset"], 5_000_000, 100_000_000),
    ("sketch", ["design", "mockup", "wireframe", "prototype", "component", "symbol", "screen", "flow", "system", "kit"], 5_000_000, 150_000_000),
    ("fig", ["design", "mockup", "prototype", "component", "system", "library", "template"], 1_000_000, 50_000_000),
    ("xd", ["design", "prototype", "wireframe", "mockup", "artboard", "component"], 2_000_000, 80_000_000),
    ("raw", ["photo", "image", "capture", "DSC", "IMG", "unedited"], 20_000_000, 50_000_000),
    ("cr2", ["photo", "canon", "raw", "capture"], 20_000_000, 40_000_000),
    ("nef", ["photo", "nikon", "raw", "capture"], 20_000_000, 45_000_000),
    ("dng", ["photo", "raw", "adobe", "converted"], 15_000_000, 35_000_000),
]

# ============================================================================
# Directory Structures
# ============================================================================

DOCUMENT_DIRS = [
    "Documents",
    "Documents/Work",
    "Documents/Work/Projects",
    "Documents/Work/Projects/2022",
    "Documents/Work/Projects/2023",
    "Documents/Work/Projects/2024",
    "Documents/Work/Reports",
    "Documents/Work/Reports/Quarterly",
    "Documents/Work/Reports/Annual",
    "Documents/Work/Contracts",
    "Documents/Work/Proposals",
    "Documents/Work/Presentations",
    "Documents/Personal",
    "Documents/Personal/Finance",
    "Documents/Personal/Finance/Taxes",
    "Documents/Personal/Finance/Investments",
    "Documents/Personal/Legal",
    "Documents/Personal/Medical",
    "Documents/Personal/Insurance",
    "Desktop",
    "Desktop/Current",
    "Downloads",
    "Downloads/Archives",
    "Code",
    "Code/Projects",
    "Code/Projects/web-app",
    "Code/Projects/web-app/src",
    "Code/Projects/web-app/src/components",
    "Code/Projects/web-app/src/components/ui",
    "Code/Projects/web-app/src/hooks",
    "Code/Projects/web-app/src/utils",
    "Code/Projects/web-app/src/services",
    "Code/Projects/web-app/src/types",
    "Code/Projects/web-app/tests",
    "Code/Projects/api-server",
    "Code/Projects/api-server/src",
    "Code/Projects/api-server/src/routes",
    "Code/Projects/api-server/src/models",
    "Code/Projects/api-server/src/middleware",
    "Code/Projects/api-server/tests",
    "Code/Projects/mobile-app",
    "Code/Projects/mobile-app/src",
    "Code/Projects/mobile-app/src/screens",
    "Code/Projects/mobile-app/src/components",
    "Code/Projects/data-pipeline",
    "Code/Projects/data-pipeline/scripts",
    "Code/Projects/data-pipeline/notebooks",
    "Code/Libraries",
    "Code/Experiments",
    "Code/Sandbox",
    "Notes",
    "Notes/Meetings",
    "Notes/Meetings/2023",
    "Notes/Meetings/2024",
    "Notes/Ideas",
    "Notes/Research",
    "Notes/Journal",
    "Archive",
    "Archive/2021",
    "Archive/2022",
    "Archive/2023",
    "Backups",
    "Backups/Databases",
    "Backups/Configs",
    "Temp",
    ".config",
    ".ssh",
    ".aws",
]

MEDIA_DIRS = [
    "Photos",
    "Photos/2021",
    "Photos/2021/01-January",
    "Photos/2021/02-February",
    "Photos/2021/03-March",
    "Photos/2021/Summer",
    "Photos/2021/Holidays",
    "Photos/2022",
    "Photos/2022/01-January",
    "Photos/2022/02-February",
    "Photos/2022/03-March",
    "Photos/2022/04-April",
    "Photos/2022/05-May",
    "Photos/2022/06-June",
    "Photos/2022/Summer",
    "Photos/2022/Fall",
    "Photos/2022/Holidays",
    "Photos/2022/Family",
    "Photos/2022/Travel",
    "Photos/2022/Travel/Europe",
    "Photos/2022/Travel/Asia",
    "Photos/2023",
    "Photos/2023/01-January",
    "Photos/2023/02-February",
    "Photos/2023/03-March",
    "Photos/2023/04-April",
    "Photos/2023/Spring",
    "Photos/2023/Summer",
    "Photos/2023/Fall",
    "Photos/2023/Family",
    "Photos/2023/Travel",
    "Photos/2023/Events",
    "Photos/2023/Events/Wedding",
    "Photos/2023/Events/Birthday",
    "Photos/2024",
    "Photos/2024/01-January",
    "Photos/2024/02-February",
    "Photos/2024/Events",
    "Photos/2024/Projects",
    "Photos/Screenshots",
    "Photos/Screenshots/2023",
    "Photos/Screenshots/2024",
    "Photos/Scans",
    "Photos/Scans/Documents",
    "Photos/Scans/Old-Photos",
    "Photos/Camera-Roll",
    "Photos/Edited",
    "Videos",
    "Videos/Raw",
    "Videos/Raw/2022",
    "Videos/Raw/2023",
    "Videos/Raw/2024",
    "Videos/Edited",
    "Videos/Edited/YouTube",
    "Videos/Edited/Personal",
    "Videos/Projects",
    "Videos/Projects/Documentary",
    "Videos/Projects/Tutorial",
    "Videos/Exports",
    "Videos/Screen-Recordings",
    "Videos/Screen-Recordings/Meetings",
    "Videos/Screen-Recordings/Tutorials",
    "Music",
    "Music/Library",
    "Music/Library/Albums",
    "Music/Library/Playlists",
    "Music/Podcasts",
    "Music/Podcasts/Tech",
    "Music/Podcasts/Business",
    "Music/Recordings",
    "Music/Recordings/Voice-Memos",
    "Music/Recordings/Interviews",
    "Design",
    "Design/Projects",
    "Design/Projects/Website-Redesign",
    "Design/Projects/Mobile-App",
    "Design/Projects/Branding",
    "Design/Assets",
    "Design/Assets/Icons",
    "Design/Assets/Illustrations",
    "Design/Assets/Stock-Photos",
    "Design/Templates",
    "Design/Exports",
    "Design/Exports/PNG",
    "Design/Exports/SVG",
    "Design/Exports/PDF",
    "Archive",
    "Archive/Old-Photos",
    "Archive/Old-Photos/2010s",
    "Archive/Old-Photos/2000s",
    "Archive/Old-Videos",
    "Archive/Legacy-Projects",
]

# ============================================================================
# Job Configuration
# ============================================================================

JOBS = [
    {
        "id": "dev-documents-backup",
        "name": "Documents Backup",
        "source_path": "/Users/demo/Documents",
        "num_snapshots": 50,  # Weekly backups over ~2 years
        "files_per_snapshot": (40_000, 60_000),
        "templates": DOCUMENT_TEMPLATES + CODE_TEMPLATES,
        "directories": DOCUMENT_DIRS,
        "doc_weight": 0.35,
        "code_weight": 0.55,
    },
    {
        "id": "dev-media-archive",
        "name": "Media Archive",
        "source_path": "/Users/demo/Media",
        "num_snapshots": 35,  # Bi-weekly backups
        "files_per_snapshot": (25_000, 45_000),
        "templates": MEDIA_TEMPLATES,
        "directories": MEDIA_DIRS,
    },
]

# Track generated snapshots for jobs.json
GENERATED_SNAPSHOTS = {}

# Track cumulative size per job for realistic growth
CUMULATIVE_SIZES = {}


def create_schema(conn: sqlite3.Connection):
    """Create the database schema matching Amber's index_service.

    NOTE: FTS5 table and triggers are created AFTER bulk insert for speed.
    """
    conn.executescript("""
        -- Snapshots table
        CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            root_path TEXT NOT NULL,
            file_count INTEGER DEFAULT 0,
            total_size INTEGER DEFAULT 0,
            UNIQUE(job_id, timestamp)
        );
        CREATE INDEX IF NOT EXISTS idx_snapshots_job ON snapshots(job_id);
        CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots(timestamp);

        -- Files table (indexes created AFTER bulk insert for speed)
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id INTEGER NOT NULL,
            path TEXT NOT NULL,
            name TEXT NOT NULL,
            parent_path TEXT NOT NULL,
            size INTEGER NOT NULL,
            mtime INTEGER NOT NULL,
            inode INTEGER,
            file_type TEXT NOT NULL DEFAULT 'file',
            FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
        );
    """)
    conn.commit()


def create_indexes_and_fts(conn: sqlite3.Connection):
    """Create indexes and FTS table AFTER bulk insert (much faster)."""
    print("Creating indexes...")
    conn.executescript("""
        CREATE INDEX IF NOT EXISTS idx_files_snapshot ON files(snapshot_id);
        CREATE INDEX IF NOT EXISTS idx_files_parent ON files(snapshot_id, parent_path);
        CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
    """)
    conn.commit()

    print("Creating FTS5 table and populating...")
    conn.executescript("""
        -- FTS5 virtual table for full-text search
        CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
            name,
            path,
            content='files',
            content_rowid='id',
            tokenize='porter unicode61'
        );

        -- Populate FTS from existing data (much faster than triggers during insert)
        INSERT INTO files_fts(rowid, name, path) SELECT id, name, path FROM files;

        -- Triggers to keep FTS in sync for future operations
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
    """)
    conn.commit()


def generate_file(templates, directories, base_timestamp: int, rng: random.Random) -> tuple:
    """Generate a random file entry."""
    ext, names, min_size, max_size = rng.choice(templates)
    name_base = rng.choice(names)
    directory = rng.choice(directories)

    # Add randomness to names
    suffix = rng.randint(1, 9999)
    variant = rng.choice(["", "_v2", "_final", "_draft", "_backup", "_old", "_new", ""])
    name = f"{name_base}{variant}_{suffix}.{ext}"
    path = f"{directory}/{name}"

    # Random size within range
    size = rng.randint(min_size, max_size)

    # Random modification time (within 60 days before base timestamp)
    mtime_offset = rng.randint(0, 60 * 24 * 60 * 60)
    mtime = (base_timestamp // 1000) - mtime_offset

    # Random inode
    inode = rng.randint(1_000_000, 99_999_999)

    return (path, name, directory, size, mtime, inode, "file")


def timestamp_to_folder_name(timestamp_ms: int) -> str:
    """Convert timestamp to folder name format: YYYY-MM-DD-HHMMSS."""
    dt = datetime.fromtimestamp(timestamp_ms / 1000)
    return dt.strftime("%Y-%m-%d-%H%M%S")


def generate_snapshot(
    conn: sqlite3.Connection,
    job: dict,
    snapshot_index: int,
    timestamp: int,
    rng: random.Random,
    total_snapshots: int,
) -> int:
    """Generate a single snapshot with files."""
    job_id = job["id"]

    # Use folder name format that SnapshotService can discover
    folder_name = timestamp_to_folder_name(timestamp)

    # The dest_path will be mock-data/<job-id>/ and folder is <YYYY-MM-DD-HHMMSS>
    # root_path in SQLite stores the full path to the snapshot folder
    job_dest_path = MOCK_DATA_DIR / job_id
    snapshot_folder_path = job_dest_path / folder_name
    root_path = str(snapshot_folder_path.resolve())

    # Growth factor (files accumulate over time)
    growth_factor = 1.0 + (snapshot_index / total_snapshots) * 0.5

    min_files, max_files = job["files_per_snapshot"]
    base_files = rng.randint(min_files, max_files)
    num_files = int(base_files * growth_factor)

    # Insert snapshot
    cursor = conn.execute(
        "INSERT INTO snapshots (job_id, timestamp, root_path, file_count, total_size) VALUES (?, ?, ?, 0, 0)",
        (job_id, timestamp, root_path)
    )
    snapshot_id = cursor.lastrowid

    # Generate files in batches (larger = faster)
    batch_size = 50_000
    files_data = []
    total_size = 0

    templates = job["templates"]
    directories = job["directories"]

    for i in range(num_files):
        file_data = generate_file(templates, directories, timestamp, rng)
        path, name, parent_path, size, mtime, inode, file_type = file_data

        # Prepend root path
        full_path = f"{root_path}/{path}"

        files_data.append((snapshot_id, full_path, name, parent_path, size, mtime, inode, file_type))
        total_size += size

        # Insert batch
        if len(files_data) >= batch_size:
            conn.executemany(
                "INSERT INTO files (snapshot_id, path, name, parent_path, size, mtime, inode, file_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                files_data
            )
            files_data = []

    # Insert remaining files
    if files_data:
        conn.executemany(
            "INSERT INTO files (snapshot_id, path, name, parent_path, size, mtime, inode, file_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            files_data
        )

    # Also insert directories
    dir_data = []
    for directory in directories:
        dir_name = directory.rsplit("/", 1)[-1] if "/" in directory else directory
        parent = directory.rsplit("/", 1)[0] if "/" in directory else ""
        dir_data.append((snapshot_id, f"{root_path}/{directory}", dir_name, parent, 0, timestamp // 1000, None, "dir"))

    conn.executemany(
        "INSERT INTO files (snapshot_id, path, name, parent_path, size, mtime, inode, file_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        dir_data
    )

    # Update snapshot stats
    conn.execute(
        "UPDATE snapshots SET file_count = ?, total_size = ? WHERE id = ?",
        (num_files + len(directories), total_size, snapshot_id)
    )

    # Track snapshot data for jobs.json with CUMULATIVE sizes for realistic "data added"
    if job_id not in GENERATED_SNAPSHOTS:
        GENERATED_SNAPSHOTS[job_id] = []

    if job_id not in CUMULATIVE_SIZES:
        # Starting size: Documents ~50GB, Media ~200GB
        base_size = 50_000_000_000 if "documents" in job_id else 200_000_000_000
        CUMULATIVE_SIZES[job_id] = base_size

    # Calculate realistic weekly growth:
    # Documents: ~0.5-2GB per week (light work)
    # Media: ~2-8GB per week (occasional video imports, photo shoots)
    if "documents" in job_id:
        base_growth = rng.randint(500_000_000, 2_000_000_000)  # 0.5-2 GB
    else:
        base_growth = rng.randint(2_000_000_000, 8_000_000_000)  # 2-8 GB

    # Add occasional spikes (large imports, new projects) and quiet periods
    spike_chance = rng.random()
    if spike_chance > 0.92:  # 8% chance of big spike (new project, batch import)
        spike_multiplier = rng.uniform(3.0, 8.0)  # 3-8x normal growth
        base_growth = int(base_growth * spike_multiplier)
    elif spike_chance > 0.85:  # 7% chance of moderate spike
        spike_multiplier = rng.uniform(1.5, 2.5)
        base_growth = int(base_growth * spike_multiplier)
    elif spike_chance < 0.15:  # 15% chance of very small change (quiet week)
        base_growth = int(base_growth * rng.uniform(0.1, 0.3))

    # Update cumulative size
    CUMULATIVE_SIZES[job_id] += base_growth
    cumulative_size = CUMULATIVE_SIZES[job_id]

    # Changes count correlates with data added
    changes_count = int((base_growth / 1_000_000) * rng.uniform(0.8, 1.2))  # ~1 change per MB
    changes_count = max(50, min(changes_count, 50000))  # Clamp to reasonable range

    GENERATED_SNAPSHOTS[job_id].append({
        "id": str(timestamp),
        "timestamp": timestamp,
        "sizeBytes": cumulative_size,  # CUMULATIVE for proper "data added" charts
        "fileCount": num_files + len(directories),
        "changesCount": changes_count,
        "status": "Complete",
        "path": root_path,
    })

    return num_files


def create_snapshot_folders():
    """Create empty dated folders for SnapshotService to discover."""
    print("\nCreating snapshot folders...")

    for job_id, snapshots in GENERATED_SNAPSHOTS.items():
        job_dest_path = MOCK_DATA_DIR / job_id
        job_dest_path.mkdir(parents=True, exist_ok=True)

        for snapshot in snapshots:
            folder_name = timestamp_to_folder_name(snapshot["timestamp"])
            folder_path = job_dest_path / folder_name
            folder_path.mkdir(exist_ok=True)

        print(f"  Created {len(snapshots)} folders for {job_id}")


def generate_jobs_json():
    """Generate jobs.json for the app with populated snapshots."""
    import json

    jobs_data = []
    now_ms = int(datetime.now().timestamp() * 1000)

    for job in JOBS:
        job_id = job["id"]

        # destPath points to the mock-data/<job-id>/ folder (absolute path)
        dest_path = str((MOCK_DATA_DIR / job_id).resolve())

        # Get snapshots for this job (sorted newest first)
        snapshots = GENERATED_SNAPSHOTS.get(job_id, [])
        snapshots_sorted = sorted(snapshots, key=lambda s: s["timestamp"], reverse=True)

        # Get last run from most recent snapshot
        last_run = snapshots_sorted[0]["timestamp"] if snapshots_sorted else now_ms

        jobs_data.append({
            "id": job_id,
            "name": job["name"],
            "sourcePath": job["source_path"],
            "destPath": dest_path,
            "mode": "TIME_MACHINE",
            "status": "SUCCESS",
            "destinationType": "LOCAL",
            "scheduleInterval": 1440 if "documents" in job_id else 10080,
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
            "snapshots": snapshots_sorted
        })

    with open(JOBS_JSON_PATH, "w") as f:
        json.dump(jobs_data, f, indent=2)

    print(f"Generated {JOBS_JSON_PATH}")
    for job in jobs_data:
        print(f"  {job['id']}: {len(job['snapshots'])} snapshots")


def main():
    global GENERATED_SNAPSHOTS, CUMULATIVE_SIZES

    print("=" * 60)
    print("Amber Mock Data Generator (Fast Mode)")
    print("=" * 60)

    # Reset global state
    GENERATED_SNAPSHOTS = {}
    CUMULATIVE_SIZES = {}

    # Create mock-data directory
    MOCK_DATA_DIR.mkdir(exist_ok=True)

    # Remove old database and folders
    if DB_PATH.exists():
        print(f"Removing old database: {DB_PATH}")
        DB_PATH.unlink()

    # Remove old job folders
    for job in JOBS:
        job_folder = MOCK_DATA_DIR / job["id"]
        if job_folder.exists():
            import shutil
            shutil.rmtree(job_folder)

    # Create database
    print(f"Creating database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)

    # Aggressive optimizations for bulk inserts
    conn.execute("PRAGMA journal_mode = OFF")  # Fastest, no rollback
    conn.execute("PRAGMA synchronous = OFF")   # Fastest, risk on crash
    conn.execute("PRAGMA cache_size = -256000")  # 256MB cache
    conn.execute("PRAGMA temp_store = MEMORY")
    conn.execute("PRAGMA locking_mode = EXCLUSIVE")
    conn.execute("PRAGMA mmap_size = 268435456")  # 256MB mmap

    # Create schema (without indexes/FTS - added later)
    print("Creating schema...")
    create_schema(conn)

    # Initialize RNG with fixed seed for reproducibility
    rng = random.Random(42)

    # Time range: 2 years ago to now
    now = datetime.now()
    two_years_ago = now - timedelta(days=730)

    total_files = 0
    total_snapshots = 0
    start_time = time.time()

    # Single transaction for ALL inserts (much faster)
    conn.execute("BEGIN TRANSACTION")

    for job in JOBS:
        job_id = job["id"]
        num_snapshots = job["num_snapshots"]

        print(f"\nGenerating job: {job['name']}")
        print(f"  Snapshots: {num_snapshots}")

        # Calculate timestamps (evenly distributed)
        time_range = (now - two_years_ago).total_seconds() * 1000
        interval = time_range / num_snapshots

        job_files = 0

        for i in range(num_snapshots):
            timestamp = int((two_years_ago.timestamp() * 1000) + (interval * i))

            num_files = generate_snapshot(conn, job, i, timestamp, rng, num_snapshots)

            job_files += num_files
            total_snapshots += 1

            # Progress every 5 snapshots
            if (i + 1) % 5 == 0 or i == num_snapshots - 1:
                progress = (i + 1) / num_snapshots * 100
                elapsed = time.time() - start_time
                print(f"  [{progress:5.1f}%] Snapshot {i+1}/{num_snapshots}: {job_files:,} files (elapsed: {elapsed:.1f}s)")

        print(f"  Total files for {job['name']}: {job_files:,}")
        total_files += job_files

    # Commit all data
    print("\nCommitting data...")
    conn.commit()

    # Now create indexes and FTS (after all inserts)
    create_indexes_and_fts(conn)

    # Final optimization
    print("Optimizing database...")
    conn.execute("PRAGMA optimize")
    conn.close()

    # Create snapshot folders for SnapshotService discovery
    create_snapshot_folders()

    # Generate jobs.json with populated snapshots
    generate_jobs_json()

    # Stats
    elapsed = time.time() - start_time
    db_size = DB_PATH.stat().st_size / (1024 * 1024)

    print("\n" + "=" * 60)
    print("Generation Complete!")
    print("=" * 60)
    print(f"  Total snapshots: {total_snapshots}")
    print(f"  Total files: {total_files:,}")
    print(f"  Database size: {db_size:.1f} MB")
    print(f"  Time elapsed: {elapsed:.1f} seconds")
    print(f"\nOutput files:")
    print(f"  {DB_PATH}")
    print(f"  {JOBS_JSON_PATH}")
    print("\nTo use: Press Cmd+Shift+D in the app and click 'Seed Mock Data'")


if __name__ == "__main__":
    main()
