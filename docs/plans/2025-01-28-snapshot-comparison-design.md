# TIM-221: Snapshot Comparison Feature

## Problem
The Time Machine compare panel shows high-level stats (file count diff, size diff, time elapsed) but lacks detailed file-by-file comparison. Users need to see what changed between snapshots and find specific file versions.

## Use Cases
1. **"What changed?"** - See files added/deleted/modified between two backups
2. **"Find a file version"** - Locate a specific file that existed in an older snapshot

---

## Design

### Data Model & Backend API

**New Rust command:** `compare_snapshots`

```rust
#[tauri::command]
async fn compare_snapshots(
    job_id: String,
    snapshot_a: i64,  // timestamp of first snapshot
    snapshot_b: i64,  // timestamp of second snapshot
) -> Result<SnapshotDiff, String>
```

**Return types:**

```rust
struct SnapshotDiff {
    added: Vec<DiffEntry>,      // files in B but not A
    deleted: Vec<DiffEntry>,    // files in A but not B
    modified: Vec<DiffEntry>,   // files in both but different size
    summary: DiffSummary,
}

struct DiffEntry {
    path: String,
    size_a: Option<i64>,  // size in snapshot A (None if added)
    size_b: Option<i64>,  // size in snapshot B (None if deleted)
}

struct DiffSummary {
    total_added: u32,
    total_deleted: u32,
    total_modified: u32,
    size_delta: i64,  // positive = grew, negative = shrunk
}
```

**SQL logic:** Query both snapshot indexes, use set operations to find differences. Compare by path, detect modifications by size difference.

---

### Frontend - API & Hook

**New API function in `src/api/`:**

```typescript
export async function compareSnapshots(
  jobId: string,
  timestampA: number,
  timestampB: number
): Promise<SnapshotDiff>
```

**New hook `useSnapshotDiff`:**

```typescript
function useSnapshotDiff(jobId: string, snapA: Snapshot | null, snapB: Snapshot | null) {
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!snapA || !snapB) {
      setDiff(null);
      return;
    }
    // Fetch diff from backend
  }, [jobId, snapA?.timestamp, snapB?.timestamp]);

  return { diff, isLoading, error };
}
```

**Grouping logic:** Transform flat `DiffEntry[]` into a tree structure grouped by folder for display. Computed on frontend.

---

### UI - Compare Panel

**Location:** Expand existing compare panel in `TimeMachinePage.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Added (45)  ·  Deleted (3)  ·  Modified (79)  │
│                                                 │
│  ▼ Added                                        │
│  ├─ 📁 src/components/              12 files   │
│  │    └ Button.tsx                    +2.1 KB  │
│  │    └ Modal.tsx                     +4.3 KB  │
│  ├─ 📁 src/hooks/                     8 files  │
│                                                 │
│  ▼ Deleted                                      │
│  └─ 📄 old-config.json                 -500 B  │
│                                                 │
│  ▼ Modified                                     │
│  ├─ 📁 src/features/                 34 files  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Interactions:**
- Click folder row → expand/collapse children
- Click file row → navigate to file in file browser (in appropriate snapshot)

**Color usage (minimal):**
- Section headers: `text-text-secondary`
- File paths: `text-text-tertiary`
- Size values: `Code` component, `text-text-quaternary`
- Size deltas only use semantic colors:
  - `+2.1 KB` → `var(--color-success)`
  - `-500 B` → `var(--color-error)`
- Hover: `bg-layer-2`
- Borders: `border-border-base`

---

### Error Handling & Edge Cases

**Error states:**
- Backend query fails → Inline error with retry button
- No changes → "No differences found" message

**Edge cases:**
- Same snapshot selected → Disable compare or show message
- Large diffs (10,000+ files) → Limit to 5,000 with summary note
- Missing index → "Index not available for this snapshot"

**Performance:**
- Backend computes diff lazily (only when panel open + two snapshots selected)
- Frontend caches result until selection changes
- Tree grouping computed on frontend

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src-tauri/src/commands/snapshots.rs` | Add `compare_snapshots` command |
| `src-tauri/src/services/index_service.rs` | Add diff query logic |
| `src/api/snapshots.ts` | Add `compareSnapshots` function |
| `src/features/time-machine/hooks/useSnapshotDiff.ts` | **NEW** |
| `src/features/time-machine/components/DiffTree.tsx` | **NEW** |
| `src/features/time-machine/TimeMachinePage.tsx` | Integrate diff into compare panel |
| `src/types/snapshots.ts` | Add `SnapshotDiff`, `DiffEntry` types |

## Out of Scope
- Text file diff view (line-by-line comparison)
- Export diff as report
- Comparison across different jobs
