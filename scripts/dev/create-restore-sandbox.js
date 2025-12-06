const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SANDBOX_DIR = path.join(process.cwd(), 'sandbox');
const SOURCE_DIR = path.join(SANDBOX_DIR, 'source');
const DEST_DIR = path.join(SANDBOX_DIR, 'dest');

function log(msg) {
  console.log(`[Sandbox] ${msg}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createFile(filePath, sizeBytes = 1024, content = null) {
  ensureDir(path.dirname(filePath));
  if (content) {
    fs.writeFileSync(filePath, content);
  } else {
    const buffer = Buffer.alloc(sizeBytes, 'a');
    fs.writeFileSync(filePath, buffer);
  }
  log(`Created ${path.relative(process.cwd(), filePath)}`);
}

function init() {
  log('Initializing sandbox...');
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
  ensureDir(SOURCE_DIR);
  ensureDir(DEST_DIR);

  createFile(path.join(SOURCE_DIR, 'hello.txt'), 0, 'Hello World! This is the initial version.\n');
  createFile(
    path.join(SOURCE_DIR, 'config.json'),
    0,
    JSON.stringify({ version: 1, setting: 'default' }, null, 2)
  );
  createFile(path.join(SOURCE_DIR, 'data', 'large.bin'), 1024 * 1024 * 5); // 5MB
  createFile(path.join(SOURCE_DIR, 'images', 'logo.png'), 1024 * 50);

  // Create backup marker
  fs.writeFileSync(path.join(DEST_DIR, '.dest_backup-marker'), '');

  log('Sandbox initialized.');
  log(`Source: ${SOURCE_DIR}`);
  log(`Dest:   ${DEST_DIR}`);
  log('Now create a job in Amber pointing to these paths and run the first backup.');
}

function step2() {
  log('Applying Step 2 changes (Incremental)...');

  // Modify existing
  fs.appendFileSync(path.join(SOURCE_DIR, 'hello.txt'), 'Update: Step 2 was here.\n');

  // Create new
  createFile(path.join(SOURCE_DIR, 'step2_new.txt'), 0, 'This file was added in step 2.\n');
  createFile(path.join(SOURCE_DIR, 'data', 'extra.bin'), 1024 * 1024);

  // Delete
  if (fs.existsSync(path.join(SOURCE_DIR, 'config.json'))) {
    fs.unlinkSync(path.join(SOURCE_DIR, 'config.json'));
    log('Deleted config.json');
  }

  log('Step 2 changes applied. Run backup again.');
}

function step3() {
  log('Applying Step 3 changes...');

  // Modify
  fs.appendFileSync(path.join(SOURCE_DIR, 'hello.txt'), 'Update: Step 3 final update.\n');

  // Restore deleted file (simulating user undo or just change)
  createFile(
    path.join(SOURCE_DIR, 'config.json'),
    0,
    JSON.stringify({ version: 2, setting: 'updated' }, null, 2)
  );

  // Deep structure
  createFile(path.join(SOURCE_DIR, 'deep', 'nested', 'folder', 'secret.txt'), 0, 'Hidden treasure');

  log('Step 3 changes applied. Run backup again.');
}

const command = process.argv[2];

switch (command) {
  case 'init':
    init();
    break;
  case 'step2':
    step2();
    break;
  case 'step3':
    step3();
    break;
  default:
    console.log('Usage: node scripts/create-restore-sandbox.js [init|step2|step3]');
    process.exit(1);
}
