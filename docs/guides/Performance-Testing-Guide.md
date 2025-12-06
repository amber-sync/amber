# Performance Testing Guide - Amber Backup Application

## Overview

This document describes the comprehensive performance test suite for the Amber backup application. The suite covers frontend rendering, backend database operations, IPC communication, and memory management.

---

## Test Suite Architecture

### Directory Structure

```
amber/
├── benches/                          # Rust benchmarks (Criterion)
│   ├── database_benchmarks.rs       # SQLite + FTS5 performance
│   ├── manifest_benchmarks.rs       # Manifest I/O operations
│   ├── ipc_benchmarks.rs            # Tauri IPC serialization
│   └── fts5_benchmarks.rs           # Full-text search specific
├── tests/
│   └── performance/                 # Integration performance tests
│       ├── end_to_end_benchmarks.rs
│       └── memory_benchmarks.rs
└── frontend-benchmarks/             # Frontend performance tests
    ├── render_benchmarks.tsx        # React render performance
    ├── interaction_benchmarks.tsx   # User interaction metrics
    └── memory_benchmarks.tsx        # Frontend memory profiling
```

---

## Setup Instructions

### 1. Install Dependencies

#### Rust Backend Benchmarks
```bash
# Add Criterion to Cargo.toml
[dev-dependencies]
criterion = { version = "0.5", features = ["html_reports"] }
tempfile = "3.8"

[[bench]]
name = "database_benchmarks"
harness = false

[[bench]]
name = "ipc_benchmarks"
harness = false
```

#### Frontend Benchmarks
```bash
# Install testing libraries
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm install --save-dev web-vitals vitest
```

### 2. Generate Stress Test Data

Create a script to generate the stress test database:

```bash
# Run stress test generator
npm run generate:stress-test-data
```

This creates:
- 40 snapshots
- 2,000 files per snapshot
- ~80,000 total file entries
- ~30GB simulated storage size

### 3. Configure Benchmark Settings

Create `benches/config.rs`:
```rust
pub struct BenchmarkConfig {
    pub num_snapshots: usize,
    pub files_per_snapshot: usize,
    pub sample_size: usize,
    pub measurement_time_secs: u64,
}

impl Default for BenchmarkConfig {
    fn default() -> Self {
        Self {
            num_snapshots: 40,
            files_per_snapshot: 2000,
            sample_size: 100,
            measurement_time_secs: 10,
        }
    }
}
```

---

## Running Benchmarks

### Backend Benchmarks (Rust)

```bash
# Run all benchmarks
cargo bench

# Run specific benchmark
cargo bench --bench database_benchmarks

# Run with verbose output
cargo bench -- --verbose

# Generate HTML reports
cargo bench --bench database_benchmarks -- --output-format bencher
```

Output location: `target/criterion/`

### Frontend Benchmarks (TypeScript)

```bash
# Run all frontend benchmarks
npm run benchmark:frontend

# Run specific benchmark
npm run benchmark:render

# Profile with Chrome DevTools
npm run benchmark:profile
```

### Integration Benchmarks

```bash
# End-to-end performance tests
cargo test --test end_to_end_benchmarks --release -- --nocapture

# Memory leak detection
cargo test --test memory_benchmarks --release -- --nocapture
```

---

## Benchmark Targets and Metrics

### Frontend Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Dashboard Initial Render** | < 500ms | React Profiler |
| **Snapshot Selection Re-render** | < 100ms | React Profiler |
| **TimeMachine View Load** | < 800ms | Performance API |
| **File Browser Scroll** | 60 FPS | RequestAnimationFrame |
| **Search Input** | < 50ms | Performance.now() |
| **Virtual List Frame** | < 16ms | RAF callback |

### Backend Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **List Snapshots (40)** | < 10ms | Criterion |
| **File Listing (paginated)** | < 20ms | Criterion |
| **Manifest Deserialization** | < 50ms | Criterion |
| **FTS5 Simple Search** | < 30ms | Criterion |
| **FTS5 Complex Search** | < 100ms | Criterion |
| **Database Index Seek** | < 5ms | Criterion |
| **Snapshot Diff** | < 200ms | Criterion |

### IPC Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Simple Command Round-trip** | < 5ms | Criterion |
| **Large Payload (10MB)** | < 50ms | Criterion |
| **Batch Commands (100)** | < 200ms | Criterion |
| **File List Streaming** | < 100ms | Criterion |

### Memory Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Frontend Heap (stress)** | < 150MB | Chrome Memory Profiler |
| **Backend RSS (40 snapshots)** | < 100MB | Memory Profiler |
| **Memory Growth (10 switches)** | < 5MB | Continuous monitoring |
| **GC Pauses (5min)** | < 10 pauses > 50ms | Chrome Performance |

---

## Profiling Tools

### Rust Backend

#### CPU Profiling
```bash
# Install flamegraph
cargo install flamegraph

# Generate CPU flamegraph
cargo flamegraph --bench database_benchmarks

# View in browser
open flamegraph.svg
```

#### Memory Profiling
```bash
# Use valgrind/massif
valgrind --tool=massif --massif-out-file=massif.out \
  ./target/release/amber

# Analyze results
ms_print massif.out
```

#### Query Profiling
```sql
-- Enable SQLite profiling
EXPLAIN QUERY PLAN
SELECT * FROM files WHERE snapshot_id = 1 LIMIT 100;

-- Check index usage
.eqp on
SELECT * FROM files_fts WHERE files_fts MATCH 'test*';
```

### Frontend

#### React DevTools Profiler
1. Open Chrome DevTools
2. Navigate to "Profiler" tab
3. Click "Record"
4. Perform actions (load dashboard, switch snapshots)
5. Stop recording
6. Analyze flame graph and ranked chart

#### Chrome Performance Monitor
1. Open Chrome DevTools
2. Press `Cmd+Shift+P` → "Show Performance Monitor"
3. Monitor:
   - CPU usage
   - JS heap size
   - DOM nodes
   - FPS

#### Memory Heap Snapshots
```javascript
// In Chrome DevTools Console
// Take heap snapshot before action
performance.mark('before-load');

// Perform action (load dashboard)

// Take heap snapshot after action
performance.mark('after-load');
performance.measure('dashboard-load', 'before-load', 'after-load');

// View Memory tab → Take snapshot → Compare
```

#### Lighthouse Performance Audit
```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit (with Tauri app running)
lighthouse http://localhost:1420 --view

# Generate report
lighthouse http://localhost:1420 --output=json --output-path=./lighthouse-report.json
```

---

## Continuous Integration

### GitHub Actions Workflow

Create `.github/workflows/performance.yml`:

```yaml
name: Performance Benchmarks

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday

jobs:
  backend-benchmarks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Run Criterion benchmarks
        run: cargo bench --bench database_benchmarks -- --output-format bencher | tee output.txt
      - name: Store benchmark result
        uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: 'cargo'
          output-file-path: output.txt
          github-token: ${{ secrets.GITHUB_TOKEN }}
          auto-push: true

  frontend-benchmarks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run benchmark:frontend
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: frontend-benchmarks
          path: frontend-benchmarks/results.json
```

---

## Performance Regression Detection

### Automated Comparison

```bash
# Compare current benchmark with baseline
cargo bench --bench database_benchmarks -- --save-baseline main

# On new branch
cargo bench --bench database_benchmarks -- --baseline main

# View regression report
```

### Threshold Alerts

Configure alerts in CI:
```yaml
- name: Check for performance regression
  run: |
    if [ "$(cat benchmark-result.txt | grep 'regressed')" ]; then
      echo "⚠️ Performance regression detected!"
      exit 1
    fi
```

---

## Optimization Strategies

### Database Optimization

1. **Index Creation**
   ```sql
   CREATE INDEX idx_files_snapshot_path ON files(snapshot_id, path);
   CREATE INDEX idx_snapshots_job_timestamp ON snapshots(job_id, timestamp DESC);
   ```

2. **Query Optimization**
   - Use `LIMIT` for pagination
   - Avoid `SELECT *` (specify columns)
   - Use prepared statements
   - Enable WAL mode: `PRAGMA journal_mode=WAL;`

3. **FTS5 Tuning**
   ```sql
   -- Configure FTS5 for performance
   CREATE VIRTUAL TABLE files_fts USING fts5(
       path,
       content='files',
       content_rowid='id',
       tokenize='porter unicode61'
   );
   ```

### Frontend Optimization

1. **React Memoization**
   ```tsx
   const MemoizedFileList = React.memo(FileList, (prev, next) => {
     return prev.snapshotId === next.snapshotId;
   });
   ```

2. **Virtual Scrolling**
   - Use `react-window` or `react-virtual`
   - Render only visible items (10-20 buffer)

3. **Debouncing**
   ```tsx
   const debouncedSearch = useMemo(
     () => debounce((query) => performSearch(query), 300),
     []
   );
   ```

### IPC Optimization

1. **Batch Operations**
   ```rust
   // Instead of multiple calls
   invoke('get_file_1'), invoke('get_file_2')...

   // Use single batch call
   invoke('get_files_batch', { ids: [1, 2, 3...] })
   ```

2. **Pagination**
   ```rust
   #[tauri::command]
   fn list_files_paginated(
       snapshot_id: i64,
       page: usize,
       page_size: usize
   ) -> Result<FileListResponse> {
       // Return only requested page
   }
   ```

---

## Reporting

### Benchmark Report Template

```markdown
# Performance Benchmark Report

**Date:** YYYY-MM-DD
**Branch:** feature/xyz
**Commit:** abc123

## Summary
- ✓ 12/15 benchmarks passed
- ⚠️ 2 warnings (within 10% of target)
- ❌ 1 failure (Dashboard render: 650ms > 500ms)

## Backend Performance
| Benchmark | Result | Target | Status |
|-----------|--------|--------|--------|
| List Snapshots | 8.2ms | < 10ms | ✓ |
| File Listing | 18.5ms | < 20ms | ✓ |
| FTS5 Search | 42ms | < 30ms | ❌ |

## Frontend Performance
| Benchmark | Result | Target | Status |
|-----------|--------|--------|--------|
| Dashboard Render | 480ms | < 500ms | ✓ |
| Snapshot Switch | 85ms | < 100ms | ✓ |

## Recommendations
1. Optimize FTS5 query (add covering index)
2. Implement virtual scrolling for file lists
3. Add memoization to Dashboard components
```

---

## Troubleshooting

### Common Issues

**Benchmark fails with "database locked":**
```bash
# Enable WAL mode
sqlite3 test.db "PRAGMA journal_mode=WAL;"
```

**Frontend benchmark timeout:**
```tsx
// Increase timeout in test config
{
  testTimeout: 30000  // 30 seconds
}
```

**Criterion reports fluctuating results:**
```bash
# Increase sample size
cargo bench -- --sample-size 200
```

---

## References

- [Criterion Documentation](https://bheisler.github.io/criterion.rs/book/)
- [React Profiler API](https://react.dev/reference/react/Profiler)
- [SQLite Performance](https://www.sqlite.org/performance.html)
- [Tauri Performance Best Practices](https://tauri.app/v1/guides/debugging/performance)

---

**Last Updated:** 2025-12-05
