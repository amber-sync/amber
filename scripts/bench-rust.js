const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BIN = './amber-sidecar/target/release/amber-sidecar';
const TEST_DIR = path.join(os.tmpdir(), 'amber-bench');

// Get count from args or default to 10k
const TOTAL_FILES = parseInt(process.argv[2]) || 10000;
const FILES_PER_DIR = 1000;
const DIR_COUNT = Math.ceil(TOTAL_FILES / FILES_PER_DIR);

async function run() {
    // 1. Setup
    console.log(`Cleaning up ${TEST_DIR}...`);
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
    
    console.log(`Creating ${TOTAL_FILES.toLocaleString()} files in ${TEST_DIR}...`);
    console.log(`Structure: ${DIR_COUNT} directories x ${FILES_PER_DIR} files`);
    
    const createStart = performance.now();
    fs.mkdirSync(TEST_DIR, { recursive: true });
    
    // Create structure
    for (let i = 0; i < DIR_COUNT; i++) {
        const sub = path.join(TEST_DIR, `dir_${i}`);
        fs.mkdirSync(sub);
        
        // Write files in batches/parallel if possible? Sync is blocking.
        // For 1M files, sync is too slow. Let's use a buffer reuse strategy?
        // Or just bare minimum write.
        for (let j = 0; j < FILES_PER_DIR; j++) {
            if (i * FILES_PER_DIR + j >= TOTAL_FILES) break;
            fs.writeFileSync(path.join(sub, `file_${j}.txt`), 'x');
        }
        
        if (i % 10 === 0) process.stdout.write('.');
    }
    const createEnd = performance.now();
    console.log(`\nCreation took: ${((createEnd - createStart) / 1000).toFixed(2)}s`);

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

    child.on('close', (code) => {
        const end = performance.now();
        const duration = (end - start);
        
        console.log(`--------------------------------`);
        console.log(`Found: ${count.toLocaleString()} files`);
        console.log(`Time:  ${duration.toFixed(2)} ms`);
        console.log(`Speed: ${(count / (duration/1000)).toFixed(0)} files/s`);
        console.log(`Data:  ${(bytes / 1024 / 1024).toFixed(2)} MB JSON streamed`);
        console.log(`--------------------------------`);
        
        // Cleanup (Optional, huge delete takes time)
        console.log('Cleanup skipped to allow manual inspection. Run script again to clean.');
        // fs.rmSync(TEST_DIR, { recursive: true });
    });
}

run();
