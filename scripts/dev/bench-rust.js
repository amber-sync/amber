const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Allow binary path override via env var or arg
const BIN =
  process.env.SIDECAR_BIN || process.argv[3] || './amber-sidecar/target/release/amber-sidecar';
const TEST_DIR = path.join(os.tmpdir(), 'amber-bench');

// Get count from args or default to 10k
const TOTAL_FILES = parseInt(process.argv[2]) || 10000;
const FILES_PER_DIR = 1000;
const DIR_COUNT = Math.ceil(TOTAL_FILES / FILES_PER_DIR);
const RESULTS_FILE = 'benchmark-results.json';

async function run() {
  console.log(`Using sidecar binary: ${BIN}`);
  if (!fs.existsSync(BIN)) {
    console.error(`Error: Sidecar binary not found at ${BIN}`);
    process.exit(1);
  }

  // 1. Setup
  console.log(`Cleaning up ${TEST_DIR}...`);
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });

  console.log(`Creating ${TOTAL_FILES.toLocaleString()} files in ${TEST_DIR}...`);

  const createStart = performance.now();
  fs.mkdirSync(TEST_DIR, { recursive: true });

  // Create structure
  for (let i = 0; i < DIR_COUNT; i++) {
    const sub = path.join(TEST_DIR, `dir_${i}`);
    fs.mkdirSync(sub);

    for (let j = 0; j < FILES_PER_DIR; j++) {
      if (i * FILES_PER_DIR + j >= TOTAL_FILES) break;
      fs.writeFileSync(path.join(sub, `file_${j}.txt`), 'x');
    }

    if (i % 10 === 0 && process.stdout.isTTY) process.stdout.write('.');
  }
  const createEnd = performance.now();
  const creationTime = (createEnd - createStart) / 1000;
  console.log(`\nCreation took: ${creationTime.toFixed(2)}s`);

  // 2. Bench Search
  console.log('Starting Rust Search...');
  const start = performance.now();
  const child = spawn(BIN, ['search', TEST_DIR, 'file']);

  let count = 0;
  let bytes = 0;

  child.stdout.on('data', d => {
    bytes += d.length;
    count += d.toString().split('\n').length - 1; // Approximate line count
  });

  child.on('close', code => {
    const end = performance.now();
    const durationMs = end - start;
    const durationSec = durationMs / 1000;
    const speed = count / durationSec;
    const mbStreamed = bytes / 1024 / 1024;

    console.log(`--------------------------------`);
    console.log(`Found: ${count.toLocaleString()} files`);
    console.log(`Time:  ${durationMs.toFixed(2)} ms`);
    console.log(`Speed: ${speed.toFixed(0)} files/s`);
    console.log(`Data:  ${mbStreamed.toFixed(2)} MB JSON streamed`);
    console.log(`--------------------------------`);

    // Output JSON results
    const results = {
      timestamp: new Date().toISOString(),
      files: count,
      durationMs: durationMs,
      speedFilesPerSec: speed,
      dataMb: mbStreamed,
      creationTimeSec: creationTime,
    };

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`Results saved to ${RESULTS_FILE}`);

    // Cleanup
    console.log('Cleaning up...');
    fs.rmSync(TEST_DIR, { recursive: true });

    if (code !== 0) {
      console.error(`Sidecar exited with code ${code}`);
      process.exit(code);
    }
  });

  child.on('error', err => {
    console.error(`Failed to start sidecar: ${err.message}`);
    process.exit(1);
  });
}

run();
