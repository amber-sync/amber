# Future: Destination-Based SQLite Index Architecture

This document captures learnings from the attempt to implement destination-centric SQLite indexing for the file browser. The implementation was reverted but this knowledge should guide future attempts.

## What Was Attempted

### Goal
Store all backup metadata on the destination drive at `<dest>/.amber-meta/`:
- `manifest.json` - Snapshot metadata (timestamp, file counts, sizes)
- `index.db` - SQLite FTS5 database for fast file search/browsing
- `job.json` - Job configuration (for drive portability)

### Architecture
1. **After each rsync backup**: Build/update SQLite index by scanning snapshot folder
2. **FileBrowser**: Query SQLite instead of filesystem for fast directory listing
3. **Search**: Use FTS5 full-text search for instant file finding

### Tickets Implemented (now on `archive/destination-centric-attempt` branch)
- TIM-112: Destination-based index storage foundation
- TIM-113: Migration script for existing data
- TIM-125-130: Destination-centric architecture refinements

## Why It Broke

### Root Cause: Path Handling Mismatch

SQLite stores **relative paths** (e.g., `"Projects/webapp/src/App.tsx"`).
FileBrowser expects **absolute paths** for navigation.

The bug manifested as: clicking folders in FileBrowser didn't navigate into them.

### The Path Flow Problem

```
SQLite stores:     "Projects/webapp"  (relative)
FileBrowser needs: "/Volumes/Backup/2024-12-03-120000/Projects/webapp" (absolute)
```

When user clicks a folder:
1. `handleEntryClick(entry)` called with `entry.path`
2. `setCurrentPath(entry.path)` updates state
3. `loadDirectory(currentPath)` fetches children
4. SQLite query uses `currentPath` as parent filter

**The bug**: `entry.path` was relative but `setCurrentPath` expected absolute.

### Failed Fix Attempts
We tried prepending `initialPath` to convert relative→absolute:
```typescript
path: `${initialPath}/${item.path}`  // Line 114, 183
```

This still failed because:
1. The `loadDirectory` function converted absolute back to relative for SQL
2. But path comparison logic throughout the component assumed absolute paths
3. Breadcrumbs, navigation up, preview selection all used inconsistent path formats

## Correct Implementation (For Future)

### Approach 1: Consistent Absolute Paths Throughout

Store absolute paths in SQLite:
```sql
-- Instead of
INSERT INTO files (path, ...) VALUES ('Projects/webapp', ...);

-- Store
INSERT INTO files (path, ...) VALUES ('/Volumes/Backup/2024-12-03/Projects/webapp', ...);
```

**Pros**: FileBrowser code doesn't change, paths are consistent
**Cons**: Index tied to mount point, breaks if drive mounts at different path

### Approach 2: Path Normalization Layer (Recommended)

Create a dedicated path handling module:

```typescript
// src/utils/pathNormalizer.ts
export class SnapshotPathContext {
  constructor(
    readonly snapshotRoot: string,  // "/Volumes/Backup/2024-12-03-120000"
    readonly sourceRoot: string      // Original source path for reference
  ) {}

  // SQLite path → UI path
  toAbsolute(relativePath: string): string {
    return `${this.snapshotRoot}/${relativePath}`;
  }

  // UI path → SQLite path
  toRelative(absolutePath: string): string {
    return absolutePath.replace(`${this.snapshotRoot}/`, '');
  }

  // For SQL WHERE clause
  getParentFilter(absolutePath: string): string {
    if (absolutePath === this.snapshotRoot) {
      return '';  // Root level
    }
    return this.toRelative(absolutePath);
  }
}
```

Then in FileBrowser:
```typescript
const pathCtx = new SnapshotPathContext(snapshotPath, job.sourcePath);

// When loading directory
const relativePath = pathCtx.getParentFilter(currentPath);
const results = await api.getDirectoryFromIndex(relativePath);

// When mapping results
const formatted = results.map(item => ({
  ...item,
  path: pathCtx.toAbsolute(item.path),  // Always absolute for UI
}));
```

### Approach 3: Dual Path Storage

Store both in the entry object:
```typescript
interface FileEntry {
  name: string;
  absolutePath: string;  // For UI, navigation
  relativePath: string;  // For SQL queries
  isDirectory: boolean;
  size: number;
  modified: Date;
}
```

## Testing Requirements

Before merging any indexed browsing implementation:

1. **Navigation test**: Click through 3+ levels of nested folders
2. **Back navigation**: Use breadcrumbs and "up" button
3. **Search then navigate**: Search for file, click containing folder
4. **Preview**: Select file, verify preview shows correct content
5. **Path display**: Verify breadcrumbs show correct path at all times

## Reference Implementation

The broken implementation is preserved on branch `archive/destination-centric-attempt`.

Key files to examine:
- `src/components/FileBrowser.tsx` - Path handling attempt
- `src/api/index.ts` - Destination-based API methods
- `src-tauri/src/commands/snapshots.rs` - Rust index queries
- `src-tauri/src/services/index_service.rs` - SQLite operations
- `scripts/generate-mock-data.py` - Index generation logic

## Summary

The destination-centric architecture is sound, but the FileBrowser path handling needs a proper abstraction layer. Don't mix relative and absolute paths in the same data structures - pick one and convert at system boundaries.
