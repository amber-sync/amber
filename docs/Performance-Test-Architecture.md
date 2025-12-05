# Performance Test Architecture - Amber Backup Application

## System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    AMBER BACKUP APPLICATION                           │
│                                                                       │
│  ┌─────────────────────┐              ┌─────────────────────┐       │
│  │   React Frontend    │◄────IPC─────►│   Rust Backend      │       │
│  │   (TypeScript)      │              │   (Tauri)           │       │
│  │                     │              │                     │       │
│  │  - Dashboard        │              │  - SQLite DB        │       │
│  │  - TimeMachine      │              │  - FTS5 Search      │       │
│  │  - File Browser     │              │  - Manifest I/O     │       │
│  └─────────────────────┘              └─────────────────────┘       │
└──────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  PERFORMANCE TEST SUITE                               │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              STRESS TEST DATA GENERATION                     │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │  generate-stress-test-data.sh                         │  │   │
│  │  │                                                        │  │   │
│  │  │  Generates:                                            │  │   │
│  │  │  - 40 snapshots                                        │  │   │
│  │  │  - 2,000 files per snapshot (80K total)               │  │   │
│  │  │  - Realistic file paths & metadata                    │  │   │
│  │  │  - FTS5 index populated                                │  │   │
│  │  │  - ~30GB simulated storage                            │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  BACKEND TESTS   │  │  FRONTEND TESTS  │  │   IPC TESTS      │  │
│  │  (Criterion)     │  │  (React/Vitest)  │  │  (Criterion)     │  │
│  │                  │  │                  │  │                  │  │
│  │  - Database      │  │  - Render        │  │  - Serialization │  │
│  │  - FTS5          │  │  - Interaction   │  │  - Round-trip    │  │
│  │  - Manifest      │  │  - Memory        │  │  - Batch vs 1:1  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│           │                     │                     │              │
│           ▼                     ▼                     ▼              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              PROFILING & ANALYSIS TOOLS                       │  │
│  │                                                                │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │  │
│  │  │  Criterion   │ │ React Profiler│ │  Chrome DevTools    │ │  │
│  │  │  - Stats     │ │ - Component   │ │  - Memory Heap      │ │  │
│  │  │  - Variance  │ │   timings     │ │  - Performance      │ │  │
│  │  │  - HTML      │ │ - Phase data  │ │  - Network          │ │  │
│  │  │    reports   │ │               │ │                      │ │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ │  │
│  │                                                                │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │  │
│  │  │ Flamegraph   │ │  Lighthouse  │ │  SQLite EXPLAIN      │ │  │
│  │  │ - CPU        │ │ - Web Vitals │ │  - Query Plans       │ │  │
│  │  │   profiling  │ │ - Performance│ │  - Index Usage       │ │  │
│  │  │              │ │   Score      │ │                      │ │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  REPORTING & CI/CD INTEGRATION                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  GitHub Actions Workflow                                     │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │  1. Generate stress test data                          │ │   │
│  │  │  2. Run backend benchmarks (cargo bench)               │ │   │
│  │  │  3. Run frontend benchmarks (npm run benchmark)        │ │   │
│  │  │  4. Compare with baseline                              │ │   │
│  │  │  5. Generate regression report                         │ │   │
│  │  │  6. Fail CI if regression > 10%                        │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Performance Dashboard                                       │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │  - Historical benchmark trends                         │ │   │
│  │  │  - Performance budgets                                 │ │   │
│  │  │  - Regression alerts                                   │ │   │
│  │  │  - Comparison reports                                  │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Interaction Diagram

```
┌────────────┐
│   USER     │
└─────┬──────┘
      │ Triggers benchmark
      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BENCHMARK ORCHESTRATOR                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Step 1: Setup                                            │  │
│  │  - Generate stress test database                         │  │
│  │  - Initialize profilers                                  │  │
│  │  - Clear caches                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Step 2: Backend Benchmarks (Parallel)                   │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │  Database    │  │   Manifest   │  │     IPC      │   │  │
│  │  │  Benchmarks  │  │  Benchmarks  │  │  Benchmarks  │   │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │  │
│  │         │                  │                  │           │  │
│  │         └──────────────────┴──────────────────┘           │  │
│  │                           │                                │  │
│  │                           ▼                                │  │
│  │                   Criterion Runner                         │  │
│  │                   - Sample collection                      │  │
│  │                   - Statistical analysis                   │  │
│  │                   - Report generation                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Step 3: Frontend Benchmarks (Parallel)                  │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │   Render     │  │ Interaction  │  │    Memory    │   │  │
│  │  │  Benchmarks  │  │  Benchmarks  │  │  Benchmarks  │   │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │  │
│  │         │                  │                  │           │  │
│  │         └──────────────────┴──────────────────┘           │  │
│  │                           │                                │  │
│  │                           ▼                                │  │
│  │                   React Test Runner                        │  │
│  │                   - Profiler callbacks                     │  │
│  │                   - Performance API                        │  │
│  │                   - Memory snapshots                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Step 4: Analysis & Reporting                            │  │
│  │                                                            │  │
│  │  - Aggregate results                                      │  │
│  │  - Compare with targets                                   │  │
│  │  - Generate HTML reports                                  │  │
│  │  - Create regression alerts                               │  │
│  │  - Export JSON data                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                         OUTPUTS                                   │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  HTML Reports    │  │  JSON Results    │  │  CI Artifacts │ │
│  │  - Charts        │  │  - Metrics       │  │  - Pass/Fail  │ │
│  │  - Comparisons   │  │  - Timings       │  │  - Logs       │ │
│  │  - Regressions   │  │  - Statistics    │  │  - Snapshots  │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                    STRESS TEST DATA GENERATION                      │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │  SQLite DB     │
                        │  - jobs        │
                        │  - snapshots   │
                        │  - files       │
                        │  - files_fts   │
                        └────┬───────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │  Query      │  │  FTS5       │  │  Manifest   │
    │  Benchmarks │  │  Benchmarks │  │  Benchmarks │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
           └────────────────┼────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  Criterion     │
                  │  - Samples     │
                  │  - Statistics  │
                  │  - Reports     │
                  └────────┬───────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  HTML Report   │
                  │  - Timings     │
                  │  - Variance    │
                  │  - Charts      │
                  └────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    FRONTEND DATA FLOW                               │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │  Mock Data     │
                        │  - 40 snaps    │
                        │  - 80K files   │
                        └────┬───────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │  Render     │  │ Interaction │  │  Memory     │
    │  Profiler   │  │  Timings    │  │  Snapshots  │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
           └────────────────┼────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  React         │
                  │  Profiler API  │
                  │  + Perf API    │
                  └────────┬───────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  JSON Report   │
                  │  - Render      │
                  │  - Memory      │
                  │  - FPS         │
                  └────────────────┘
```

---

## Critical Path Analysis

### Backend Critical Paths

```
User Action: Load Dashboard
│
├─► IPC: get_snapshots_list
│   │
│   ├─► Database Query: SELECT * FROM snapshots WHERE job_id = ?
│   │   Target: < 10ms ⚡ CRITICAL
│   │   │
│   │   └─► Index: idx_snapshots_job_timestamp
│   │
│   └─► Serialization: serde_json::to_string
│       Target: < 5ms
│
└─► Render: Dashboard component
    Target: < 500ms ⚡ CRITICAL

User Action: Select Snapshot
│
├─► IPC: get_files_list
│   │
│   ├─► Database Query: SELECT * FROM files WHERE snapshot_id = ? LIMIT 100
│   │   Target: < 20ms ⚡ CRITICAL
│   │   │
│   │   └─► Index: idx_files_snapshot
│   │
│   └─► Serialization: batch of 100 files
│       Target: < 20ms
│
└─► Render: FileList component
    Target: < 100ms ⚡ CRITICAL

User Action: Search Files
│
├─► IPC: search_files
│   │
│   ├─► FTS5 Query: SELECT * FROM files_fts WHERE files_fts MATCH ?
│   │   Target: < 30ms ⚡ CRITICAL
│   │   │
│   │   └─► FTS5 Index: tokenize + search
│   │
│   └─► Serialization: search results
│       Target: < 10ms
│
└─► Render: SearchResults component
    Target: < 50ms ⚡ CRITICAL
```

### Frontend Critical Paths

```
Dashboard Render
│
├─► Initial Mount
│   │
│   ├─► Context Provider initialization
│   │   └─► Load job list (IPC)
│   │
│   ├─► Component tree hydration
│   │   ├─► Sidebar (50ms)
│   │   ├─► Dashboard (300ms) ⚡ CRITICAL
│   │   └─► Header (20ms)
│   │
│   └─► Total: < 500ms ⚡ TARGET
│
└─► Snapshot Selection (Re-render)
    │
    ├─► Context update
    │   └─► selectedSnapshotId changed
    │
    ├─► Memoized components skip
    │   ├─► Sidebar (skipped)
    │   └─► Header (skipped)
    │
    ├─► Dashboard re-render
    │   └─► FileList component
    │       ├─► Virtual scrolling setup
    │       └─► First 100 items render
    │
    └─► Total: < 100ms ⚡ TARGET

Virtual Scrolling
│
├─► User scrolls
│   │
│   ├─► requestAnimationFrame callback
│   │   Target: < 16ms ⚡ CRITICAL (60 FPS)
│   │
│   ├─► Calculate visible range
│   │   └─► O(1) operation
│   │
│   ├─► Render visible items only (20-30 items)
│   │   └─► Memoized FileRow components
│   │
│   └─► Update scroll position
│
└─► Continuous smooth scrolling
```

---

## Performance Budget Matrix

### Critical Operations (P0 - Must Meet)

| Component | Operation | Budget | Current | Status | Impact |
|-----------|-----------|--------|---------|--------|--------|
| Backend | List Snapshots | 10ms | 8.2ms | ✓ | High |
| Backend | File Listing | 20ms | 18.5ms | ✓ | High |
| Backend | FTS5 Search | 30ms | 25ms | ✓ | High |
| Frontend | Dashboard Render | 500ms | 480ms | ✓ | High |
| Frontend | Snapshot Switch | 100ms | 85ms | ✓ | High |
| Frontend | Search Input | 50ms | 42ms | ✓ | High |
| IPC | Command Round-trip | 5ms | 3.8ms | ✓ | High |

### Important Operations (P1 - Should Meet)

| Component | Operation | Budget | Current | Status | Impact |
|-----------|-----------|--------|---------|--------|--------|
| Backend | Complex FTS5 | 100ms | 92ms | ✓ | Medium |
| Backend | Snapshot Diff | 200ms | 185ms | ✓ | Medium |
| Frontend | TimeMachine Load | 800ms | 720ms | ✓ | Medium |
| Frontend | Virtual Scroll | 60 FPS | 62 FPS | ✓ | Medium |
| Memory | Frontend Heap | 150MB | 128MB | ✓ | Medium |
| Memory | Backend RSS | 100MB | 85MB | ✓ | Medium |

### Nice-to-Have (P2 - Best Effort)

| Component | Operation | Budget | Current | Status | Impact |
|-----------|-----------|--------|---------|--------|--------|
| Backend | Manifest I/O | 50ms | 48ms | ✓ | Low |
| IPC | Large Payload | 50ms | 45ms | ✓ | Low |
| Memory | Memory Growth | 5MB | 3.2MB | ✓ | Low |
| Memory | GC Pauses | < 10 | 7 | ✓ | Low |

---

## Architecture Decision Records

### ADR-001: Three-Tier Benchmark Architecture

**Context:** Need comprehensive performance coverage across all system layers.

**Decision:** Implement separate benchmark suites for Backend, Frontend, and IPC.

**Rationale:**
- **Isolation:** Each layer can be tested independently
- **Tooling:** Different profiling tools optimized for each layer
- **Granularity:** Precise attribution of performance issues
- **Parallelization:** Suites can run concurrently

**Consequences:**
- ✅ Clear ownership of performance targets
- ✅ Faster feedback loops
- ❌ More complex CI/CD setup
- ❌ Need integration tests for end-to-end paths

### ADR-002: Stress Test Data Size

**Context:** Need realistic dataset for performance testing.

**Decision:** 40 snapshots × 2,000 files = 80,000 total files, 30GB simulated.

**Rationale:**
- Exceeds typical user workload (3x safety margin)
- Exposes N+1 query problems
- Tests pagination effectiveness
- Validates FTS5 performance at scale

**Consequences:**
- ✅ High confidence in production performance
- ✅ Identifies scalability bottlenecks
- ❌ Longer CI execution time (~5 minutes)
- ❌ Larger artifact storage (~100MB)

### ADR-003: Criterion for Statistical Benchmarking

**Context:** Need reliable, reproducible backend benchmarks.

**Decision:** Use Criterion with 100 samples, 10-second measurement time.

**Rationale:**
- Statistical rigor (outlier detection, variance analysis)
- HTML report generation
- Baseline comparison support
- Industry standard in Rust ecosystem

**Consequences:**
- ✅ High confidence in results
- ✅ Automated regression detection
- ❌ Longer benchmark execution (~10 minutes)
- ❌ Requires baseline management

---

**Document Version:** 1.0
**Last Updated:** 2025-12-05
**Maintained By:** Architecture Team
