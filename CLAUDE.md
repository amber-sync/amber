# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Amber Backup is a macOS desktop application for Time Machine-style incremental backups using rsync. Built with **Tauri v2 + React 19 + TypeScript**, with a Rust backend for native performance.

## Project Structure

```
amber/
├── src/               # React frontend (TypeScript, Vite, Tailwind)
│   ├── api/
│   ├── components/
│   ├── context/
│   ├── views/
│   └── __tests__/     # Frontend tests
├── src-tauri/         # Rust/Tauri backend
│   ├── src/
│   └── tests/         # Rust integration tests
├── tests/
│   └── fixtures/      # Shared rsync test fixtures
├── scripts/           # Build and utility scripts
├── docs/              # Documentation
└── public/            # Static assets
```

## Development Commands

```bash
npm run dev            # Run app in dev mode (Tauri + Vite)
npm run dev:frontend   # Run frontend only (Vite dev server)
npm run build          # Build production app
npm run build:frontend # Build frontend only
npm run test           # Run Vitest test suite
npm run test:rust      # Run Rust tests
npm run lint           # Run ESLint
npm run format         # Run Prettier
npm run typecheck      # TypeScript type checking
npm run bench:rust     # Run Rust benchmarks
npm run test:coverage  # Run tests with coverage
```

### Running Single Tests

```bash
# Frontend (Vitest)
npm test -- src/__tests__/specific.test.ts   # Run single test file
npm test -- --watch                          # Watch mode
npm test -- -t "test name pattern"           # Run tests matching pattern

# Backend (Cargo)
cd src-tauri && cargo test specific_test     # Run single Rust test
cd src-tauri && cargo test -- --nocapture    # Show println! output
```

## Architecture

### Frontend (src/)
- **React 19** with TypeScript, Vite, Tailwind CSS
- **Context API** for state: `AppContext` (jobs, navigation), `ThemeContext` (light/dark/accent)
- **Views**: Dashboard, JobDetail, JobEditor, AppSettings, RestoreWizard
- **Components**: FileBrowser (tree nav), FilePreview (split-view), Terminal (rsync output)
- **API Layer**: `src/api/index.ts` - Tauri IPC bindings

### Backend (src-tauri/)
- **Tauri v2** with Rust
- **Commands** (`src-tauri/src/commands/`):
  - `jobs.rs`: Job CRUD operations
  - `rsync.rs`: Rsync execution and control
  - `rclone.rs`: Cloud backup via rclone
  - `snapshots.rs`: Snapshot listing and restoration
  - `filesystem.rs`: File operations, directory browsing
  - `preferences.rs`: App settings
  - `manifest.rs`: Backup manifest operations
- **Services** (`src-tauri/src/services/`):
  - `rsync_service.rs`: Rsync command building and process management
  - `snapshot_service.rs`: Snapshot discovery and metadata
  - `index_service.rs`: SQLite-based file indexing with FTS5 search
  - `file_service.rs`: File I/O, base64 encoding
  - `store.rs`: JSON-based persistence
- **Types** (`src-tauri/src/types/`): Shared data structures

### Backend State Management

The backend uses Tauri's managed state for singleton services (`src-tauri/src/state.rs`):

```rust
pub struct AppState {
    pub file_service: Arc<FileService>,
    pub index_service: Arc<IndexService>,    // SQLite snapshot indexes
    pub snapshot_service: Arc<SnapshotService>,
    pub store: Arc<Store>,                   // JSON persistence
    pub data_dir: PathBuf,
}
```

Services are initialized once at app startup and shared across all commands via `tauri::State<AppState>`.

## Key Patterns

### Sync Modes
- **MIRROR**: Exact replica with deletions
- **ARCHIVE**: Copy only, no deletes
- **TIME_MACHINE**: Incremental with hard links (`--link-dest`)

### Destination Types
- **LOCAL**: Local filesystem or mounted volumes (uses rsync)
- **CLOUD**: Cloud storage via rclone (S3, Google Drive, Dropbox, etc.)

### IPC Communication
Frontend uses `@tauri-apps/api/core` to invoke Rust commands:
```typescript
import { invoke } from '@tauri-apps/api/core';
const jobs = await invoke('get_jobs');
```

### Rsync Event System
Real-time rsync output is streamed via Tauri events:
```typescript
import { api } from '../api';

// Subscribe to events
api.onRsyncLog((data) => console.log(data.message));      // Raw output lines
api.onRsyncProgress((data) => console.log(data.percentage)); // Progress %
api.onRsyncComplete((data) => console.log(data.success));    // Completion
```

Events emitted from Rust: `rsync-log`, `rsync-progress`, `rsync-complete`

### Type Definitions
- Frontend types: `src/types.ts`
- Backend types: `src-tauri/src/types/`

### Centralized File Type Constants

File types (`'dir'` / `'file'`) are defined centrally to avoid mismatches between frontend and backend:

**Rust** (`src-tauri/src/types/snapshot.rs`):
```rust
pub mod file_type {
    pub const DIR: &str = "dir";
    pub const FILE: &str = "file";

    pub fn is_dir(s: &str) -> bool {
        s == DIR
    }
}
```

**TypeScript** (`src/types.ts`):
```typescript
export const FILE_TYPE = {
  DIR: 'dir',
  FILE: 'file',
} as const;

export function isDirectory(type: string): boolean {
  return type === FILE_TYPE.DIR;
}
```

**Usage**: Always use these constants instead of string literals. To check if a node is a directory:
- Rust: `file_type::is_dir(&node.node_type)` or `file_type::DIR.to_string()`
- TypeScript: `isDirectory(item.type)` or `FILE_TYPE.DIR`

## Code Quality

- **ESLint**: Flat config with TypeScript and React support
- **Prettier**: Code formatting
- **Husky + lint-staged**: Pre-commit hooks
- **rustfmt**: Rust code formatting

## Data Storage

### Storage Locations
- **Dev mode**: `mock-data/` in project root (auto-detected when folder exists)
- **Production**: `~/Library/Application Support/amber/`

### Manifest-Based Architecture
Backup metadata is stored on the destination drive itself in `.amber-meta/`:
```
/Volumes/BackupDrive/MyBackup/
├── .amber-meta/
│   ├── manifest.json    # Backup metadata, snapshots list
│   └── index.db         # SQLite file index (optional)
├── 2024-01-15_120000/   # Snapshot folders
└── 2024-01-16_120000/
```

This allows backups to be self-describing and portable between machines.

## Testing

```bash
npm test              # Vitest (frontend)
npm run test:rust     # Cargo test (backend)
```

## Agent Workflow Protocol

### CRITICAL: Branch Workflow Rules

**NEVER commit directly to main. ALWAYS use feature branches.**

Before starting ANY ticket work:
1. **Check current branch**: `git branch --show-current`
2. **If on main**: Create a new feature branch FIRST
3. **If on wrong feature branch**: Stash, switch to main, create correct branch

```bash
# MANDATORY before ANY code changes for a ticket:
git checkout main
git pull origin main
git checkout -b feature/<TICKET-ID>-<short-description>
```

**One branch per ticket.** Do NOT mix multiple tickets on one branch unless explicitly grouped.

### Ticket Management (Linear)
- **Team Key**: `TIM` (tickets like TIM-16, TIM-37)
- **API Key**: Stored in `.env.local` as `LINEAR_API_KEY`
- **Principle**: Keep tickets small, atomic, and with clear goals.

### Linear Helper Script
```bash
./scripts/linear.sh list              # List all Todo tickets
./scripts/linear.sh view TIM-37       # View ticket details
./scripts/linear.sh done TIM-35       # Mark ticket as Done
./scripts/linear.sh create "Title" "Description"  # Create new ticket
```

### CRITICAL: Creating Tickets Before Implementation

**NEVER start implementing large features without creating detailed tickets first.**

When planning a multi-step feature or refactor:

1. **Write detailed ticket specifications** in `docs/` as markdown files
2. **Each ticket MUST include**:
   - **Goal**: One sentence describing the outcome
   - **Files to Modify**: Exact file paths
   - **Files to Create**: New files needed
   - **Implementation Steps**: Numbered, specific steps with code snippets
   - **Testing**: What tests to write, what to manually verify
   - **Acceptance Criteria**: Checkboxes for completion

3. **Create tickets in Linear** using the script before starting work
4. **Work on ONE ticket at a time** - complete it fully before moving to the next

### Ticket Specification Template

```markdown
## TIM-XXX: [Title]

### Goal
[One sentence describing the outcome]

### Files to Modify
- `path/to/file.rs` - [What changes]

### Files to Create
- `path/to/new/file.ts` - [What it does]

### Implementation Steps
1. **Step title**:
   ```rust
   // Code snippet showing what to add
   ```
   - Additional notes

### Testing
- Unit test: [Description]
- Manual test: [Description]

### Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2
```

This ensures:
- Work is resumable even after context is lost
- Clear scope prevents scope creep
- Other contributors can pick up tickets
- Progress is trackable

### Feature Implementation Cycle
1. **ALWAYS Create Branch First**: `git checkout -b feature/<TICKET-ID>-<short-description>`
2. **Verify branch before committing**: `git branch --show-current`
3. **Implement & Verify**: Write code, run tests frequently
4. **Push**: `git push -u origin feature/<TICKET-ID>-<short-description>`

### Completion & Cleanup
```bash
git checkout main
git pull origin main
git merge feature/<TICKET-ID>-<short-description>
git push origin main
git branch -d feature/<TICKET-ID>-<short-description>
git push origin --delete feature/<TICKET-ID>-<short-description>
```

### Pre-Commit Checklist
Before EVERY commit, verify:
- [ ] On correct feature branch (not main)
- [ ] Branch name matches ticket being worked on
- [ ] Tests pass (`npm test && npm run test:rust`)
- [ ] Lint passes (`npm run lint`)
