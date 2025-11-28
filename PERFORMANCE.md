# Amber Performance Benchmarks

This document outlines the performance characteristics of the Hybrid Architecture (Electron + Rust Sidecar).

## Benchmark Tools

### 1. Backend Benchmark (I/O & Scanning)
Use `scripts/bench-rust.js` to generate a massive dataset and time the Rust scanner.

**Usage:**
```bash
# Scan 10,000 files (Default)
node scripts/bench-rust.js

# Scan 100,000 files
node scripts/bench-rust.js 100000

# Scan 1,000,000 files (Warning: Creation takes time!)
node scripts/bench-rust.js 1000000
```

**Baseline Results (M1 Max):**
| Files | Time | Speed |
| :--- | :--- | :--- |
| 10,000 | ~0.7s | ~13k/s |
| 100,000 | ~1.6s | ~60k/s |
| 1,000,000 | ~15s | ~66k/s |

### 2. Frontend Benchmark (Rendering)
The UI includes a `SidecarBenchmark` component in the "Help" section.
Use the "Stress Test" mode (mock) to verify React rendering performance independent of disk I/O.

## Performance Targets
*   **Time to First File:** < 50ms (Lazy Loading)
*   **Search Speed:** > 50,000 files/sec
*   **Memory Usage:** Rust sidecar < 20MB RAM during scan.

## Improvements Roadmap
1.  **Virtualization:** Use `react-window` in `FileBrowser.tsx` if list exceeds 1000 items.
2.  **Binary Protocol:** Switch from JSON (text) to Protobuf or Bincode for IPC if parsing becomes the bottleneck (> 1M files).
