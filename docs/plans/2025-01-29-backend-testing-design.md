# TIM-222: Rigorous Backend Testing System

## Problem

Amber Sync handles critical backup operations where bugs could destroy user data. Current test coverage is minimal (path validation, security). We need a comprehensive testing system following industry best practices.

## Goals

1. **Data integrity** - Ensure backups are complete and restores work perfectly
2. **Destructive operation safety** - Prevent accidental deletion or overwrites
3. **rsync integration** - Verify edge cases (permissions, symlinks, unicode)
4. **Time Machine reliability** - Restore, compare, and browse history flawlessly

---

## Design

### Test Architecture

Three-layer testing pyramid:

```
         /\
        /  \     E2E Tests (real rsync, real filesystem)
       / 10 \    - Slow (~seconds), run on CI and pre-release
      /------\
     /        \  Integration Tests (real filesystem, mocked rsync)
    /    30    \ - Medium speed (~ms), run frequently
   /------------\
  /              \ Unit Tests (pure logic, no I/O)
 /       60       \ - Fast (<1ms), run on every change
/------------------\
```

### Directory Structure

```
src-tauri/
├── tests/
│   ├── common/
│   │   └── mod.rs           # Test utilities & helpers
│   ├── fixtures/            # Static test data
│   │   ├── simple_backup/   # Basic file structure
│   │   ├── complex_backup/  # Nested, symlinks, unicode
│   │   └── edge_cases/      # Empty dirs, special chars
│   ├── unit/                # Pure logic tests
│   ├── integration/         # Service integration tests
│   └── e2e/                 # Full backup/restore cycles
├── src/
│   └── services/
│       └── *_service.rs     # Inline #[cfg(test)] unit tests
```

### Dependencies

Add to `Cargo.toml` under `[dev-dependencies]`:

```toml
rstest = "0.18"          # Parameterized tests and fixtures
tempfile = "3.10"        # Temporary directories
assert_fs = "1.1"        # Filesystem assertions
predicates = "3.1"       # Flexible assertions
mockall = "0.12"         # Mocking traits
proptest = "1.4"         # Property-based testing
```

---

## Test Utilities Module

`tests/common/mod.rs` - Shared helpers:

```rust
/// Creates a temporary backup environment with source and dest directories
pub struct TestBackupEnv {
    pub temp_dir: TempDir,
    pub source_path: PathBuf,
    pub dest_path: PathBuf,
}

impl TestBackupEnv {
    pub fn new() -> Self;
    pub fn with_fixture(fixture_name: &str) -> Self;
    pub fn with_random_files(count: usize, max_size: usize) -> Self;
}

/// Verification utilities
pub mod verify {
    pub fn compare_directories(a: &Path, b: &Path) -> DiffResult;
    pub fn verify_backup_integrity(source: &Path, backup: &Path) -> Result<()>;
    pub fn verify_manifest_consistency(manifest: &Path, snapshots: &Path) -> Result<()>;
}

/// File generation for testing
pub mod generate {
    pub fn file(path: &Path, content: &[u8], mode: u32);
    pub fn nested_dirs(root: &Path, depth: usize, files_per_dir: usize);
    pub fn unicode_files(root: &Path, count: usize);
    pub fn symlinks(root: &Path, valid: usize, broken: usize);
}
```

---

## Test Cases

### rsync_service (Critical - Backup Engine)

| Test Case | Type | What It Verifies |
|-----------|------|------------------|
| `backup_creates_exact_copy` | E2E | Source and dest are byte-identical |
| `backup_preserves_permissions` | E2E | File modes, ownership preserved |
| `backup_handles_symlinks` | E2E | Symlinks copied correctly, not followed |
| `backup_handles_unicode_filenames` | E2E | émojis, 中文, spaces work |
| `backup_resumes_after_interrupt` | E2E | Partial backup can be completed |
| `backup_excludes_patterns` | Integration | Exclude rules work |
| `backup_fails_on_invalid_source` | Unit | Non-existent source returns error |
| `backup_fails_on_invalid_dest` | Unit | Read-only dest returns clear error |
| `rsync_flags_are_safe` | Unit | No dangerous flags allowed |

### snapshot_service (Critical - Prevents Deletion)

| Test Case | Type | What It Verifies |
|-----------|------|------------------|
| `delete_requires_manifest_match` | Integration | Can't delete without ownership proof |
| `delete_refuses_outside_dest` | Unit | Path traversal attacks blocked |
| `list_returns_chronological_order` | Unit | Snapshots sorted correctly |
| `create_snapshot_atomic` | E2E | Incomplete snapshots cleaned up |

### manifest_service (Critical - Source of Truth)

| Test Case | Type | What It Verifies |
|-----------|------|------------------|
| `manifest_survives_corruption` | Integration | Backup exists, can recover |
| `manifest_write_is_atomic` | E2E | Crash during write safe |
| `manifest_validates_on_load` | Unit | Malformed JSON rejected |

### restore_service (Critical - Data Recovery)

| Test Case | Type | What It Verifies |
|-----------|------|------------------|
| `restore_single_file_exact` | E2E | Byte-identical restoration |
| `restore_directory_recursive` | E2E | All nested content restored |
| `restore_preserves_timestamps` | E2E | mtime/atime preserved |
| `restore_to_different_location` | E2E | Arbitrary target path works |
| `restore_handles_existing_files` | E2E | Overwrites correctly |
| `restore_fails_gracefully_on_missing` | Integration | Clear error if snapshot gone |
| `restore_from_any_snapshot` | E2E | Oldest, newest, middle all work |
| `partial_restore_works` | E2E | Subset restoration works |

### compare_snapshots (TIM-221)

| Test Case | Type | What It Verifies |
|-----------|------|------------------|
| `compare_detects_added_files` | Integration | New files identified |
| `compare_detects_deleted_files` | Integration | Missing files identified |
| `compare_detects_modified_files` | Integration | Size changes detected |
| `compare_handles_empty_snapshots` | Unit | Empty vs populated works |
| `compare_handles_identical_snapshots` | Unit | Returns empty diff |
| `compare_respects_limit` | Unit | Large diffs truncated |
| `compare_size_delta_correct` | Unit | Math is accurate |

### index_service (History Browsing)

| Test Case | Type | What It Verifies |
|-----------|------|------------------|
| `browse_any_snapshot_instantly` | Integration | Queries return <50ms |
| `search_finds_file_across_history` | Integration | Global search works |
| `file_exists_at_timestamp` | Integration | Point-in-time queries |
| `directory_listing_matches_reality` | E2E | Index matches filesystem |
| `index_rebuilds_from_filesystem` | E2E | Corrupted index recoverable |

### Full E2E Scenario

```rust
#[test]
fn full_time_machine_workflow() {
    // 1. Create initial backup
    // 2. Modify source (add, delete, change files)
    // 3. Create second backup
    // 4. Verify compare shows correct diff
    // 5. Restore deleted file from first snapshot
    // 6. Verify restored file is identical to original
    // 7. Browse history, confirm all snapshots accessible
}
```

---

## Property-Based Testing

```rust
proptest! {
    #[test]
    fn backup_restore_roundtrip(
        files in arbitrary_file_tree(1..100, 0..10_000)
    ) {
        let env = TestBackupEnv::with_generated_files(files);
        run_backup(&env.source, &env.dest);
        let restored = env.temp_dir.path().join("restored");
        run_restore(&env.dest, &restored);
        assert!(verify::compare_directories(&env.source, &restored).is_identical());
    }

    #[test]
    fn job_id_validation(id in ".*") {
        let result = validate_job_id(&id);
        assert_eq!(result.is_ok(), is_valid_job_id_format(&id));
    }

    #[test]
    fn unicode_paths_handled(name in "[\\w\\s\\p{Emoji}]{1,50}") {
        let env = TestBackupEnv::new();
        generate::file(&env.source.join(&name), b"test", 0o644);
        assert!(run_backup(&env.source, &env.dest).is_ok());
    }
}
```

---

## CI Integration

### Cargo.toml Test Configuration

```toml
[profile.test]
opt-level = 0  # Fast compilation

[[test]]
name = "e2e"
path = "tests/e2e/mod.rs"

[[test]]
name = "integration"
path = "tests/integration/mod.rs"
```

### Test Commands

```bash
cargo test                    # Unit + fast integration (< 10 sec)
cargo test --test integration # Integration only
cargo test --test e2e         # E2E only (slower, real rsync)
cargo test --all              # Everything including proptest
```

### CI Workflow

- **PR**: Unit + integration tests (~30 sec)
- **Main**: Full suite including E2E (~2 min)
- **Nightly**: Property tests with 10x iterations

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src-tauri/Cargo.toml` | Add dev-dependencies |
| `src-tauri/tests/common/mod.rs` | **NEW** - Test utilities |
| `src-tauri/tests/common/verify.rs` | **NEW** - Verification helpers |
| `src-tauri/tests/common/generate.rs` | **NEW** - File generation |
| `src-tauri/tests/fixtures/` | **NEW** - Static test data |
| `src-tauri/tests/unit/mod.rs` | **NEW** - Unit test entry |
| `src-tauri/tests/integration/mod.rs` | **NEW** - Integration tests |
| `src-tauri/tests/e2e/mod.rs` | **NEW** - E2E tests |
| `.github/workflows/test.yml` | Update CI workflow |

## Out of Scope

- Frontend testing (separate ticket)
- Performance regression testing (separate ticket)
- Fuzzing with AFL/libFuzzer (future enhancement)
