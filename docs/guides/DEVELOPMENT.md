# Development Guide

## Running the App

```bash
npm run dev          # Vite dev server only (frontend)
npm run tauri dev    # Full Tauri app with hot reload
```

## Building

```bash
npm run build        # Frontend production build
npm run tauri build  # Full app bundle (DMG on macOS)
```

Output: `src-tauri/target/release/bundle/dmg/Amber_*.dmg`

## Testing

```bash
npm test             # Frontend tests (Vitest)
npm run typecheck    # TypeScript checking
npm run lint         # ESLint

cd src-tauri
cargo test           # Rust backend tests
cargo bench          # Criterion benchmarks
```

## Project Structure

```
amber/
├── src/              # React frontend
│   ├── api/          # Tauri IPC client
│   ├── components/   # UI components
│   ├── context/      # React contexts
│   ├── features/     # Feature modules
│   ├── hooks/        # Custom hooks
│   ├── styles/       # CSS tokens
│   ├── types/        # TypeScript types
│   └── utils/        # Utilities
├── src-tauri/        # Rust backend
│   ├── src/
│   │   ├── commands/ # Tauri command handlers
│   │   ├── services/ # Business logic
│   │   ├── security/ # Path validation
│   │   ├── types/    # Rust types
│   │   └── utils/    # Utilities
│   ├── tests/        # Integration & e2e tests
│   └── benches/      # Criterion benchmarks
├── scripts/          # Build & dev scripts
├── tests/            # Frontend test fixtures
└── docs/             # Documentation
```

## Configuration

| File | Purpose |
|------|---------|
| `src-tauri/tauri.conf.json` | Tauri app config (window, bundle, permissions) |
| `vite.config.mts` | Vite build config (dev server on port 1420) |
| `tailwind.config.cjs` | Tailwind CSS theme & design tokens |
| `eslint.config.js` | Linting rules |
