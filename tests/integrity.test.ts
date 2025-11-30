const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const sinon = require('sinon');

// Mock Electron and electron-log BEFORE importing services
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
  if (id === 'electron') {
    return {
      app: {
        getPath: () => '/tmp',
        isPackaged: false
      }
    };
  }
  if (id === 'electron-log') {
    return {
      info: console.log,
      error: console.error,
      warn: console.warn,
      debug: console.debug,
      transports: { file: { getFile: () => ({ path: '/tmp/log.log' }) } }
    };
  }
  return originalRequire.apply(this, arguments);
};

// Now import services using require with .ts extension
const { RsyncService } = require('../electron/rsync-service.ts');
const { FileService } = require('../electron/FileService.ts');
const { SyncMode } = require('../src/types.ts');

describe('Snapshot Integrity & Hard Links', function() {
  this.timeout(30000);

  const testDir = path.join(__dirname, 'integrity-test-env');
  const sourceDir = path.join(testDir, 'source');
  const destDir = path.join(testDir, 'dest');
  let rsyncService: any;
  let fileService: any;

  before(async () => {
    // Clean up previous runs
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(destDir, { recursive: true });
    
    // Create marker
    const destBasename = path.basename(destDir);
    fs.writeFileSync(path.join(destDir, `.${destBasename}_backup-marker`), '');
    
    fileService = new FileService();
    rsyncService = new RsyncService(fileService);
  });

  after(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  const createJob = (id: string) => ({
    id,
    name: 'Test Job',
    sourcePath: sourceDir,
    destPath: destDir,
    mode: SyncMode.TIME_MACHINE,
    scheduleInterval: '0 0 * * *',
    createdAt: Date.now(),
    snapshots: [],
    config: {
      verbose: true,
      recursive: true
    }
  });

  it('Full Time Machine Backup Flow: Initial → Incremental → Continued', async () => {
    // === SNAPSHOT 1: Initial Full Backup ===
    const file1 = path.join(sourceDir, 'file1.bin');
    const buffer1 = Buffer.alloc(1024 * 1024 * 10); // 10MB
    fs.writeFileSync(file1, buffer1);

    const job = createJob('job1');
    const result1 = await rsyncService.runBackup(job, (msg: string) => {}, (data: any) => {});

    expect(result1.success).to.be.true;
    expect(result1.snapshot.sizeBytes).to.be.at.least(10 * 1024 * 1024);
    const snap1Path = result1.snapshot.path;
    
    // === SNAPSHOT 2: Incremental Backup (Add file2) ===
    const file2 = path.join(sourceDir, 'file2.bin');
    const buffer2 = Buffer.alloc(1024 * 1024 * 5); // 5MB
    fs.writeFileSync(file2, buffer2);

    const result2 = await rsyncService.runBackup(job, (msg: string) => {}, (data: any) => {});

    expect(result2.success).to.be.true;
    expect(result2.snapshot.sizeBytes).to.be.at.least(15 * 1024 * 1024);
    const snap2Path = result2.snapshot.path;
    
    // file1 should be hard-linked from snapshot 1
    const file1Snap1 = fs.statSync(path.join(snap1Path, 'file1.bin'));
    const file1Snap2 = fs.statSync(path.join(snap2Path, 'file1.bin'));
   expect(file1Snap1.ino).to.equal(file1Snap2.ino);
    
    // === SNAPSHOT 3: Continued Incremental (Add file3) ===
    const file3 = path.join(sourceDir, 'file3.bin');
    const buffer3 = Buffer.alloc(1024 * 1024 * 3); // 3MB
    fs.writeFileSync(file3, buffer3);

    const result3 = await rsyncService.runBackup(job, (msg: string) => {}, (data: any) => {});

    expect(result3.success).to.be.true;
    expect(result3.snapshot.sizeBytes).to.be.at.least(18 * 1024 * 1024);


    const snap3Path = result3.snapshot.path;
    
    // file1 and file2 should still be hard-linked from snapshot 2
    const file1Snap3 = fs.statSync(path.join(snap3Path, 'file1.bin'));
    const file2Snap3 = fs.statSync(path.join(snap3Path, 'file2.bin'));
    expect(file1Snap3.ino).to.equal(file1Snap2.ino);
    expect(file2Snap3.ino).to.equal(fs.statSync(path.join(snap2Path, 'file2.bin')).ino);
    
    // Verify all files exist in snapshot 3
    expect(fs.existsSync(path.join(snap3Path, 'file1.bin'))).to.be.true;
    expect(fs.existsSync(path.join(snap3Path, 'file2.bin'))).to.be.true;
    expect(fs.existsSync(path.join(snap3Path, 'file3.bin'))).to.be.true;
  });

});
