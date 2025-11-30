# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Amber Backup is a macOS desktop application for Time Machine-style incremental backups using rsync. Built with Electron + React + TypeScript, with a Rust sidecar for fast file scanning.

## Development Commands

```bash
npm run electron:dev          # Run app in dev mode with hot reload
npm run build                 # Build React frontend (Vite)
npm run electron:build        # Build production app + DMG
npm test                      # Run Mocha test suite
npm run build:icons           # Generate app icons from SVG
```

## Architecture

### Frontend (src/)
- **React 19** with TypeScript, Vite, Tailwind CSS
- **Context API** for state: `AppContext` (jobs, navigation), `ThemeContext` (light/dark/accent)
- **Views**: Dashboard, JobDetail, JobEditor, AppSettings, RestoreWizard
- **Components**: FileBrowser (tree nav), FilePreview (split-view), Terminal (rsync output)

### Backend (electron/)
- **main.ts**: Electron initialization, IPC handlers
- **preload.ts**: Context bridge exposing `window.electronAPI`
- **Services**:
  - `RsyncService.ts` / `rsync-service.ts`: Command building & execution
  - `SnapshotService.ts`: Snapshot management, hard-link verification
  - `JobScheduler.ts`: Cron-based scheduling via node-schedule
  - `KeychainService.ts`: SSH/cloud credentials via keytar
  - `VolumeWatcher.ts`: Monitor attached drives
  - `FileService.ts`: File I/O operations
- **Persistence**: JSON files via `store.ts` and `preferences.ts`

### Rust Sidecar (amber-sidecar/)
Fast directory scanning utility. Target: 65k+ files/sec.

## Key Patterns

### Sync Modes (electron/types.ts)
- **MIRROR**: Exact replica with deletions
- **ARCHIVE**: Copy only, no deletes
- **TIME_MACHINE**: Incremental with hard links (`--link-dest`)

### IPC Communication
Frontend calls `window.electronAPI.*` methods defined in preload.ts. All handlers are promise-based async.

### Type Definitions
- Frontend types: `src/types.ts`
- Backend types: `electron/types.ts`
- Type guards: `isRsyncProgress()`, `isBackupResult()` for runtime validation

## Testing

```bash
npm test  # Mocha + Chai + Sinon
```

Test files in `tests/`:
- `unit.test.js`: Rsync argument generation
- `integration.test.js`: Real file I/O, snapshot creation
- `integrity.test.ts`: Hard-link verification
- `scheduler.test.ts`: Job scheduling

The `sandbox/` directory contains test fixtures (source/ and dest/).

## Agent Workflow Protocol

### Ticket Management (Linear)
- **Team Key**: `TIM` (tickets like TIM-16, TIM-37)
- **API Key**: Stored in `.env.local` as `LINEAR_API_KEY`
- **Principle**: Keep tickets small, atomic, and with clear goals. If new problems arise during implementation, create a new ticket rather than expanding scope.

### Linear Helper Script
```bash
./scripts/linear.sh list              # List all Todo tickets
./scripts/linear.sh list Done         # List Done tickets
./scripts/linear.sh view TIM-37       # View ticket details
./scripts/linear.sh create "Title" "Description"
./scripts/linear.sh create-file /tmp/ticket.json  # For complex descriptions
./scripts/linear.sh update TIM-37 "New description"
./scripts/linear.sh done TIM-35       # Mark ticket as Done
```

### Feature Implementation Cycle
1. **Create Branch**: `git checkout -b feature/<TICKET-ID>-<short-description>`
   - Example: `feature/TIM-16-rehaul-website`
2. **Implement & Verify**: Write code iteratively, run tests frequently
   - **Do not push unless tests pass**
3. **Push**: `git push -u origin feature/<TICKET-ID>-<short-description>`

### Completion & Cleanup
1. **Merge to Main**:
   ```bash
   git checkout main
   git merge feature/<TICKET-ID>-<short-description>
   git push origin main
   ```
2. **Delete Branch**:
   ```bash
   git branch -d feature/<TICKET-ID>-<short-description>
   git push origin --delete feature/<TICKET-ID>-<short-description>
   ```

### Deployment (Vercel)
- **Preview**: Pushing a feature branch triggers automatic preview deployment
- **Production**: Merging to `main` triggers production deployment
- Always verify the Vercel Preview URL before merging

### CI/CD (GitHub Actions)
- Automatic DMG builds on tag push
- Universal macOS binary support (x86_64 + ARM64)
