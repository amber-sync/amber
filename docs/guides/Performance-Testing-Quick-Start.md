# Performance Testing Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites

```bash
# Rust toolchain
rustup --version

# Node.js (for frontend tests)
node --version

# SQLite (for data generation)
sqlite3 --version
```

---

## Step 1: Generate Stress Test Data (1 minute)

```bash
# Make script executable
chmod +x scripts/generate-stress-test-data.sh

# Generate database (creates 40 snapshots, 80K files)
./scripts/generate-stress-test-data.sh ./stress-test.db

# Verify
sqlite3 stress-test.db "SELECT COUNT(*) FROM snapshots;"
# Output: 40

sqlite3 stress-test.db "SELECT COUNT(*) FROM files;"
# Output: 80000
```

---

## Step 2: Run Backend Benchmarks (2 minutes)

```bash
# Run all Rust benchmarks
cargo bench

# Expected output:
# database_benchmarks/list_snapshots_40
#                         time:   [7.8ms 8.2ms 8.6ms]
# database_benchmarks/file_listing_paginated/50
#                         time:   [15.2ms 16.1ms 17.0ms]
# ...
```

**View HTML Report:**
```bash
open target/criterion/report/index.html
```

---

## Step 3: Run Frontend Benchmarks (2 minutes)

```bash
# Install dependencies
cd frontend-benchmarks
npm install

# Run benchmarks
npm run benchmark:all

# Expected output:
# ✓ Dashboard Initial Render: 480ms (Target: < 500ms) - PASS
# ✓ Snapshot Selection: 85ms (Target: < 100ms) - PASS
# ✓ Virtual Scrolling: 62 FPS (Target: 60 FPS) - PASS
```

---

## Quick Verification

### ✅ Success Criteria

| Test Category | Expected Result |
|---------------|-----------------|
| **Backend Benchmarks** | All queries < target times |
| **Frontend Benchmarks** | All renders < target times |
| **Database Size** | ~50-100MB for stress test DB |
| **No Errors** | All benchmarks complete successfully |

### 📊 Typical Baseline Results

```
Backend Performance (Criterion):
├─ List Snapshots (40):        8.2ms  ✓ (target: < 10ms)
├─ File Listing (paginated):   18.5ms ✓ (target: < 20ms)
├─ FTS5 Simple Search:         25.0ms ✓ (target: < 30ms)
├─ FTS5 Complex Search:        92.0ms ✓ (target: < 100ms)
└─ Snapshot Diff:              185ms  ✓ (target: < 200ms)

Frontend Performance (React):
├─ Dashboard Render:           480ms  ✓ (target: < 500ms)
├─ Snapshot Selection:         85ms   ✓ (target: < 100ms)
├─ TimeMachine Load:           720ms  ✓ (target: < 800ms)
├─ Scroll Performance:         62 FPS ✓ (target: 60 FPS)
└─ Search Response:            42ms   ✓ (target: < 50ms)

Memory Performance:
├─ Frontend Heap:              128MB  ✓ (target: < 150MB)
├─ Backend RSS:                85MB   ✓ (target: < 100MB)
└─ Memory Growth:              3.2MB  ✓ (target: < 5MB)
```

---

## Common Issues & Solutions

### Issue: "Database locked" error

**Solution:**
```bash
sqlite3 stress-test.db "PRAGMA journal_mode=WAL;"
```

### Issue: Benchmarks take too long

**Solution:** Reduce sample size (edit `benches/database_benchmarks.rs`)
```rust
config = Criterion::default()
    .sample_size(50)  // Reduced from 100
    .measurement_time(Duration::from_secs(5));  // Reduced from 10
```

### Issue: Frontend benchmarks fail to start

**Solution:**
```bash
cd frontend-benchmarks
rm -rf node_modules package-lock.json
npm install
```

### Issue: Out of memory during stress test generation

**Solution:** Reduce data size
```bash
# Edit scripts/generate-stress-test-data.sh
NUM_SNAPSHOTS=20  # Reduced from 40
FILES_PER_SNAPSHOT=1000  # Reduced from 2000
```

---

## Next Steps

### 1. Analyze Results

```bash
# Open Criterion HTML report
open target/criterion/report/index.html

# View detailed metrics
cat target/criterion/database_benchmarks/list_snapshots_40/base/estimates.json | jq
```

### 2. Profile Slow Operations

```bash
# CPU profiling (requires cargo-flamegraph)
cargo install flamegraph
sudo cargo flamegraph --bench database_benchmarks

# View flamegraph
open flamegraph.svg
```

### 3. Set Up Continuous Monitoring

```bash
# Save baseline for future comparison
cargo bench --bench database_benchmarks -- --save-baseline main

# On feature branch, compare
git checkout feature-xyz
cargo bench --bench database_benchmarks -- --baseline main
```

---

## Interpreting Results

### 🟢 Green (Good)
- All benchmarks below target
- Variance < 5%
- No outliers

### 🟡 Yellow (Caution)
- Some benchmarks within 10% of target
- Variance 5-10%
- Few outliers

### 🔴 Red (Action Required)
- Benchmarks exceed target
- Variance > 10%
- Many outliers
- Memory leaks detected

---

## Performance Budget Reference

### Critical Path Operations (Must Meet Targets)

| Operation | Target | Why Critical |
|-----------|--------|--------------|
| Dashboard Render | < 500ms | First user interaction |
| Snapshot Selection | < 100ms | Frequent user action |
| File List Query | < 20ms | Repeated operation |
| Search Response | < 50ms | Real-time feedback |
| Virtual Scroll | 60 FPS | User experience quality |

### Non-Critical Operations (Nice to Have)

| Operation | Target | Impact |
|-----------|--------|--------|
| TimeMachine Load | < 800ms | Occasional use |
| Complex Search | < 100ms | Advanced feature |
| Snapshot Diff | < 200ms | Background operation |

---

## Automated Testing Setup

### GitHub Actions Integration

1. Create `.github/workflows/performance.yml`
2. Add stress test DB to artifacts
3. Run benchmarks on PR
4. Compare with main branch
5. Fail CI if regression > 10%

### Example CI Configuration

```yaml
name: Performance Tests

on:
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Generate stress test data
        run: ./scripts/generate-stress-test-data.sh
      - name: Run benchmarks
        run: cargo bench
      - name: Check for regression
        run: |
          if [ "$(cat benchmark-result.txt | grep 'regressed')" ]; then
            echo "❌ Performance regression detected!"
            exit 1
          fi
```

---

## Resources

### Documentation
- [Full Performance Testing Guide](/docs/Performance-Testing-Guide.md)
- [Test Suite Summary](/docs/Performance-Test-Suite-Summary.md)

### External Links
- [Criterion Documentation](https://bheisler.github.io/criterion.rs/book/)
- [React Profiler API](https://react.dev/reference/react/Profiler)
- [SQLite Performance Tips](https://www.sqlite.org/performance.html)

### Tools
- [cargo-flamegraph](https://github.com/flamegraph-rs/flamegraph) - CPU profiling
- [Lighthouse](https://github.com/GoogleChrome/lighthouse) - Web performance auditing
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/performance/) - Frontend profiling

---

## Support

If you encounter issues:

1. Check the [Common Issues](#common-issues--solutions) section
2. Review the [Full Testing Guide](/docs/Performance-Testing-Guide.md)
3. Open an issue with benchmark results attached

---

**Last Updated:** 2025-12-05
**Estimated Setup Time:** 5 minutes
**Estimated First Run:** 10 minutes
