# Performance Test Suite Summary - Amber Backup Application

## Executive Overview

This document provides a comprehensive performance testing strategy for the Amber backup application, designed to validate performance under stress conditions (40 snapshots, 2000+ files each, ~80K total files, 30GB simulated data).

---

## 1. Test Suite Components

### 1.1 Backend Benchmarks (Rust/Criterion)

**Location:** `/benches/`

| Benchmark File | Focus Area | Key Metrics |
|----------------|------------|-------------|
| `database_benchmarks.rs` | SQLite queries, FTS5 search | Query latency, index efficiency |
| `ipc_benchmarks.rs` | Tauri IPC serialization | Round-trip time, payload size impact |
| `manifest_benchmarks.rs` | Manifest I/O operations | Deserialization time, diff calculation |

**Critical Benchmarks Implemented:**

1. **List Snapshots** (40 snapshots)
   - Target: < 10ms
   - Tests indexed query performance

2. **Paginated File Listing** (page sizes: 50, 100, 500)
   - Target: < 20ms per page
   - Tests LIMIT/OFFSET efficiency

3. **FTS5 Search** (exact match, prefix, complex)
   - Simple: < 30ms
   - Complex: < 100ms
   - Tests full-text search performance

4. **Snapshot Diff** (compare 2 snapshots)
   - Target: < 200ms
   - Tests JOIN performance

5. **IPC Serialization** (small, medium, large payloads)
   - 10 snapshots: < 5ms
   - 100 files: < 20ms
   - 2000 files: < 50ms

### 1.2 Frontend Benchmarks (React/TypeScript)

**Location:** `/frontend-benchmarks/`

| Benchmark File | Focus Area | Key Metrics |
|----------------|------------|-------------|
| `render_benchmarks.tsx` | Component rendering | Initial render, re-render time |
| `interaction_benchmarks.tsx` | User interactions | Input responsiveness, FPS |
| `memory_benchmarks.tsx` | Memory management | Heap size, GC frequency |

**Critical Benchmarks Implemented:**

1. **Dashboard Initial Render**
   - Target: < 500ms
   - Tests React component tree hydration

2. **Snapshot Selection Re-render**
   - Target: < 100ms
   - Tests memoization and re-render optimization

3. **TimeMachine View Load**
   - Target: < 800ms
   - Tests complex view initialization

4. **Virtual Scrolling FPS**
   - Target: 60 FPS (< 16ms/frame)
   - Tests scroll performance with 80K files

5. **Search Input Responsiveness**
   - Target: < 50ms debounced
   - Tests real-time search performance

### 1.3 Memory Benchmarks

**Targets:**

| Component | Metric | Target |
|-----------|--------|--------|
| Frontend Heap | Peak memory after loading stress test | < 150MB |
| Backend RSS | Memory with 40 snapshots loaded | < 100MB |
| Memory Growth | Increase after 10 snapshot switches | < 5MB |
| GC Pauses | Pauses > 50ms in 5-minute session | < 10 |

---

## 2. Test Data Generation

### Stress Test Database

**Script:** `/scripts/generate-stress-test-data.sh`

**Configuration:**
```bash
# Generate stress test database
./scripts/generate-stress-test-data.sh ./stress-test.db

# Output:
# - 40 snapshots
# - 2,000 files per snapshot
# - ~80,000 total files
# - Diverse file types (images, documents, code, text)
# - FTS5 index populated
# - Realistic file sizes (1KB - 1MB)
```

**Database Schema:**
- `jobs` - Backup job definitions
- `snapshots` - Snapshot metadata with file counts
- `files` - File entries with path, size, mtime, checksum
- `files_fts` - FTS5 virtual table for search

**Indexes:**
```sql
idx_snapshots_job_timestamp  -- Fast snapshot listing
idx_files_snapshot           -- Fast file retrieval by snapshot
idx_files_path               -- Path lookups
idx_files_snapshot_path      -- Combined index for queries
```

---

## 3. Recommended Tools

### Rust Backend

| Tool | Purpose | Usage |
|------|---------|-------|
| **Criterion** | Statistical benchmarking | `cargo bench` |
| **cargo-flamegraph** | CPU profiling | `cargo flamegraph --bench database_benchmarks` |
| **valgrind/massif** | Memory profiling | `valgrind --tool=massif ./target/release/amber` |
| **SQLite EXPLAIN** | Query optimization | `EXPLAIN QUERY PLAN SELECT ...` |

### Frontend

| Tool | Purpose | Usage |
|------|---------|-------|
| **React DevTools Profiler** | Component render analysis | Chrome DevTools > Profiler |
| **Chrome Performance Monitor** | Real-time metrics | Cmd+Shift+P > "Show Performance Monitor" |
| **Lighthouse** | Overall performance audit | `lighthouse http://localhost:1420` |
| **web-vitals** | Core Web Vitals | JavaScript library |

---

## 4. Execution Instructions

### Backend Benchmarks

```bash
# Run all benchmarks
cargo bench

# Run specific benchmark with HTML report
cargo bench --bench database_benchmarks

# Compare with baseline
cargo bench --bench database_benchmarks -- --save-baseline main
git checkout feature-branch
cargo bench --bench database_benchmarks -- --baseline main

# View results
open target/criterion/report/index.html
```

### Frontend Benchmarks

```bash
# Install dependencies
cd frontend-benchmarks
npm install

# Run all benchmarks
npm run benchmark:all

# Run specific benchmark
npm run benchmark:render

# Profile with Chrome DevTools
npm run benchmark:profile
```

### Integration Testing

```bash
# Generate stress test data
./scripts/generate-stress-test-data.sh ./stress-test.db

# Run end-to-end performance tests
cargo test --test end_to_end_benchmarks --release -- --nocapture

# Memory leak detection
cargo test --test memory_benchmarks --release -- --nocapture
```

---

## 5. Performance Targets Matrix

### 🎯 Backend Targets

| Operation | Target | Critical Path |
|-----------|--------|---------------|
| List 40 snapshots | < 10ms | ✓ |
| Paginated file list (100 files) | < 20ms | ✓ |
| FTS5 simple search | < 30ms | ✓ |
| FTS5 complex search | < 100ms | |
| Snapshot diff | < 200ms | |
| Manifest deserialization | < 50ms | ✓ |
| Database index seek | < 5ms | ✓ |

### 🎯 Frontend Targets

| Operation | Target | Critical Path |
|-----------|--------|---------------|
| Dashboard initial render | < 500ms | ✓ |
| Snapshot selection re-render | < 100ms | ✓ |
| TimeMachine view load | < 800ms | |
| File browser scroll | 60 FPS | ✓ |
| Search input | < 50ms | ✓ |
| Virtual list frame | < 16ms | ✓ |

### 🎯 IPC Targets

| Operation | Target | Critical Path |
|-----------|--------|---------------|
| Simple command round-trip | < 5ms | ✓ |
| Large payload (10MB) | < 50ms | |
| Batch commands (100) | < 200ms | |
| File list streaming (2000) | < 100ms | ✓ |

### 🎯 Memory Targets

| Metric | Target | Critical Path |
|--------|--------|---------------|
| Frontend heap (stress load) | < 150MB | ✓ |
| Backend RSS (40 snapshots) | < 100MB | ✓ |
| Memory growth (10 switches) | < 5MB | ✓ |
| GC pauses > 50ms (5min) | < 10 | |

---

## 6. Optimization Strategies

### Database Optimization

**Implemented:**
- ✓ Composite indexes (`idx_files_snapshot_path`)
- ✓ WAL mode for concurrent reads
- ✓ FTS5 with porter tokenizer
- ✓ Query result pagination

**Recommendations:**
- Use prepared statements for repeated queries
- Implement query result caching (LRU cache)
- Consider partial index for completed snapshots only
- Monitor `EXPLAIN QUERY PLAN` output

### Frontend Optimization

**Implemented:**
- React Profiler instrumentation
- Performance API markers

**Recommendations:**
- Implement `React.memo` for expensive components
- Use `useMemo` for expensive calculations
- Virtual scrolling with `react-window`
- Debounce search input (300ms)
- Code splitting for views

### IPC Optimization

**Implemented:**
- Benchmark for batch vs individual calls
- Payload size impact analysis

**Recommendations:**
- Batch API calls where possible
- Implement pagination for large datasets
- Use streaming for file listings
- Consider binary serialization for large payloads

---

## 7. Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/performance.yml
name: Performance Benchmarks

on:
  pull_request:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  benchmarks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run backend benchmarks
        run: cargo bench --bench database_benchmarks
      - name: Run frontend benchmarks
        run: |
          cd frontend-benchmarks
          npm install
          npm run benchmark:ci
      - name: Upload results
        uses: benchmark-action/github-action-benchmark@v1
```

---

## 8. Deliverables Summary

### ✅ Completed Deliverables

1. **Benchmark Code**
   - `/benches/database_benchmarks.rs` - Comprehensive SQLite/FTS5 benchmarks
   - `/benches/ipc_benchmarks.rs` - IPC serialization benchmarks
   - `/frontend-benchmarks/render_benchmarks.tsx` - React rendering benchmarks

2. **Test Data Generation**
   - `/scripts/generate-stress-test-data.sh` - Automated stress test DB creation

3. **Documentation**
   - `/docs/Performance-Testing-Guide.md` - Complete testing guide
   - `/docs/Performance-Test-Suite-Summary.md` - This summary document

4. **Configuration**
   - `/Cargo.toml` - Criterion benchmark configuration
   - `/frontend-benchmarks/package.json` - Frontend benchmark dependencies

### 📊 Key Metrics Dashboard

```
Backend Performance:
├─ Database Queries      ⚡ < 10ms
├─ FTS5 Search          ⚡ < 30ms
├─ Manifest I/O         ⚡ < 50ms
└─ IPC Round-trip       ⚡ < 5ms

Frontend Performance:
├─ Initial Render       ⚡ < 500ms
├─ Re-render            ⚡ < 100ms
├─ Scroll FPS           ⚡ 60 FPS
└─ Search Response      ⚡ < 50ms

Memory Performance:
├─ Frontend Heap        💾 < 150MB
├─ Backend RSS          💾 < 100MB
└─ Memory Growth        💾 < 5MB
```

---

## 9. Next Steps

### Immediate Actions

1. **Run baseline benchmarks**
   ```bash
   cargo bench
   npm run benchmark:all
   ```

2. **Generate stress test data**
   ```bash
   chmod +x scripts/generate-stress-test-data.sh
   ./scripts/generate-stress-test-data.sh
   ```

3. **Review results**
   - Open `target/criterion/report/index.html`
   - Analyze profiler data
   - Identify bottlenecks

### Ongoing Monitoring

1. **Weekly automated benchmarks** (CI/CD)
2. **Performance regression detection** (baseline comparison)
3. **Memory leak monitoring** (heap snapshots)
4. **User-facing metrics** (Lighthouse scores)

### Future Enhancements

1. **Distributed benchmarking** (multiple test machines)
2. **Real-world usage patterns** (record and replay)
3. **Automated performance budgets** (fail CI on regression)
4. **APM integration** (Sentry, DataDog)

---

## 10. Architecture Decision Records

### ADR-001: Criterion for Rust Benchmarks

**Decision:** Use Criterion as the primary Rust benchmarking framework.

**Rationale:**
- Statistical analysis (outlier detection, variance)
- HTML report generation
- Baseline comparison support
- Industry standard

**Alternatives Considered:**
- cargo-bench (built-in, but less features)
- Divan (newer, but less mature)

### ADR-002: React Profiler for Frontend

**Decision:** Use React DevTools Profiler API for component benchmarks.

**Rationale:**
- Direct integration with React internals
- Accurate render phase timings
- No external dependencies
- Supports both mount and update phases

**Alternatives Considered:**
- Custom performance.mark() (less accurate)
- Third-party profilers (overhead concerns)

### ADR-003: Stress Test Data Size

**Decision:** 40 snapshots × 2000 files = 80K total files, 30GB simulated.

**Rationale:**
- Exceeds typical user workload (safety margin)
- Tests performance at scale
- Identifies N+1 query problems
- Validates pagination effectiveness

**Alternatives Considered:**
- Smaller dataset (10 snapshots) - insufficient stress
- Larger dataset (100 snapshots) - excessive CI time

---

## Appendix: Quick Reference

### Common Commands

```bash
# Backend benchmarks
cargo bench --bench database_benchmarks
cargo flamegraph --bench database_benchmarks

# Frontend benchmarks
npm run benchmark:all
npm run benchmark:profile

# Generate test data
./scripts/generate-stress-test-data.sh

# View results
open target/criterion/report/index.html
```

### Performance Checklist

- [ ] Backend benchmarks passing (all < target)
- [ ] Frontend benchmarks passing (all < target)
- [ ] No memory leaks detected
- [ ] FPS maintained at 60 during scroll
- [ ] Search results return < 50ms
- [ ] Database indexes utilized (check EXPLAIN)
- [ ] GC pauses minimal (< 10 in 5min)
- [ ] Lighthouse score > 90

---

**Document Version:** 1.0
**Last Updated:** 2025-12-05
**Maintained By:** Architecture Team
**Review Cycle:** Quarterly
