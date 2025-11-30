# TIM-300: Project Restructure - Clean Frontend/Backend Separation

**Priority**: Urgent
**Type**: Refactor
**Estimate**: 6 hours
**Blocks**: All future development

---

## Description

The codebase currently has mixed Electron (Node.js/TypeScript) and Tauri (Rust) code coexisting, creating confusion and maintenance burden. Now that the Rust backend is implemented, we need to:

1. **Remove deprecated Electron backend code** that has been replaced by Rust
2. **Restructure the project** with clear frontend/backend separation
3. **Clean up configuration files** and build scripts
4. **Update documentation** to reflect the new structure

---

## Current State (Problems)

```
amber/
├── electron/                    # OLD: Node.js backend (TO BE REMOVED)
│   ├── main.ts                  # Electron main process
│   ├── preload.ts               # Context bridge
│   ├── FileService.ts           # REPLACED by src-tauri/src/services/file_service.rs
│   ├── rsync-service.ts         # REPLACED by src-tauri/src/services/rsync_service.rs
│   ├── SnapshotService.ts       # REPLACED by src-tauri/src/services/snapshot_service.rs
│   ├── store.ts                 # REPLACED by src-tauri/src/services/store.rs
│   ├── preferences.ts           # REPLACED by src-tauri/src/services/store.rs
│   ├── JobScheduler.ts          # To be ported (TIM-113)
│   ├── KeychainService.ts       # To be ported (TIM-114)
│   ├── VolumeWatcher.ts         # To be ported (TIM-115)
│   └── ...
├── src/                         # Frontend React app
├── src-tauri/                   # NEW: Rust backend
├── amber-sidecar/               # OLD: Can be removed (integrated into Tauri)
├── dist-electron/               # OLD: Electron build output
├── package.json                 # Mixed Electron + Tauri scripts
└── ...
```

---

## Target State (Clean Structure)

```
amber/
├── src/                         # FRONTEND (React + TypeScript)
│   ├── api/                     # API abstraction layer
│   │   └── index.ts             # Unified API (already created)
│   ├── components/              # React components
│   ├── views/                   # Page-level components
│   ├── context/                 # React context providers
│   ├── hooks/                   # Custom React hooks
│   ├── styles/                  # CSS and design tokens
│   ├── types.ts                 # Frontend types
│   └── App.tsx                  # Root component
│
├── src-tauri/                   # BACKEND (Rust)
│   ├── src/
│   │   ├── commands/            # Tauri command handlers
│   │   ├── services/            # Business logic
│   │   ├── types/               # Rust type definitions
│   │   └── error.rs             # Error handling
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── public/                      # Static assets
├── tests/                       # Test files (update for Tauri)
├── scripts/                     # Build/dev scripts
│
├── package.json                 # Frontend dependencies only
├── tailwind.config.js
├── vite.config.mts
├── tsconfig.json
└── README.md
```

---

## Acceptance Criteria

- [ ] `electron/` directory completely removed
- [ ] `amber-sidecar/` directory removed (functionality in Tauri)
- [ ] `dist-electron/` directory removed
- [ ] All Electron-related npm packages removed from package.json
- [ ] Build scripts updated for Tauri-only workflow
- [ ] `npm run dev` starts Tauri dev server
- [ ] `npm run build` creates Tauri production build
- [ ] Frontend compiles without Electron references
- [ ] All tests updated to work with Tauri
- [ ] README updated with new project structure
- [ ] CLAUDE.md updated with new architecture

---

## Implementation Steps

### Step 1: Audit and Document What's Being Removed

Files to **DELETE**:
```
electron/                        # Entire directory
├── main.ts
├── preload.ts
├── FileService.ts
├── rsync-service.ts
├── SnapshotService.ts
├── SandboxService.ts
├── store.ts
├── preferences.ts
├── constants.ts
├── types.ts
├── JobScheduler.ts              # NOTE: Port to Rust first (TIM-113)
├── KeychainService.ts           # NOTE: Port to Rust first (TIM-114)
├── VolumeWatcher.ts             # NOTE: Port to Rust first (TIM-115)
├── RcloneService.ts             # NOTE: Port to Rust if needed
├── RcloneInstaller.ts           # NOTE: Port to Rust if needed
└── tsconfig.json

amber-sidecar/                   # Entire directory (integrated into Tauri)

dist-electron/                   # Build artifacts
dist_electron_build/             # Build artifacts
```

### Step 2: Remove Electron Dependencies from package.json

**Remove these packages**:
```json
{
  "devDependencies": {
    "electron": "REMOVE",
    "electron-builder": "REMOVE",
    "electron-log": "REMOVE",
    "@electron/rebuild": "REMOVE"
  },
  "dependencies": {
    "keytar": "REMOVE (use Tauri keychain plugin)"
  }
}
```

**Keep these** (needed for frontend):
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.x",
    "@tauri-apps/plugin-dialog": "^2.x",
    "react": "^19.x",
    "react-dom": "^19.x"
    // ... other frontend deps
  }
}
```

### Step 3: Update package.json Scripts

**Before** (mixed):
```json
{
  "scripts": {
    "dev": "vite",
    "electron:dev": "...",
    "electron:build": "...",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  }
}
```

**After** (Tauri-only):
```json
{
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "build:frontend": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint src/"
  }
}
```

### Step 4: Update Frontend to Remove Electron References

1. Update `src/electron.d.ts` → rename to `src/api/types.ts`
2. Remove `window.electronAPI` references (use `src/api/index.ts` instead)
3. Update all components to import from `@/api`

### Step 5: Update Configuration Files

**vite.config.mts** - Remove Electron plugin:
```typescript
// Remove electron-specific config
// Keep standard Vite + React config
```

**tsconfig.json** - Update paths:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "src-tauri"]
}
```

### Step 6: Update Documentation

1. **README.md** - New setup instructions
2. **CLAUDE.md** - Update architecture section
3. Remove or update:
   - DEVELOPMENT.md
   - TAURI_MIGRATION_GUIDE.md (can be archived)

### Step 7: Clean Up Miscellaneous

- Remove `build-icons.js` (use Tauri icon generation)
- Update `.gitignore` for Tauri
- Remove Electron-related GitHub Actions workflows
- Update tests for Tauri

---

## Dependencies

**Must complete BEFORE this ticket**:
- [x] TIM-100: Initialize Tauri
- [x] TIM-101-102: Rust backend structure
- [x] TIM-110-112: Port core services
- [x] TIM-116: Port store/preferences
- [x] TIM-103: Frontend API abstraction

**Should complete BEFORE** (or in parallel):
- [ ] TIM-113: Port JobScheduler to Rust
- [ ] TIM-114: Port KeychainService to Rust
- [ ] TIM-115: Port VolumeWatcher to Rust

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Run full test suite before/after |
| Missing service functionality | Medium | Audit each file before deletion |
| Build failures | Medium | Test `npm run build` incrementally |

---

## Test Plan

- [ ] `npm run dev` starts app successfully
- [ ] `npm run build` produces working DMG/app
- [ ] All existing features work:
  - [ ] Create/edit/delete jobs
  - [ ] Run rsync backup
  - [ ] View snapshots
  - [ ] File browser works
  - [ ] Preferences persist
  - [ ] Theme switching works
  - [ ] Command palette works (⌘K)
- [ ] No TypeScript errors
- [ ] No console errors in dev tools

---

## Rollback Plan

Before starting, create a git tag:
```bash
git tag pre-restructure-backup
```

If issues arise:
```bash
git checkout pre-restructure-backup
```
