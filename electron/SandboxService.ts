import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { SnapshotService } from './SnapshotService';

export class SandboxService {
  private sandboxDir: string;
  private sourceDir: string;
  private destDir: string;
  private snapshotService?: SnapshotService;

  constructor(snapshotService?: SnapshotService) {
    // Use userData or a specific location on Desktop for visibility
    const desktop = app.getPath('desktop');
    this.sandboxDir = path.join(desktop, 'amber-sandbox');
    this.sourceDir = path.join(this.sandboxDir, 'source');
    this.destDir = path.join(this.sandboxDir, 'dest');
    this.snapshotService = snapshotService;
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private createFile(filePath: string, sizeBytes = 1024, content: string | null = null) {
    this.ensureDir(path.dirname(filePath));
    try {
      if (content) {
        fs.writeFileSync(filePath, content);
      } else {
        const fd = fs.openSync(filePath, 'w');
        const chunkSize = 1024 * 1024; // 1MB chunks
        const buffer = Buffer.alloc(chunkSize, 'a');
        let remaining = sizeBytes;
        
        while (remaining > 0) {
          const writeSize = Math.min(remaining, chunkSize);
          // If last chunk is smaller, slice the buffer (or just write part of it)
          fs.writeSync(fd, buffer, 0, writeSize);
          remaining -= writeSize;
        }
        fs.closeSync(fd);
      }
      // console.log(`Created file: ${filePath} (${sizeBytes} bytes)`);
    } catch (e) {
      console.error(`Failed to create file ${filePath}:`, e);
    }
  }

  public async initSandbox(): Promise<{ source: string; dest: string }> {
    if (fs.existsSync(this.sandboxDir)) {
      fs.rmSync(this.sandboxDir, { recursive: true, force: true });
    }
    this.ensureDir(this.sourceDir);
    this.ensureDir(this.destDir);

    // Initial State
    this.createFile(path.join(this.sourceDir, 'hello.txt'), 0, 'Hello World! This is the initial version.\n');
    this.createFile(path.join(this.sourceDir, 'config.json'), 0, JSON.stringify({ version: 1, setting: 'default' }, null, 2));
    this.createFile(path.join(this.sourceDir, 'data', 'large.bin'), 1024 * 1024 * 5); // 5MB
    this.createFile(path.join(this.sourceDir, 'images', 'logo.png'), 1024 * 50);
    
    // Create backup marker
    fs.writeFileSync(path.join(this.destDir, '.dest_backup-marker'), '');

    return { source: this.sourceDir, dest: this.destDir };
  }

  public async simulateStep2() {
    // Modify existing
    fs.appendFileSync(path.join(this.sourceDir, 'hello.txt'), 'Update: Step 2 was here.\n');
    
    // Create new
    this.createFile(path.join(this.sourceDir, 'step2_new.txt'), 0, 'This file was added in step 2.\n');
    this.createFile(path.join(this.sourceDir, 'data', 'extra.bin'), 1024 * 1024);

    // Delete
    if (fs.existsSync(path.join(this.sourceDir, 'config.json'))) {
      fs.unlinkSync(path.join(this.sourceDir, 'config.json'));
    }
  }

  public async simulateStep3() {
    // Modify
    fs.appendFileSync(path.join(this.sourceDir, 'hello.txt'), 'Update: Step 3 final update.\n');

    // Restore deleted file
    this.createFile(path.join(this.sourceDir, 'config.json'), 0, JSON.stringify({ version: 2, setting: 'updated' }, null, 2));

    // Deep structure
    this.createFile(path.join(this.sourceDir, 'deep', 'nested', 'folder', 'secret.txt'), 0, 'Hidden treasure');
  }

  public async createMockBackups() {
    await this.initSandbox();
    
    // --- Snapshot 1 (Yesterday) - Base ~5MB ---
    const date1 = new Date();
    date1.setDate(date1.getDate() - 1);
    const snap1Name = this.formatDateForSnapshot(date1);
    const snap1Path = path.join(this.destDir, snap1Name);
    this.ensureDir(snap1Path);
    
    // Copy initial state (includes 5MB large.bin)
    this.copyRecursiveSync(this.sourceDir, snap1Path);
    this.setRecursiveTimestamps(snap1Path, date1);
    
    // --- Snapshot 2 (Today - 1 hour ago) - Add 300MB ---
    const date2 = new Date();
    date2.setHours(date2.getHours() - 1);
    const snap2Name = this.formatDateForSnapshot(date2);
    const snap2Path = path.join(this.destDir, snap2Name);
    this.ensureDir(snap2Path);

    // Hard link from snap1
    this.linkRecursiveSync(snap1Path, snap2Path);

    // Add 300MB video file to SNAPSHOT and SOURCE
    const videoPath = path.join('videos', 'vacation.mov');
    this.createFile(path.join(snap2Path, videoPath), 1024 * 1024 * 300); // 300MB
    this.createFile(path.join(this.sourceDir, videoPath), 1024 * 1024 * 300); // Update Source

    // Set timestamps
    fs.utimesSync(path.join(snap2Path, videoPath), date2, date2);
    fs.utimesSync(path.join(this.sourceDir, videoPath), date2, date2);


    // --- Snapshot 3 (Now) - Add another 300MB + 10k files ---
    const date3 = new Date();
    const snap3Name = this.formatDateForSnapshot(date3);
    const snap3Path = path.join(this.destDir, snap3Name);
    this.ensureDir(snap3Path);

    // Hard link from snap2
    this.linkRecursiveSync(snap2Path, snap3Path);

    // Add another 300MB file to SNAPSHOT and SOURCE
    const archivePath = path.join('data', 'archive.zip');
    this.createFile(path.join(snap3Path, archivePath), 1024 * 1024 * 300); // 300MB
    this.createFile(path.join(this.sourceDir, archivePath), 1024 * 1024 * 300); // Update Source

    // Generate 10,000 small files for performance testing
    console.log('Generating 10,000 files...');
    const benchDirName = 'benchmark_10k';
    const benchDirSnap = path.join(snap3Path, benchDirName);
    const benchDirSource = path.join(this.sourceDir, benchDirName);
    this.ensureDir(benchDirSnap);
    this.ensureDir(benchDirSource);
    
    // Use a loop with some concurrency or just sync for simplicity (it's a sandbox script)
    // Sync is safer to avoid EMFILE
    for (let i = 0; i < 10000; i++) {
        const fileName = `file_${String(i).padStart(5, '0')}.txt`;
        const content = `Content for file ${i}`;
        fs.writeFileSync(path.join(benchDirSnap, fileName), content);
        fs.writeFileSync(path.join(benchDirSource, fileName), content);
    }
    console.log('Generated 10,000 files.');

    // Set timestamps
    fs.utimesSync(path.join(snap3Path, archivePath), date3, date3);
    fs.utimesSync(path.join(this.sourceDir, archivePath), date3, date3);
    this.setRecursiveTimestamps(benchDirSnap, date3);
    this.setRecursiveTimestamps(benchDirSource, date3);


    // Create 'latest' symlink
    try {
        const linkPath = path.join(this.destDir, 'latest');
        if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath);
        fs.symlinkSync(snap3Name, linkPath);
    } catch (e) {
        console.error('Failed to create symlink', e);
    }

    // Index snapshots
    if (this.snapshotService) {
        try {
            console.log('Indexing mock snapshots...');
            await this.snapshotService.indexSnapshot('sandbox-auto', date1.getTime(), snap1Path);
            await this.snapshotService.indexSnapshot('sandbox-auto', date2.getTime(), snap2Path);
            await this.snapshotService.indexSnapshot('sandbox-auto', date3.getTime(), snap3Path);
            console.log('Mock snapshots indexed.');
        } catch (e) {
            console.error('Failed to index mock snapshots', e);
        }
    }
    
    return { source: this.sourceDir, dest: this.destDir };
  }

  private formatDateForSnapshot(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
  }

  private copyRecursiveSync(src: string, dest: string) {
    if (!fs.existsSync(src)) return;
    const stats = fs.statSync(src);
    const isDirectory = stats.isDirectory();
    if (isDirectory) {
      this.ensureDir(dest);
      fs.readdirSync(src).forEach((childItemName) => {
        this.copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  private linkRecursiveSync(src: string, dest: string) {
    if (!fs.existsSync(src)) return;
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      this.ensureDir(dest);
      fs.readdirSync(src).forEach((child) => {
        this.linkRecursiveSync(path.join(src, child), path.join(dest, child));
      });
    } else {
      // Create hard link
      // If dest exists, unlink it first (though it shouldn't in this flow)
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      fs.linkSync(src, dest);
    }
  }

  private setRecursiveTimestamps(dir: string, date: Date) {
    if (!fs.existsSync(dir)) return;
    fs.utimesSync(dir, date, date);
    const stats = fs.statSync(dir);
    if (stats.isDirectory()) {
      fs.readdirSync(dir).forEach(child => {
        this.setRecursiveTimestamps(path.join(dir, child), date);
      });
    }
  }
}
