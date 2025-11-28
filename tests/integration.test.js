const { expect } = require('chai');
const fs = require('fs-extra');
const path = require('path');
const { RsyncService } = require('../electron/rsync-service');
const { SyncMode, JobStatus } = require('../electron/types');

const SANDBOX_DIR = path.resolve(__dirname, 'sandbox');
const SOURCE_DIR = path.join(SANDBOX_DIR, 'source');
const DEST_DIR = path.join(SANDBOX_DIR, 'dest');

const DEFAULT_CONFIG = {
    recursive: true,
    archive: true,
    compress: true,
    delete: false,
    verbose: false,
    excludePatterns: [],
    customFlags: ''
};

describe('RsyncService - Integration Sandbox', function() {
  this.timeout(10000);

  let service;

  beforeEach(async () => {
    // Retry cleaning up sandbox to avoid EPERM on file locks
    for (let i = 0; i < 3; i++) {
        try {
            await fs.emptyDir(SANDBOX_DIR);
            break;
        } catch (e) {
            await new Promise(r => setTimeout(r, 200));
        }
    }
    await fs.ensureDir(SOURCE_DIR);
    await fs.ensureDir(DEST_DIR);

    // Create backup marker file for safety check
    const destBasename = path.basename(DEST_DIR);
    await fs.writeFile(path.join(DEST_DIR, `.${destBasename}_backup-marker`), '');

    await fs.writeFile(path.join(SOURCE_DIR, 'file1.txt'), 'content 1');
    await fs.writeFile(path.join(SOURCE_DIR, 'file2.txt'), 'content 2');

    service = new RsyncService();
  });

  after(async () => {
    await fs.remove(SANDBOX_DIR);
  });

  it('should execute a real MIRROR backup', async () => {
    const job = {
      id: 'int-1',
      name: 'Mirror Test',
      sourcePath: SOURCE_DIR + path.sep,
      destPath: DEST_DIR,
      mode: SyncMode.MIRROR,
      scheduleInterval: null,
      config: {
        recursive: true,
        archive: true,
        compress: false,
        delete: true,
        verbose: true,
        excludePatterns: [],
        customFlags: ''
      },
      lastRun: null,
      status: JobStatus.IDLE
    };

    const logs = [];
    const result = await service.runBackup(job, (msg) => logs.push(msg), () => {});

    expect(result.success).to.be.true;
    expect(await fs.pathExists(path.join(DEST_DIR, 'source', 'file1.txt'))).to.be.true;
    expect(await fs.pathExists(path.join(DEST_DIR, 'source', 'file2.txt'))).to.be.true;
  });

  it('should execute a real TIME_MACHINE backup sequence', async () => {
    const job = {
      id: 'int-tm',
      name: 'TM Test',
      sourcePath: SOURCE_DIR + path.sep,
      destPath: DEST_DIR,
      mode: SyncMode.TIME_MACHINE,
      scheduleInterval: null,
      config: {
        recursive: true,
        archive: true,
        compress: false,
        delete: false,
        verbose: true,
        excludePatterns: [],
        customFlags: ''
      },
      lastRun: null,
      status: JobStatus.IDLE
    };

    // --- Run 1: Initial ---
    await service.runBackup(job, () => {}, () => {});
    
    const latestLink = path.join(DEST_DIR, 'source', 'latest');
    expect(await fs.pathExists(latestLink), 'Latest symlink should exist').to.be.true;
    
    const snapshot1Path = await fs.realpath(latestLink);
    const snapshot1Name = path.basename(snapshot1Path);
    expect(snapshot1Name).to.match(/^\d{4}-\d{2}-/);
    
    expect(await fs.pathExists(path.join(snapshot1Path, 'file1.txt'))).to.be.true;

    // --- Run 2: Change File ---
    await new Promise(r => setTimeout(r, 1100));
    
    await fs.writeFile(path.join(SOURCE_DIR, 'file1.txt'), 'content 1 MODIFIED');
    await service.runBackup(job, () => {}, () => {});

    const snapshot2Path = await fs.realpath(latestLink);
    expect(snapshot2Path).to.not.equal(snapshot1Path);
    
    const file1v1 = await fs.readFile(path.join(snapshot1Path, 'file1.txt'), 'utf8');
    const file1v2 = await fs.readFile(path.join(snapshot2Path, 'file1.txt'), 'utf8');
    expect(file1v1).to.equal('content 1');
    expect(file1v2).to.equal('content 1 MODIFIED');

    const stat1 = await fs.stat(path.join(snapshot1Path, 'file2.txt'));
    const stat2 = await fs.stat(path.join(snapshot2Path, 'file2.txt'));
    expect(stat1.ino).to.equal(stat2.ino, 'Unchanged files should be hard-linked (share inode)');
  });

  it('should expire old backups correctly', async () => {
    const makeDate = (daysAgo) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        return `${y}-${m}-${day}-${h}0000`;
    };

    const dirs = [
        makeDate(400), // > 365 days. Keep 1/30 days.
        makeDate(399), // Should be deleted (diff < 30)
        makeDate(350), // 
        makeDate(5),
        makeDate(4),   // > 1 day. Keep 1/day.
        makeDate(0)    // Now
    ];

    const targetBaseDir = path.join(DEST_DIR, 'source');
    for (const d of dirs) {
        await fs.ensureDir(path.join(targetBaseDir, d));
    }

    const job = {
        id: 'expiry',
        name: 'Expiry',
        sourcePath: SOURCE_DIR,
        destPath: DEST_DIR,
        mode: SyncMode.TIME_MACHINE,
        scheduleInterval: null,
        config: DEFAULT_CONFIG,
        lastRun: null,
        status: JobStatus.IDLE
    };
    
    await service.runBackup(job, () => {}, () => {});

    expect(await fs.pathExists(path.join(targetBaseDir, dirs[0])), 'Oldest (400d) should remain').to.be.false;
    expect(await fs.pathExists(path.join(targetBaseDir, dirs[1])), 'Redundant (399d) should be deleted').to.be.true;
    expect(await fs.pathExists(path.join(targetBaseDir, dirs[2])), 'Next distinct (350d) should remain').to.be.true;
  });
});

