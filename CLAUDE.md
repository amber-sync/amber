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
  - `snapshots.rs`: Snapshot listing and restoration
  - `filesystem.rs`: File operations, directory browsing
  - `preferences.rs`: App settings
- **Services** (`src-tauri/src/services/`):
  - `rsync_service.rs`: Rsync command building and process management
  - `snapshot_service.rs`: Snapshot discovery and metadata
  - `file_service.rs`: File I/O, base64 encoding
  - `store.rs`: JSON-based persistence
- **Types** (`src-tauri/src/types/`): Shared data structures

## Key Patterns

### Sync Modes
- **MIRROR**: Exact replica with deletions
- **ARCHIVE**: Copy only, no deletes
- **TIME_MACHINE**: Incremental with hard links (`--link-dest`)

### IPC Communication
Frontend uses `@tauri-apps/api/core` to invoke Rust commands:
```typescript
import { invoke } from '@tauri-apps/api/core';
const jobs = await invoke('get_jobs');
```

### Type Definitions
- Frontend types: `src/types.ts`
- Backend types: `src-tauri/src/types/`

## Code Quality

- **ESLint**: Flat config with TypeScript and React support
- **Prettier**: Code formatting
- **Husky + lint-staged**: Pre-commit hooks
- **rustfmt**: Rust code formatting

## Testing

```bash
npm test              # Vitest (frontend)
npm run test:rust     # Cargo test (backend)
```

## Agent Workflow Protocol

### Ticket Management (Linear)
- **Team Key**: `TIM` (tickets like TIM-16, TIM-37)
- **API Key**: Stored in `.env.local` as `LINEAR_API_KEY`
- **Principle**: Keep tickets small, atomic, and with clear goals.

### Linear Helper Script
```bash
./scripts/linear.sh list              # List all Todo tickets
./scripts/linear.sh view TIM-37       # View ticket details
./scripts/linear.sh done TIM-35       # Mark ticket as Done
```

### Feature Implementation Cycle
1. **Create Branch**: `git checkout -b feature/<TICKET-ID>-<short-description>`
2. **Implement & Verify**: Write code, run tests frequently
3. **Push**: `git push -u origin feature/<TICKET-ID>-<short-description>`

### Completion & Cleanup
```bash
git checkout main
git merge feature/<TICKET-ID>-<short-description>
git push origin main
git branch -d feature/<TICKET-ID>-<short-description>
```
