# Amber

A native backup application powered by rsync. Incremental snapshots with hard-link deduplication, scheduled jobs, visual snapshot history, and point-in-time file restore.

Built with [Tauri v2](https://v2.tauri.app) (Rust) and React.

## Features

- **Incremental snapshots** - Each backup is a full directory tree. Unchanged files are hard-linked to the previous snapshot via `--link-dest`. Only changed data is transferred.
- **Scheduled jobs** - Cron-based scheduling per job. Backups run in the background.
- **Snapshot timeline** - Browse all snapshots on a visual timeline. Navigate to any point in time.
- **File restore** - Restore individual files or directories from any snapshot.
- **Multi-job support** - Separate backup jobs with independent schedules and destinations.
- **SQLite metadata** - All snapshot and file metadata in a local SQLite database.

## Quick Start

```bash
git clone https://github.com/amber-sync/amber.git
cd amber
npm install
npm run dev
```

Requires Node.js 20+, Rust 1.77+, and rsync (included on macOS).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Tauri app with hot reload |
| `npm run build` | Build production app |
| `npm test` | Run frontend tests (Vitest) |
| `npm run test:rust` | Run Rust tests |
| `npm run typecheck` | TypeScript checking |
| `npm run lint` | ESLint |
| `npm run bench` | Run Criterion benchmarks |

## Project Structure

```
amber/
├── src/              # React frontend
│   ├── api/          # Tauri IPC client
│   ├── components/   # UI components (ui/, shared/, layout/)
│   ├── context/      # React contexts
│   ├── features/     # Feature modules (dashboard, time-machine, restore, ...)
│   ├── hooks/        # Custom hooks
│   ├── styles/       # Design tokens, typography
│   ├── types/        # TypeScript types
│   └── utils/        # Utilities
├── src-tauri/        # Rust backend
│   ├── src/
│   │   ├── commands/ # Tauri command handlers
│   │   ├── services/ # Business logic (rsync, snapshots, scheduler)
│   │   ├── security/ # Path validation
│   │   └── types/    # Rust types
│   ├── tests/        # Integration & e2e tests
│   └── benches/      # Criterion benchmarks
├── scripts/          # Build & dev scripts
├── tests/            # Frontend test fixtures
└── docs/             # Architecture, design, guides
```

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Tauri v2 |
| Backend | Rust |
| Frontend | React 19, TypeScript, Tailwind CSS |
| Sync engine | rsync |
| Database | SQLite |
| Bundler | Vite |

## License

MIT
