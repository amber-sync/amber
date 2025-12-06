# Time Explorer Implementation Tickets

## Overview
These tickets implement the unified Time Explorer view as detailed in the plan at `~/.claude/plans/fluffy-singing-simon.md`.

---

## TIM-126: Add `list_snapshots_in_range` Rust Command

### Goal
Add a Rust command to filter snapshots by timestamp range for efficient date-based filtering in the Time Explorer UI.

### Files to Modify
- `src-tauri/src/services/index_service.rs` - Add `list_snapshots_in_range` method
- `src-tauri/src/commands/snapshots.rs` - Add Tauri command wrapper
- `src-tauri/src/main.rs` - Register the new command
- `src/api/index.ts` - Add TypeScript binding

### Implementation Steps

1. **Add method to IndexService** (`index_service.rs:~980`):
   ```rust
   pub fn list_snapshots_in_range(
       &self,
       job_id: &str,
       start_ms: i64,
       end_ms: i64,
   ) -> Result<Vec<IndexedSnapshot>>
   ```
   - Use existing `IndexedSnapshot` type
   - SQL: `SELECT ... FROM snapshots WHERE job_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC`
   - Reuse the same query pattern as `list_snapshots`

2. **Add Tauri command** (`snapshots.rs`):
   ```rust
   #[tauri::command]
   pub async fn list_snapshots_in_range(
       state: State<'_, AppState>,
       job_id: String,
       start_ms: i64,
       end_ms: i64,
   ) -> Result<Vec<IndexedSnapshot>>
   ```

3. **Add destination-based variant** for TIM-127 compatibility:
   ```rust
   #[tauri::command]
   pub async fn list_snapshots_in_range_on_destination(
       dest_path: String,
       job_id: String,
       start_ms: i64,
       end_ms: i64,
   ) -> Result<Vec<IndexedSnapshot>>
   ```

4. **Register in main.rs** - Add both commands to `.invoke_handler()`

5. **Add TypeScript binding** (`api/index.ts`):
   ```typescript
   listSnapshotsInRange: (jobId: string, startMs: number, endMs: number) =>
     invoke<IndexedSnapshot[]>('list_snapshots_in_range', { jobId, startMs, endMs }),

   listSnapshotsInRangeOnDestination: (destPath: string, jobId: string, startMs: number, endMs: number) =>
     invoke<IndexedSnapshot[]>('list_snapshots_in_range_on_destination', { destPath, jobId, startMs, endMs }),
   ```

### Testing
- Add unit test in `index_service.rs::tests`:
  - Create 5 snapshots with different timestamps
  - Query range that includes 3 of them
  - Verify correct count and ordering
- Manual test: Use dev tools to call the API with sample date ranges

### Performance Considerations
- The `idx_snapshots_job` index already covers `job_id`
- Consider adding compound index `(job_id, timestamp)` if queries are slow
- Benchmark with 1000+ snapshots

### Acceptance Criteria
- [ ] Rust method works with inclusive date range
- [ ] Returns empty vec for ranges with no snapshots
- [ ] Destination-based variant works
- [ ] TypeScript types match Rust types
- [ ] Unit tests pass

---

## TIM-127: Add `get_job_aggregate_stats` Rust Command

### Goal
Add a command to get aggregate statistics for a job (total snapshots, size, files, date range, success rate) for the Stats Summary panel.

### Files to Modify
- `src-tauri/src/services/index_service.rs` - Add method and types
- `src-tauri/src/commands/snapshots.rs` - Add Tauri command
- `src-tauri/src/main.rs` - Register command
- `src/api/index.ts` - Add TypeScript binding
- `src/types.ts` - Add TypeScript type

### Implementation Steps

1. **Add response type** (`index_service.rs`):
   ```rust
   #[derive(Debug, Clone, serde::Serialize)]
   #[serde(rename_all = "camelCase")]
   pub struct JobAggregateStats {
       pub total_snapshots: i64,
       pub total_size_bytes: i64,
       pub total_files: i64,
       pub first_snapshot_ms: Option<i64>,
       pub last_snapshot_ms: Option<i64>,
   }
   ```

2. **Add method to IndexService**:
   ```rust
   pub fn get_job_aggregate_stats(&self, job_id: &str) -> Result<JobAggregateStats>
   ```
   - SQL:
     ```sql
     SELECT
       COUNT(*) as total_snapshots,
       COALESCE(SUM(total_size), 0) as total_size,
       COALESCE(SUM(file_count), 0) as total_files,
       MIN(timestamp) as first_snapshot,
       MAX(timestamp) as last_snapshot
     FROM snapshots WHERE job_id = ?
     ```

3. **For success rate** - need to combine with manifest data:
   - Option A: Store status in SQLite (requires schema migration)
   - Option B: Read manifest separately (simpler, recommended for now)
   - Add optional `success_rate` field, populated by caller if manifest available

4. **Add Tauri command + destination variant**

5. **Add TypeScript type** (`types.ts`):
   ```typescript
   export interface JobAggregateStats {
     totalSnapshots: number;
     totalSizeBytes: number;
     totalFiles: number;
     firstSnapshotMs: number | null;
     lastSnapshotMs: number | null;
     successRate?: number; // 0-1, optional
   }
   ```

### Testing
- Unit test: Create snapshots, verify aggregate math
- Test empty job returns zeros
- Test single snapshot returns correct values

### Acceptance Criteria
- [ ] Returns correct totals
- [ ] Handles empty jobs gracefully
- [ ] Date range is correct
- [ ] TypeScript type is correct

---

## TIM-128: Add `get_snapshot_density` Rust Command

### Goal
Add a command to get snapshot counts grouped by time period (day/week/month) for calendar visualization with density dots.

### Files to Modify
- `src-tauri/src/services/index_service.rs` - Add method and types
- `src-tauri/src/commands/snapshots.rs` - Add Tauri command
- `src-tauri/src/main.rs` - Register command
- `src/api/index.ts` - Add TypeScript binding
- `src/types.ts` - Add TypeScript type

### Implementation Steps

1. **Add response type** (`index_service.rs`):
   ```rust
   #[derive(Debug, Clone, serde::Serialize)]
   #[serde(rename_all = "camelCase")]
   pub struct SnapshotDensity {
       pub period: String,      // "2024-01" for month, "2024-01-15" for day
       pub count: i64,          // Number of snapshots
       pub total_size: i64,     // Sum of sizes in period
   }
   ```

2. **Add method to IndexService**:
   ```rust
   pub fn get_snapshot_density(
       &self,
       job_id: &str,
       period: &str,  // "day", "week", "month", "year"
   ) -> Result<Vec<SnapshotDensity>>
   ```
   - Use SQLite `strftime()` for grouping:
     - day: `%Y-%m-%d`
     - week: `%Y-W%W`
     - month: `%Y-%m`
     - year: `%Y`
   - Note: timestamp is in milliseconds, divide by 1000 for strftime

3. **SQL Query**:
   ```sql
   SELECT
     strftime('%Y-%m', timestamp / 1000, 'unixepoch') as period,
     COUNT(*) as count,
     SUM(total_size) as total_size
   FROM snapshots
   WHERE job_id = ?
   GROUP BY period
   ORDER BY period DESC
   ```

4. **Add Tauri command + destination variant**

5. **Add TypeScript types**

### Testing
- Unit test: Create snapshots across multiple months, verify grouping
- Test each period type (day, week, month, year)
- Test empty job returns empty array

### Performance Considerations
- This query is fast even with many snapshots (just aggregates)
- Consider caching results for large datasets

### Acceptance Criteria
- [ ] Groups correctly by day/week/month/year
- [ ] Returns empty array for no snapshots
- [ ] Period format is consistent and parseable
- [ ] Destination variant works

---

## TIM-129: Create TimeExplorer.tsx Main View

### Goal
Create the main Time Explorer view component that will replace JobDetail and TimelineView.

### Files to Create
- `src/views/TimeExplorer.tsx` - Main view component
- `src/components/explorer/` - Directory for sub-components

### Files to Modify
- `src/context/AppContext.tsx` - Add TIME_EXPLORER view type
- `src/App.tsx` - Add routing to TimeExplorer

### Implementation Steps

1. **Update AppContext** - Add new view type:
   ```typescript
   type View = 'DASHBOARD' | 'DETAIL' | 'TIMELINE' | 'TIME_EXPLORER' | ...
   ```

2. **Create TimeExplorer.tsx** with basic structure:
   ```tsx
   export function TimeExplorer() {
     const { activeJobId, jobs } = useAppContext();
     const job = jobs.find(j => j.id === activeJobId);

     // Local state
     const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
     const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
     const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
     const [activePanel, setActivePanel] = useState<'edit' | 'restore' | null>(null);

     if (!job) return <div>No job selected</div>;

     return (
       <div className="flex flex-col h-full">
         {/* Header will go here */}
         {/* Action bar will go here */}
         {/* Main content grid will go here */}
       </div>
     );
   }
   ```

3. **Add placeholder sections** for:
   - TimeExplorerHeader (TIM-130)
   - ActionBar (TIM-131)
   - StatsSummary (TIM-132)
   - DateNavigator (TIM-133)
   - SnapshotList (existing, adapted)
   - FileBrowserPane (existing FileBrowser, adapted)

4. **Wire up navigation** in App.tsx:
   ```tsx
   case 'TIME_EXPLORER':
     return <TimeExplorer />;
   ```

### Testing
- Verify view renders without errors
- Verify job context is available
- Verify navigation works from Dashboard

### Acceptance Criteria
- [ ] View renders with job context
- [ ] Navigation from Dashboard works
- [ ] Local state is properly initialized
- [ ] Placeholder structure is correct

---

## TIM-130: Create TimeExplorerHeader Component

### Goal
Create the header component with back button, job name, and job switcher dropdown.

### Files to Create
- `src/components/explorer/TimeExplorerHeader.tsx`

### Implementation Steps

1. **Create component with props**:
   ```tsx
   interface TimeExplorerHeaderProps {
     job: SyncJob;
     jobs: SyncJob[];
     onJobSwitch: (jobId: string) => void;
     onBack: () => void;
   }
   ```

2. **Layout**:
   ```
   [← Back]  [Job Name ▼ dropdown]                    [⚙ Settings]
   ```

3. **Job switcher dropdown**:
   - Show current job name
   - Click opens dropdown with all jobs
   - Selecting a job calls `onJobSwitch`

4. **Styling**:
   - Use existing Panel/header patterns
   - Consistent with rest of app
   - Sticky at top

### Acceptance Criteria
- [ ] Back button navigates to Dashboard
- [ ] Job name displays correctly
- [ ] Dropdown shows all jobs
- [ ] Switching jobs updates the view

---

## TIM-131: Create ActionBar Component

### Goal
Create the action bar with Run Backup, Open Dest, Restore, and Edit buttons plus status line.

### Files to Create
- `src/components/explorer/ActionBar.tsx`

### Implementation Steps

1. **Create component with props**:
   ```tsx
   interface ActionBarProps {
     job: SyncJob;
     isRunning: boolean;
     progress?: number;
     onRunBackup: () => void;
     onStopBackup: () => void;
     onOpenDest: () => void;
     onRestore: () => void;
     onEdit: () => void;
   }
   ```

2. **Layout**:
   ```
   [▶ Run Backup]  [📂 Open Dest]  [⟲ Restore]  [✎ Edit]

   Status: Idle • Last run: 2h ago • Next: in 4h
   ```

3. **Conditional states**:
   - When running: Show progress bar, "Stop" instead of "Run"
   - When idle: Show last run time, next scheduled time

4. **Wire up actions**:
   - Run Backup: calls `context.runSync(job.id)`
   - Open Dest: calls `api.openPath(job.destPath)`
   - Restore: sets `activePanel = 'restore'`
   - Edit: sets `activePanel = 'edit'`

### Acceptance Criteria
- [ ] All buttons work correctly
- [ ] Status line shows correct info
- [ ] Progress shown when running
- [ ] Stop button works during sync

---

## TIM-132: Create StatsSummary Component

### Goal
Create the stats summary panel showing aggregate job statistics.

### Files to Create
- `src/components/explorer/StatsSummary.tsx`

### Files to Modify
- `src/hooks/useJobStats.ts` - Create hook for fetching stats

### Implementation Steps

1. **Create useJobStats hook**:
   ```typescript
   function useJobStats(jobId: string, destPath: string) {
     const [stats, setStats] = useState<JobAggregateStats | null>(null);
     const [loading, setLoading] = useState(true);

     useEffect(() => {
       api.getJobAggregateStats(destPath, jobId)
         .then(setStats)
         .finally(() => setLoading(false));
     }, [jobId, destPath]);

     return { stats, loading };
   }
   ```

2. **Create StatsSummary component**:
   ```tsx
   interface StatsSummaryProps {
     jobId: string;
     destPath: string;
   }
   ```

3. **Display layout**:
   ```
   ┌─────────────────────────────────────────┐
   │  📊 847 backups  │  💾 1.2 TB total     │
   │  ✓ 99.2% success │  ⏱ avg 4m 32s       │
   │  📅 Since Jan 2024                      │
   └─────────────────────────────────────────┘
   ```

4. **Format helpers**:
   - Use `formatBytes()` for sizes
   - Use `formatRelativeDate()` for "Since Jan 2024"
   - Calculate duration from first/last snapshot

### Testing
- Test with various data sizes
- Test loading state
- Test empty job

### Acceptance Criteria
- [ ] Shows loading state
- [ ] Displays all stats correctly
- [ ] Formats numbers/sizes nicely
- [ ] Handles empty job gracefully

---

## TIM-133: Create DateNavigator Component

### Goal
Create the date navigation component with year tabs and month grid.

### Files to Create
- `src/components/explorer/DateNavigator.tsx`
- `src/hooks/useSnapshotDensity.ts`

### Implementation Steps

1. **Create useSnapshotDensity hook**:
   ```typescript
   function useSnapshotDensity(jobId: string, destPath: string) {
     const [density, setDensity] = useState<SnapshotDensity[]>([]);

     useEffect(() => {
       api.getSnapshotDensity(destPath, jobId, 'month')
         .then(setDensity);
     }, [jobId, destPath]);

     return density;
   }
   ```

2. **Create DateNavigator component**:
   ```tsx
   interface DateNavigatorProps {
     selectedYear: number;
     selectedMonth: number | null;
     onYearChange: (year: number) => void;
     onMonthChange: (month: number | null) => void;
     density: SnapshotDensity[];
   }
   ```

3. **Layout**:
   ```
   [← 2024]  [2025 →]

   [Jan •]  [Feb]  [Mar ••]  [Apr]  [May •••]  [Jun]
   [Jul]    [Aug]  [Sep]     [Oct]  [Nov]      [Dec]
   ```
   - Dots indicate snapshot density
   - Selected month highlighted
   - Click month to filter, click again to clear

4. **Density visualization**:
   - No snapshots: no dot
   - 1-5 snapshots: • (small)
   - 6-15 snapshots: •• (medium)
   - 16+ snapshots: ••• (large)

### Testing
- Test year navigation
- Test month selection/deselection
- Test density dots display correctly

### Acceptance Criteria
- [ ] Year navigation works
- [ ] Month selection filters snapshots
- [ ] Density dots show correctly
- [ ] Clear month filter works

---

## TIM-134: Create SlidePanel Base Component

### Goal
Create a reusable slide-out panel component for Edit Job and Restore panels.

### Files to Create
- `src/components/explorer/panels/SlidePanel.tsx`

### Implementation Steps

1. **Create component**:
   ```tsx
   interface SlidePanelProps {
     isOpen: boolean;
     onClose: () => void;
     title: string;
     children: React.ReactNode;
     width?: 'sm' | 'md' | 'lg';  // 320px, 480px, 640px
   }
   ```

2. **Animation**:
   - Slide in from right: `translateX(100%)` → `translateX(0)`
   - Duration: 250ms ease-out
   - Backdrop: Semi-transparent overlay

3. **Structure**:
   ```tsx
   <div className="fixed inset-0 z-50">
     {/* Backdrop */}
     <div className="absolute inset-0 bg-black/50" onClick={onClose} />

     {/* Panel */}
     <div className="absolute right-0 top-0 bottom-0 bg-white dark:bg-stone-900 shadow-xl">
       <div className="flex items-center justify-between p-4 border-b">
         <h2>{title}</h2>
         <button onClick={onClose}>✕</button>
       </div>
       <div className="p-4 overflow-auto">
         {children}
       </div>
     </div>
   </div>
   ```

4. **Keyboard handling**:
   - ESC key closes panel
   - Focus trap inside panel

### Acceptance Criteria
- [ ] Slides in smoothly
- [ ] Backdrop closes panel
- [ ] ESC key closes panel
- [ ] Multiple widths work

---

## TIM-135: Create EditJobPanel Component

### Goal
Create the slide-out panel for editing job settings.

### Files to Create
- `src/components/explorer/panels/EditJobPanel.tsx`

### Implementation Steps

1. **Extract form logic from JobEditor.tsx**:
   - Reuse existing form state and validation
   - Simplify to essential fields only

2. **Essential fields**:
   - Job name
   - Source path (with picker)
   - Destination path (with picker)
   - Sync mode (TIME_MACHINE, MIRROR, ARCHIVE)
   - Schedule interval
   - Exclude patterns

3. **Advanced fields** (collapsible):
   - SSH settings
   - Cloud settings
   - Custom rsync flags

4. **Actions**:
   - Cancel: Close panel without saving
   - Save: Validate and persist job
   - Delete: Confirm and delete job

### Acceptance Criteria
- [ ] All essential fields editable
- [ ] Validation works
- [ ] Save persists changes
- [ ] Delete works with confirmation

---

## TIM-136: Create RestorePanel Component

### Goal
Create the slide-out panel for restoring files from snapshots.

### Files to Create
- `src/components/explorer/panels/RestorePanel.tsx`

### Implementation Steps

1. **Reuse RestoreWizard logic**:
   - Snapshot selector
   - File browser for selection
   - Target path picker

2. **Simplified flow**:
   - If snapshot already selected in main view, pre-select it
   - File browser shows selected snapshot
   - Target defaults to Desktop

3. **Actions**:
   - Restore Selected Files
   - Restore Entire Snapshot

### Acceptance Criteria
- [ ] Snapshot selection works
- [ ] File selection works
- [ ] Restore to target works
- [ ] Progress shown during restore

---

## TIM-137: Integrate and Test Time Explorer

### Goal
Final integration, testing, and cleanup.

### Tasks

1. **Wire up all components** in TimeExplorer.tsx

2. **Test full flow**:
   - Navigate to Time Explorer from Dashboard
   - Filter by date
   - Select snapshot
   - Browse files
   - Edit job
   - Run backup
   - Restore files

3. **Update Dashboard**:
   - Job cards click → Time Explorer (not JobDetail)
   - Remove redundant timeline

4. **Deprecate old views**:
   - Add deprecation comments to JobDetail.tsx
   - Add deprecation comments to TimelineView.tsx
   - Remove from navigation once stable

5. **Performance testing**:
   - Test with 100+ snapshots
   - Test with large file trees
   - Verify all queries are fast

### Acceptance Criteria
- [ ] Full flow works end-to-end
- [ ] Performance is acceptable
- [ ] No regressions in existing functionality
- [ ] Old views marked for deprecation
