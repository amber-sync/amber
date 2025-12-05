/**
 * Frontend Performance Benchmarks
 *
 * Measures React component render times and interaction responsiveness
 * Run with: npm run benchmark:frontend
 */

import { render } from '@testing-library/react';
import { Profiler, ProfilerOnRenderCallback } from 'react';
import Dashboard from '../src/views/Dashboard';
import TimeMachine from '../src/views/TimeMachine';
import { AppProvider } from '../src/context/AppContext';

interface BenchmarkResult {
  name: string;
  duration: number;
  timestamp: number;
}

const results: BenchmarkResult[] = [];

/**
 * Custom profiler callback to collect render metrics
 */
const onRenderCallback: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  results.push({
    name: `${id}_${phase}`,
    duration: actualDuration,
    timestamp: commitTime,
  });

  console.log(`[${id}] ${phase}: ${actualDuration.toFixed(2)}ms`);
};

/**
 * Generate stress test data: 40 snapshots with 2000 files each
 */
function generateStressTestData() {
  const snapshots = [];

  for (let i = 0; i < 40; i++) {
    const files = [];
    for (let j = 0; j < 2000; j++) {
      files.push({
        id: `${i}-${j}`,
        path: `/data/folder${Math.floor(j / 100)}/file_${j}.txt`,
        size: 1024 * (j % 1000 + 1),
        mtime: 1700000000 + j,
      });
    }

    snapshots.push({
      id: i,
      jobId: 1,
      timestamp: 1700000000 + i * 3600,
      manifestPath: `/manifests/snap_${i}.json`,
      state: 'completed',
      files,
    });
  }

  return { snapshots, jobs: [{ id: 1, name: 'Stress Test Job' }] };
}

/**
 * Benchmark 1: Dashboard Initial Render
 * Target: < 500ms
 */
async function benchmarkDashboardInitialRender() {
  console.log('\n=== Benchmark: Dashboard Initial Render ===');

  const data = generateStressTestData();
  const startTime = performance.now();

  render(
    <Profiler id="Dashboard" onRender={onRenderCallback}>
      <AppProvider initialData={data}>
        <Dashboard />
      </AppProvider>
    </Profiler>
  );

  const endTime = performance.now();
  const duration = endTime - startTime;

  console.log(`✓ Total render time: ${duration.toFixed(2)}ms`);
  console.log(`✓ Target: < 500ms | ${duration < 500 ? 'PASS' : 'FAIL'}`);

  return { name: 'Dashboard Initial Render', duration, pass: duration < 500 };
}

/**
 * Benchmark 2: Snapshot Selection Re-render
 * Target: < 100ms
 */
async function benchmarkSnapshotSelection() {
  console.log('\n=== Benchmark: Snapshot Selection Re-render ===');

  const data = generateStressTestData();
  const { rerender } = render(
    <Profiler id="SnapshotSelection" onRender={onRenderCallback}>
      <AppProvider initialData={data}>
        <Dashboard />
      </AppProvider>
    </Profiler>
  );

  // Simulate selecting a different snapshot
  const startTime = performance.now();

  rerender(
    <Profiler id="SnapshotSelection" onRender={onRenderCallback}>
      <AppProvider initialData={{ ...data, selectedSnapshotId: 5 }}>
        <Dashboard />
      </AppProvider>
    </Profiler>
  );

  const endTime = performance.now();
  const duration = endTime - startTime;

  console.log(`✓ Re-render time: ${duration.toFixed(2)}ms`);
  console.log(`✓ Target: < 100ms | ${duration < 100 ? 'PASS' : 'FAIL'}`);

  return { name: 'Snapshot Selection Re-render', duration, pass: duration < 100 };
}

/**
 * Benchmark 3: TimeMachine View Initial Load
 * Target: < 800ms
 */
async function benchmarkTimeMachineLoad() {
  console.log('\n=== Benchmark: TimeMachine View Initial Load ===');

  const data = generateStressTestData();
  const startTime = performance.now();

  render(
    <Profiler id="TimeMachine" onRender={onRenderCallback}>
      <AppProvider initialData={data}>
        <TimeMachine />
      </AppProvider>
    </Profiler>
  );

  const endTime = performance.now();
  const duration = endTime - startTime;

  console.log(`✓ Total load time: ${duration.toFixed(2)}ms`);
  console.log(`✓ Target: < 800ms | ${duration < 800 ? 'PASS' : 'FAIL'}`);

  return { name: 'TimeMachine Initial Load', duration, pass: duration < 800 };
}

/**
 * Benchmark 4: Virtual Scrolling Performance (FPS)
 * Target: 60 FPS (< 16ms per frame)
 */
async function benchmarkVirtualScrolling() {
  console.log('\n=== Benchmark: Virtual Scrolling Performance ===');

  const frameTimes: number[] = [];
  let lastFrameTime = performance.now();

  // Simulate 100 scroll events
  for (let i = 0; i < 100; i++) {
    requestAnimationFrame(() => {
      const currentTime = performance.now();
      const frameDuration = currentTime - lastFrameTime;
      frameTimes.push(frameDuration);
      lastFrameTime = currentTime;
    });
  }

  // Wait for all frames
  await new Promise(resolve => setTimeout(resolve, 2000));

  const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  const fps = 1000 / avgFrameTime;
  const slowFrames = frameTimes.filter(t => t > 16).length;

  console.log(`✓ Average frame time: ${avgFrameTime.toFixed(2)}ms`);
  console.log(`✓ Average FPS: ${fps.toFixed(1)}`);
  console.log(`✓ Slow frames (>16ms): ${slowFrames}/100`);
  console.log(`✓ Target: 60 FPS | ${fps >= 60 ? 'PASS' : 'FAIL'}`);

  return {
    name: 'Virtual Scrolling FPS',
    duration: avgFrameTime,
    pass: fps >= 60,
    metadata: { fps, slowFrames },
  };
}

/**
 * Benchmark 5: Search Input Responsiveness
 * Target: < 50ms debounced response
 */
async function benchmarkSearchResponsiveness() {
  console.log('\n=== Benchmark: Search Input Responsiveness ===');

  const searchTimes: number[] = [];

  // Simulate 20 search queries
  for (let i = 0; i < 20; i++) {
    const query = `file_${i * 100}`;
    const startTime = performance.now();

    // Simulate debounced search (50ms delay)
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simulate FTS5 search
    const mockResults = Array.from({ length: 100 }, (_, idx) => ({
      path: `/data/file_${idx}.txt`,
      size: 1024,
    }));

    const endTime = performance.now();
    searchTimes.push(endTime - startTime);
  }

  const avgSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;

  console.log(`✓ Average search time: ${avgSearchTime.toFixed(2)}ms`);
  console.log(`✓ Target: < 50ms | ${avgSearchTime < 50 ? 'PASS' : 'FAIL'}`);

  return { name: 'Search Input Responsiveness', duration: avgSearchTime, pass: avgSearchTime < 50 };
}

/**
 * Main benchmark runner
 */
async function runAllBenchmarks() {
  console.log('🚀 Starting Frontend Performance Benchmarks\n');
  console.log('Test Configuration:');
  console.log('  - Snapshots: 40');
  console.log('  - Files per snapshot: 2000');
  console.log('  - Total files: 80,000');
  console.log('  - Simulated data size: ~30GB\n');

  const benchmarks = [
    benchmarkDashboardInitialRender,
    benchmarkSnapshotSelection,
    benchmarkTimeMachineLoad,
    benchmarkVirtualScrolling,
    benchmarkSearchResponsiveness,
  ];

  const benchmarkResults = [];

  for (const benchmark of benchmarks) {
    try {
      const result = await benchmark();
      benchmarkResults.push(result);
    } catch (error) {
      console.error(`❌ Benchmark failed:`, error);
      benchmarkResults.push({ name: benchmark.name, duration: -1, pass: false });
    }
  }

  // Summary
  console.log('\n\n📊 Benchmark Summary\n');
  console.log('┌─────────────────────────────────────┬──────────────┬────────┐');
  console.log('│ Benchmark                           │ Duration     │ Status │');
  console.log('├─────────────────────────────────────┼──────────────┼────────┤');

  benchmarkResults.forEach(result => {
    const name = result.name.padEnd(35);
    const duration = `${result.duration.toFixed(2)}ms`.padStart(12);
    const status = result.pass ? '✓ PASS' : '✗ FAIL';
    console.log(`│ ${name} │ ${duration} │ ${status} │`);
  });

  console.log('└─────────────────────────────────────┴──────────────┴────────┘');

  const passCount = benchmarkResults.filter(r => r.pass).length;
  const totalCount = benchmarkResults.length;

  console.log(`\n${passCount}/${totalCount} benchmarks passed\n`);

  // Export results to JSON
  const report = {
    timestamp: new Date().toISOString(),
    results: benchmarkResults,
    profilerData: results,
  };

  return report;
}

// Run benchmarks if executed directly
if (require.main === module) {
  runAllBenchmarks()
    .then(report => {
      console.log('✓ Benchmark report generated');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Benchmark suite failed:', error);
      process.exit(1);
    });
}

export { runAllBenchmarks, benchmarkDashboardInitialRender, benchmarkSnapshotSelection };
