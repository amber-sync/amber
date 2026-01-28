# TIM-220: Import Backup Feature

## Problem
User with backups on external SSD and fresh Amber install cannot recover their jobs. Backend commands exist (`scan_for_backups`, `import_backup_as_job`) but no UI exposes them.

## Solution
Add "Import Backup" flow to scan volumes for orphan backups and import them as jobs.

---

## Implementation Plan

### Step 1: Add Import Button to Dashboard
**File:** `src/features/dashboard/DashboardPage.tsx`

Add "Import Backup" button next to "New Job" button that opens ImportBackupModal.

### Step 2: Create ImportBackupModal Component
**File:** `src/features/dashboard/components/ImportBackupModal.tsx`

Modal with 3 states:
1. **Scanning** - Shows spinner while scanning volumes
2. **Results** - Lists discovered backups with metadata (name, snapshots, size, last backup date)
3. **Import** - Confirmation with path editing before import

### Step 3: Create useImportBackup Hook
**File:** `src/features/dashboard/hooks/useImportBackup.ts`

Hook that wraps the API calls:
- `scanForBackups()` - Scans all mounted volumes
- `importBackup(path)` - Imports selected backup as job

### Step 4: Wire Up API Calls
**File:** `src/api/jobs.ts` (already exists)

Verify these exports work:
- `scanForBackups(volumePath, knownJobIds)`
- `findOrphanBackups(knownJobIds)`
- `importBackupAsJob(backupPath)`

### Step 5: Add Path Editing for Import
In ImportBackupModal, after selecting a backup:
- Show current sourcePath (may not exist)
- Allow user to update sourcePath for new machine
- destPath auto-detected from backup location

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/features/dashboard/DashboardPage.tsx` | Add import button |
| `src/features/dashboard/components/ImportBackupModal.tsx` | **NEW** |
| `src/features/dashboard/hooks/useImportBackup.ts` | **NEW** |
| `src/api/index.ts` | Verify exports |

## API Already Exists (Backend)
- `scan_for_backups` command
- `find_orphan_backups` command
- `import_backup_as_job` command

## UI Components to Use
- `Card` with modal variant
- `Button`
- `Title`, `Body`, `Caption`
- Existing modal patterns from DeleteJobModal

## Out of Scope
- Auto-discovery on mount (Option B)
- Cloud backup import
- SSH config migration
