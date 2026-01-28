# TIM-221: Snapshot Comparison Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add detailed file-by-file comparison between two snapshots in the Time Machine compare panel.

**Architecture:** Backend Rust command computes diff via SQL set operations on snapshot indexes, returns flat list of changes. Frontend groups by folder and renders inline in existing compare panel.

**Tech Stack:** Rust/SQLite (backend), React/TypeScript (frontend), existing IndexService and UI components.

---

## Task 1: Add TypeScript Types

**Files:**
- Modify: `src/types/snapshots.ts`

**Step 1: Add diff types to snapshots.ts**

Add at end of file:

```typescript
/** TIM-221: Single file change entry in snapshot diff */
export interface DiffEntry {
  path: string;
  sizeA: number | null;  // size in snapshot A (null if added)
  sizeB: number | null;  // size in snapshot B (null if deleted)
}

/** TIM-221: Summary statistics for snapshot diff */
export interface DiffSummary {
  totalAdded: number;
  totalDeleted: number;
  totalModified: number;
  sizeDelta: number;  // positive = grew, negative = shrunk
}

/** TIM-221: Complete snapshot diff result */
export interface SnapshotDiff {
  added: DiffEntry[];
  deleted: DiffEntry[];
  modified: DiffEntry[];
  summary: DiffSummary;
}
```

**Step 2: Export types from index**

Add to `src/types/index.ts` exports:

```typescript
export type { DiffEntry, DiffSummary, SnapshotDiff } from './snapshots';
```

**Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/types/snapshots.ts src/types/index.ts
git commit -m "TIM-221: Add snapshot diff TypeScript types"
```

---

## Task 2: Add Rust Types

**Files:**
- Modify: `src-tauri/src/services/index_service.rs`

**Step 1: Add diff structs after SnapshotDensity struct (~line 142)**

```rust
/// TIM-221: Single file change entry in snapshot diff
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffEntry {
    pub path: String,
    pub size_a: Option<i64>,  // size in snapshot A (None if added)
    pub size_b: Option<i64>,  // size in snapshot B (None if deleted)
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
```

**Step 2: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: No errors

**Step 3: Commit**

```bash
git add src-tauri/src/services/index_service.rs
git commit -m "TIM-221: Add snapshot diff Rust types"
```

---

## Task 3: Implement Backend Diff Logic

**Files:**
- Modify: `src-tauri/src/services/index_service.rs`

**Step 1: Add compare_snapshots method to IndexService impl**

Add this method after `get_snapshot_density` method:

```rust
/// TIM-221: Compare two snapshots and return file differences
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

    // Get snapshot IDs
    let snapshot_a_id: i64 = conn
        .query_row(
            "SELECT id FROM snapshots WHERE job_id = ? AND timestamp = ?",
            params![job_id, timestamp_a],
            |row| row.get(0),
        )
        .map_err(|_| AmberError::Index(format!("Snapshot A not found: {}", timestamp_a)))?;

    let snapshot_b_id: i64 = conn
        .query_row(
            "SELECT id FROM snapshots WHERE job_id = ? AND timestamp = ?",
            params![job_id, timestamp_b],
            |row| row.get(0),
        )
        .map_err(|_| AmberError::Index(format!("Snapshot B not found: {}", timestamp_b)))?;

    let max_results = limit.unwrap_or(5000) as i64;

    // Files in B but not in A (added)
    let mut added: Vec<DiffEntry> = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT b.path, b.size FROM files b
             WHERE b.snapshot_id = ?
             AND b.file_type = 'file'
             AND NOT EXISTS (
                 SELECT 1 FROM files a
                 WHERE a.snapshot_id = ? AND a.path = b.path
             )
             LIMIT ?"
        ).map_err(|e| AmberError::Index(format!("Failed to prepare added query: {}", e)))?;

        let rows = stmt.query_map(params![snapshot_b_id, snapshot_a_id, max_results], |row| {
            Ok(DiffEntry {
                path: row.get(0)?,
                size_a: None,
                size_b: Some(row.get(1)?),
            })
        }).map_err(|e| AmberError::Index(format!("Failed to query added files: {}", e)))?;

        for row in rows {
            added.push(row.map_err(|e| AmberError::Index(format!("Failed to read row: {}", e)))?);
        }
    }

    // Files in A but not in B (deleted)
    let mut deleted: Vec<DiffEntry> = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT a.path, a.size FROM files a
             WHERE a.snapshot_id = ?
             AND a.file_type = 'file'
             AND NOT EXISTS (
                 SELECT 1 FROM files b
                 WHERE b.snapshot_id = ? AND b.path = a.path
             )
             LIMIT ?"
        ).map_err(|e| AmberError::Index(format!("Failed to prepare deleted query: {}", e)))?;

        let rows = stmt.query_map(params![snapshot_a_id, snapshot_b_id, max_results], |row| {
            Ok(DiffEntry {
                path: row.get(0)?,
                size_a: Some(row.get(1)?),
                size_b: None,
            })
        }).map_err(|e| AmberError::Index(format!("Failed to query deleted files: {}", e)))?;

        for row in rows {
            deleted.push(row.map_err(|e| AmberError::Index(format!("Failed to read row: {}", e)))?);
        }
    }

    // Files in both but with different size (modified)
    let mut modified: Vec<DiffEntry> = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT a.path, a.size, b.size FROM files a
             INNER JOIN files b ON a.path = b.path
             WHERE a.snapshot_id = ?
             AND b.snapshot_id = ?
             AND a.file_type = 'file'
             AND b.file_type = 'file'
             AND a.size != b.size
             LIMIT ?"
        ).map_err(|e| AmberError::Index(format!("Failed to prepare modified query: {}", e)))?;

        let rows = stmt.query_map(params![snapshot_a_id, snapshot_b_id, max_results], |row| {
            Ok(DiffEntry {
                path: row.get(0)?,
                size_a: Some(row.get(1)?),
                size_b: Some(row.get(2)?),
            })
        }).map_err(|e| AmberError::Index(format!("Failed to query modified files: {}", e)))?;

        for row in rows {
            modified.push(row.map_err(|e| AmberError::Index(format!("Failed to read row: {}", e)))?);
        }
    }

    // Calculate summary
    let size_added: i64 = added.iter().filter_map(|e| e.size_b).sum();
    let size_deleted: i64 = deleted.iter().filter_map(|e| e.size_a).sum();
    let size_modified_delta: i64 = modified.iter()
        .map(|e| e.size_b.unwrap_or(0) - e.size_a.unwrap_or(0))
        .sum();

    let summary = DiffSummary {
        total_added: added.len() as u32,
        total_deleted: deleted.len() as u32,
        total_modified: modified.len() as u32,
        size_delta: size_added - size_deleted + size_modified_delta,
    };

    Ok(SnapshotDiff {
        added,
        deleted,
        modified,
        summary,
    })
}
```

**Step 2: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: No errors

**Step 3: Commit**

```bash
git add src-tauri/src/services/index_service.rs
git commit -m "TIM-221: Implement compare_snapshots in IndexService"
```

---

## Task 4: Add Tauri Command

**Files:**
- Modify: `src-tauri/src/commands/snapshots.rs`

**Step 1: Add compare_snapshots command at end of file**

```rust
/// TIM-221: Compare two snapshots and return file differences
#[tauri::command]
pub async fn compare_snapshots(
    state: State<'_, AppState>,
    job_id: String,
    timestamp_a: i64,
    timestamp_b: i64,
    limit: Option<usize>,
) -> Result<crate::services::index_service::SnapshotDiff> {
    ensure_job_id(&job_id)?;
    let index = resolve_index(&state, &job_id, true)?;
    index.with(|idx| idx.compare_snapshots(&job_id, timestamp_a, timestamp_b, limit))
}
```

**Step 2: Register command in main.rs**

Find the `invoke_handler` in `src-tauri/src/main.rs` and add `commands::snapshots::compare_snapshots` to the list.

**Step 3: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: No errors

**Step 4: Commit**

```bash
git add src-tauri/src/commands/snapshots.rs src-tauri/src/main.rs
git commit -m "TIM-221: Add compare_snapshots Tauri command"
```

---

## Task 5: Add Frontend API Function

**Files:**
- Modify: `src/api/snapshots.ts`

**Step 1: Add import for SnapshotDiff type**

Update the import at top:

```typescript
import type {
  SyncJob,
  Snapshot,
  IndexedSnapshot,
  FileNode,
  IndexedDirEntry,
  GlobalSearchResult,
  FileTypeStats,
  LargestFile,
  JobAggregateStats,
  SnapshotDensity,
  DirectoryContents,
  SnapshotDiff,  // Add this
} from '../types';
```

**Step 2: Add compareSnapshots function at end of file**

```typescript
/**
 * TIM-221: Compare two snapshots and return file differences
 */
export async function compareSnapshots(
  jobId: string,
  timestampA: number,
  timestampB: number,
  limit?: number
): Promise<SnapshotDiff> {
  return invoke('compare_snapshots', { jobId, timestampA, timestampB, limit });
}
```

**Step 3: Export from api/index.ts**

Add to exports in `src/api/index.ts`:

```typescript
compareSnapshots: snapshots.compareSnapshots,
```

**Step 4: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/api/snapshots.ts src/api/index.ts
git commit -m "TIM-221: Add compareSnapshots API function"
```

---

## Task 6: Create useSnapshotDiff Hook

**Files:**
- Create: `src/features/time-machine/hooks/useSnapshotDiff.ts`

**Step 1: Create the hook file**

```typescript
/**
 * TIM-221: Hook for comparing two snapshots
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/api';
import type { Snapshot, SnapshotDiff } from '@/types';

interface UseSnapshotDiffResult {
  diff: SnapshotDiff | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSnapshotDiff(
  jobId: string | null,
  snapshotA: Snapshot | null,
  snapshotB: Snapshot | null
): UseSnapshotDiffResult {
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiff = useCallback(async () => {
    if (!jobId || !snapshotA || !snapshotB) {
      setDiff(null);
      return;
    }

    if (snapshotA.timestamp === snapshotB.timestamp) {
      setDiff(null);
      setError('Cannot compare snapshot with itself');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.compareSnapshots(
        jobId,
        snapshotA.timestamp,
        snapshotB.timestamp
      );
      setDiff(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDiff(null);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, snapshotA?.timestamp, snapshotB?.timestamp]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  return { diff, isLoading, error, refetch: fetchDiff };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/time-machine/hooks/useSnapshotDiff.ts
git commit -m "TIM-221: Add useSnapshotDiff hook"
```

---

## Task 7: Create DiffTree Component

**Files:**
- Create: `src/features/time-machine/components/DiffTree.tsx`

**Step 1: Create the component**

```typescript
/**
 * TIM-221: Grouped tree view of snapshot differences
 */

import React, { useState, useMemo } from 'react';
import { Icons } from '@/components/IconComponents';
import { Body, Code, Caption } from '@/components/ui';
import { formatBytes } from '@/utils';
import type { DiffEntry } from '@/types';

interface DiffTreeProps {
  added: DiffEntry[];
  deleted: DiffEntry[];
  modified: DiffEntry[];
  onFileClick?: (path: string, type: 'added' | 'deleted' | 'modified') => void;
}

interface FolderGroup {
  folder: string;
  files: DiffEntry[];
}

function groupByFolder(entries: DiffEntry[]): FolderGroup[] {
  const groups = new Map<string, DiffEntry[]>();

  for (const entry of entries) {
    const lastSlash = entry.path.lastIndexOf('/');
    const folder = lastSlash > 0 ? entry.path.slice(0, lastSlash) : '';

    if (!groups.has(folder)) {
      groups.set(folder, []);
    }
    groups.get(folder)!.push(entry);
  }

  return Array.from(groups.entries())
    .map(([folder, files]) => ({ folder: folder || '/', files }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
}

function DiffSection({
  title,
  entries,
  type,
  onFileClick,
}: {
  title: string;
  entries: DiffEntry[];
  type: 'added' | 'deleted' | 'modified';
  onFileClick?: (path: string, type: 'added' | 'deleted' | 'modified') => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const groups = useMemo(() => groupByFolder(entries), [entries]);

  if (entries.length === 0) return null;

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  return (
    <div className="border border-border-base rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-layer-2 hover:bg-layer-3 transition-colors"
      >
        <Icons.ChevronRight
          size={14}
          className={`text-text-tertiary transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        <Body size="sm" weight="medium" color="secondary">
          {title}
        </Body>
        <Caption color="tertiary">({entries.length})</Caption>
      </button>

      {expanded && (
        <div className="divide-y divide-border-base">
          {groups.map(group => (
            <div key={group.folder}>
              {/* Folder header - only show if more than one file or has subpath */}
              {(group.files.length > 1 || group.folder !== '/') && (
                <button
                  onClick={() => toggleFolder(group.folder)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-layer-2 transition-colors"
                >
                  <Icons.ChevronRight
                    size={12}
                    className={`text-text-quaternary transition-transform ml-2 ${
                      expandedFolders.has(group.folder) ? 'rotate-90' : ''
                    }`}
                  />
                  <Icons.Folder size={14} className="text-text-tertiary" />
                  <Code size="sm" className="text-text-tertiary truncate flex-1 text-left">
                    {group.folder}/
                  </Code>
                  <Caption color="quaternary">{group.files.length} files</Caption>
                </button>
              )}

              {/* Files - show if folder expanded or single file at root */}
              {(expandedFolders.has(group.folder) || group.files.length === 1 && group.folder === '/') && (
                <div>
                  {group.files.map(file => (
                    <button
                      key={file.path}
                      onClick={() => onFileClick?.(file.path, type)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-layer-2 transition-colors"
                    >
                      <Icons.File size={14} className="text-text-quaternary ml-6" />
                      <Code size="sm" className="text-text-tertiary truncate flex-1 text-left">
                        {file.path.split('/').pop()}
                      </Code>
                      <SizeDelta entry={file} type={type} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SizeDelta({
  entry,
  type,
}: {
  entry: DiffEntry;
  type: 'added' | 'deleted' | 'modified';
}) {
  if (type === 'added' && entry.sizeB != null) {
    return (
      <Code size="sm" className="text-[var(--color-success)]">
        +{formatBytes(entry.sizeB)}
      </Code>
    );
  }

  if (type === 'deleted' && entry.sizeA != null) {
    return (
      <Code size="sm" className="text-[var(--color-error)]">
        -{formatBytes(entry.sizeA)}
      </Code>
    );
  }

  if (type === 'modified' && entry.sizeA != null && entry.sizeB != null) {
    const delta = entry.sizeB - entry.sizeA;
    if (delta > 0) {
      return (
        <Code size="sm" className="text-[var(--color-success)]">
          +{formatBytes(delta)}
        </Code>
      );
    } else if (delta < 0) {
      return (
        <Code size="sm" className="text-[var(--color-error)]">
          -{formatBytes(Math.abs(delta))}
        </Code>
      );
    }
  }

  return null;
}

export function DiffTree({ added, deleted, modified, onFileClick }: DiffTreeProps) {
  const totalChanges = added.length + deleted.length + modified.length;

  if (totalChanges === 0) {
    return (
      <div className="text-center py-6">
        <Body size="sm" color="tertiary">
          No differences found
        </Body>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary line */}
      <div className="flex items-center gap-3 text-text-tertiary">
        {added.length > 0 && <Caption>Added ({added.length})</Caption>}
        {deleted.length > 0 && <Caption>Deleted ({deleted.length})</Caption>}
        {modified.length > 0 && <Caption>Modified ({modified.length})</Caption>}
      </div>

      {/* Sections */}
      <DiffSection title="Added" entries={added} type="added" onFileClick={onFileClick} />
      <DiffSection title="Deleted" entries={deleted} type="deleted" onFileClick={onFileClick} />
      <DiffSection title="Modified" entries={modified} type="modified" onFileClick={onFileClick} />
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/time-machine/components/DiffTree.tsx
git commit -m "TIM-221: Add DiffTree component"
```

---

## Task 8: Integrate into TimeMachinePage

**Files:**
- Modify: `src/features/time-machine/TimeMachinePage.tsx`

**Step 1: Add imports**

Add near top of file with other imports:

```typescript
import { useSnapshotDiff } from './hooks/useSnapshotDiff';
import { DiffTree } from './components/DiffTree';
```

**Step 2: Add hook call in component**

After existing state declarations, add:

```typescript
// TIM-221: Snapshot comparison
const { diff, isLoading: isDiffLoading, error: diffError } = useSnapshotDiff(
  activeJobId,
  selectedSnapshot,
  compareSnapshot
);
```

**Step 3: Replace "coming soon" message with DiffTree**

Find this line (~693):
```typescript
<Caption color="tertiary" className="mt-4 pt-4 border-t border-border-base block">
  Detailed file-by-file comparison coming soon...
</Caption>
```

Replace with:

```typescript
{/* TIM-221: Detailed file diff */}
<div className="mt-4 pt-4 border-t border-border-base">
  {isDiffLoading && (
    <div className="flex items-center justify-center py-4">
      <div className="w-5 h-5 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )}
  {diffError && (
    <Caption color="tertiary" className="text-center py-4">
      {diffError}
    </Caption>
  )}
  {diff && !isDiffLoading && (
    <DiffTree
      added={diff.added}
      deleted={diff.deleted}
      modified={diff.modified}
    />
  )}
</div>
```

**Step 4: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/features/time-machine/TimeMachinePage.tsx
git commit -m "TIM-221: Integrate DiffTree into compare panel"
```

---

## Task 9: Manual Testing

**Step 1: Start the app**

Run: `npm run tauri dev`

**Step 2: Test the compare feature**

1. Go to Time Machine view
2. Select a job with multiple snapshots
3. Select one snapshot
4. Enable compare mode and select a second snapshot
5. Verify the diff tree appears showing added/deleted/modified files
6. Test expanding/collapsing folders
7. Verify size deltas show correct colors (green for added, red for deleted)

**Step 3: Test edge cases**

1. Compare snapshots with no differences → should show "No differences found"
2. Compare with missing index → should show error message
3. Large diff (if available) → should load without freezing

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "TIM-221: Fix issues found during testing"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | TypeScript types | `src/types/snapshots.ts`, `src/types/index.ts` |
| 2 | Rust types | `src-tauri/src/services/index_service.rs` |
| 3 | Backend diff logic | `src-tauri/src/services/index_service.rs` |
| 4 | Tauri command | `src-tauri/src/commands/snapshots.rs`, `src-tauri/src/main.rs` |
| 5 | Frontend API | `src/api/snapshots.ts`, `src/api/index.ts` |
| 6 | React hook | `src/features/time-machine/hooks/useSnapshotDiff.ts` |
| 7 | DiffTree component | `src/features/time-machine/components/DiffTree.tsx` |
| 8 | Integration | `src/features/time-machine/TimeMachinePage.tsx` |
| 9 | Manual testing | - |
