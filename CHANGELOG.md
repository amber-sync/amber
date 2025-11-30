# Changelog

All notable changes to Amber Backup will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Snapshot collapsing by month/day/year in Job Detail view (TIM-40)
- Minimal, glassmorphic live activity UI with collapsible logs (TIM-41)

### Changed
- Restructured repository to Tauri standard layout (`src/` + `src-tauri/`)
- Migrated test infrastructure to Vitest (frontend) and Cargo (backend)

## [0.0.1-beta] - 2024-11-30

### Added
- Complete Tauri v2 migration from Electron
- Command palette for quick navigation (Cmd+K)
- File preview with split-view layout in file explorer
- Design system foundation with CSS variables and tokens
- Frontend API abstraction layer for Tauri IPC
- Rust backend services (rsync, snapshots, jobs, preferences, filesystem)
- High-performance Rust sidecar for filesystem scanning (65k+ files/sec)
- DMG distribution with GitHub Releases
- Centralized version management system

### Changed
- Replaced Electron with Tauri for native performance
- Universal macOS binary support (x86_64 + ARM64)

### Fixed
- Image loading with base64 encoding in file preview
- Preview theme colors for light/dark mode compatibility
- Snapshot integrity verification
- Dynamic userdata path for rclone installer

## [0.0.0-alpha] - 2024-11-01

### Added
- Initial release
- Time Machine-style incremental backups using rsync
- Mirror, Archive, and Time Machine sync modes
- Job scheduling with cron expressions
- SSH key management via system keychain
- Cloud backup support via rclone integration
- Beautiful native macOS interface
- Dark mode support
- Live terminal output for rsync operations
- Snapshot browser for historical file versions

[Unreleased]: https://github.com/florianmahner/amber-sync/compare/v0.0.1-beta...HEAD
[0.0.1-beta]: https://github.com/florianmahner/amber-sync/compare/v0.0.0-alpha...v0.0.1-beta
[0.0.0-alpha]: https://github.com/florianmahner/amber-sync/releases/tag/v0.0.0-alpha
