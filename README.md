# Amber

<div align="center">
  <img src="public/logo.svg" alt="Amber Logo" width="120" height="120">
  <h3>Amber Backup</h3>
  <p><strong>Professional, Time Machine-style backups for macOS</strong></p>
</div>

---

**Amber** is a modern, native macOS application that brings enterprise-grade `rsync` backups to a beautiful, user-friendly interface. Create incremental, Time Machine-style snapshots that save disk space while keeping every historical version accessible.

## Features

- **Time Machine Mode** - Versioned snapshots using hard links (`--link-dest`). Only changed files take up space.
- **Smart Rotation** - Automatically prunes old backups (keep dailies for a month, weeklies for a year).
- **Native Performance** - Built with Tauri and Rust for blazing fast file operations.
- **Beautiful UI** - Clean, dark-mode ready interface built with React and Tailwind CSS.
- **Secure SSH** - Seamlessly handles SSH keys for remote server backups.
- **Snapshot Browser** - Browse historical file versions directly within the app.
- **Live Terminal** - Watch raw `rsync` output in real-time.

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS, Vite |
| Backend | Tauri v2, Rust |
| Core Engine | `rsync` for data transfer |

## Quick Start

### Prerequisites

- Node.js 18+
- Rust (install via [rustup](https://rustup.rs/))
- Xcode Command Line Tools

### Development

```bash
# Clone and install
git clone https://github.com/florianmahner/amber-sync.git
cd amber

# Install dependencies
npm install

# Start development (launches Tauri + Vite)
npm run dev
```

### Build

```bash
# Build production app
npm run build
```

## Project Structure

```
amber/
├── src/
│   ├── frontend/      # React frontend
│   └── backend/       # Rust/Tauri backend
├── tests/             # Test files and fixtures
├── scripts/           # Build utilities
├── docs/              # Documentation
└── public/            # Static assets
```

## Usage

1. **Create a Job** - Define your source (e.g., `user@server:/var/www`) and destination.
2. **Choose Strategy**:
   - **Mirror** - Exact replica
   - **Time Machine** - Versioned snapshots with history
3. **Run** - Click "Sync Now" to start backup.
4. **Browse** - Explore file versions from any snapshot.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development mode |
| `npm run build` | Build production app |
| `npm run test` | Run frontend tests |
| `npm run test:rust` | Run Rust tests |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier |

## License

MIT © Florian P. Mahner
