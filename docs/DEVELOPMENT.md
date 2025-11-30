# Amber Development Guide

## Running the App

### Electron (Current)
```bash
npm run electron:dev   # Run with Electron + hot reload
npm run electron:build # Build Electron app + DMG
```

### Tauri (Migration Target)
```bash
npm run tauri:dev      # Run with Tauri + hot reload
npm run tauri:build    # Build Tauri app + DMG
```

Both versions use the same React frontend (`src/`) and Vite build.

## Migration Status

Currently migrating from Electron to Tauri. During migration:
- **Electron (`electron/`)**: Current production backend
- **Tauri (`src-tauri/`)**: New Rust backend (in progress)

Both can coexist and run independently.

## Development Workflow

### Frontend Development
```bash
npm run dev  # Vite dev server on http://localhost:3000
```

Use this for pure frontend work. Connect with either:
- `npm run electron:dev` (connects to Vite)
- `npm run tauri:dev` (connects to Vite)

### Backend Development

**Electron backend** (`electron/`):
- TypeScript files in `electron/`
- Auto-compiled on save with `electron:dev`

**Tauri backend** (`src-tauri/`):
- Rust files in `src-tauri/src/`
- Auto-recompiled with `tauri:dev`
- Manual compile: `cd src-tauri && cargo build`

## Testing

```bash
# Run test suite
npm test

# Tauri Rust tests
cd src-tauri && cargo test
```

## Project Structure

```
amber/
├── src/                  # React frontend (shared)
├── electron/             # Electron backend (current)
├── src-tauri/            # Tauri backend (new)
│   ├── src/
│   │   ├── main.rs       # Rust entry point
│   │   └── lib.rs        # Tauri app
│   ├── Cargo.toml        # Rust dependencies
│   └── tauri.conf.json   # Tauri configuration
├── dist/                 # Built frontend
├── dist-electron/        # Built Electron backend
└── target/               # Rust build artifacts
```

## Configuration

### Tauri Config
`src-tauri/tauri.conf.json`:
- Product name: Amber
- Bundle identifier: com.amber.app
- Window size: 1200x800
- Title bar: overlay (macOS)

### Vite Config
`vite.config.mts`:
- Dev server: localhost:3000
- Build output: `dist/`
- Works with both Electron and Tauri

## Building for Production

### Electron
```bash
npm run electron:build
# Output: dist_electron_build/Amber-*.dmg
```

### Tauri
```bash
npm run tauri:build
# Output: src-tauri/target/release/bundle/dmg/Amber_*.dmg
```

## Switching Between Versions

During migration, you can test both:

1. **Close the currently running app**
2. Run the other version:
   - `npm run electron:dev` for Electron
   - `npm run tauri:dev` for Tauri

Both use the same React UI, so visual appearance is identical.

## Migration Progress

See `TAURI_MIGRATION_GUIDE.md` for the full migration plan and current status.
