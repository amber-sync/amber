import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SANDBOX_ROOT = path.join(process.env.HOME || '', 'Desktop', 'amber-sandbox');
const SOURCE_DIR = path.join(SANDBOX_ROOT, 'source');
const DEST_DIR = path.join(SANDBOX_ROOT, 'dest');

// Helper to format date as YYYY-MM-DD-HHMMSS
function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
}

// Helper to create a large file
function createLargeFile(filePath: string, sizeMB: number) {
  const buffer = Buffer.alloc(1024 * 1024); // 1MB buffer
  buffer.fill('A'); // Fill with dummy data
  const fd = fs.openSync(filePath, 'w');
  for (let i = 0; i < sizeMB; i++) {
    fs.writeSync(fd, buffer);
  }
  fs.closeSync(fd);
}

// Helper to copy recursively
function copyRecursiveSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Helper to hard link recursively
function linkRecursiveSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      linkRecursiveSync(path.join(src, child), path.join(dest, child));
    });
  } else {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.linkSync(src, dest);
  }
}

// Helper to set timestamps recursively
function setRecursiveTimestamps(dir: string, date: Date) {
  if (!fs.existsSync(dir)) return;
  fs.utimesSync(dir, date, date);
  const stats = fs.statSync(dir);
  if (stats.isDirectory()) {
    fs.readdirSync(dir).forEach(child => {
      setRecursiveTimestamps(path.join(dir, child), date);
    });
  }
}

async function main() {
  console.log('🧹 Cleaning up sandbox...');
  if (fs.existsSync(SANDBOX_ROOT)) {
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(DEST_DIR, { recursive: true });

  console.log('📦 Creating initial state (Snapshot 1 - Yesterday)...');
  // Create some structure
  fs.mkdirSync(path.join(SOURCE_DIR, 'documents'));
  fs.mkdirSync(path.join(SOURCE_DIR, 'images'));
  fs.mkdirSync(path.join(SOURCE_DIR, 'projects', 'amber', 'src'), { recursive: true });

  // Create files
  fs.writeFileSync(path.join(SOURCE_DIR, 'hello.txt'), 'Hello World v1\n');
  fs.writeFileSync(path.join(SOURCE_DIR, 'config.json'), JSON.stringify({ version: 1 }, null, 2));

  // Create large files
  console.log('   Generating large files (this may take a moment)...');
  createLargeFile(path.join(SOURCE_DIR, 'documents', 'thesis.pdf'), 150); // 150MB
  createLargeFile(path.join(SOURCE_DIR, 'images', 'photo.raw'), 50); // 50MB
  fs.mkdirSync(path.join(SOURCE_DIR, 'videos'));
  createLargeFile(path.join(SOURCE_DIR, 'videos', 'project_render.mov'), 400); // 400MB

  // Snapshot 1
  const date1 = new Date();
  date1.setDate(date1.getDate() - 1);
  const snap1Name = formatDate(date1);
  const snap1Path = path.join(DEST_DIR, snap1Name);

  copyRecursiveSync(SOURCE_DIR, snap1Path);
  setRecursiveTimestamps(snap1Path, date1);
  console.log(`   ✅ Snapshot 1 created: ${snap1Name}`);

  console.log('📦 Creating Step 2 (Snapshot 2 - Today)...');
  // Modify source
  fs.appendFileSync(path.join(SOURCE_DIR, 'hello.txt'), 'Update v2\n');
  fs.unlinkSync(path.join(SOURCE_DIR, 'config.json')); // Delete file
  createLargeFile(path.join(SOURCE_DIR, 'projects', 'amber', 'bundle.js'), 120); // New 120MB file

  // Snapshot 2
  const date2 = new Date();
  date2.setHours(date2.getHours() - 2);
  const snap2Name = formatDate(date2);
  const snap2Path = path.join(DEST_DIR, snap2Name);

  // Hard link from snap1
  linkRecursiveSync(snap1Path, snap2Path);

  // Apply changes to snap2 (simulate rsync behavior)
  // 1. Unlink modified files
  fs.unlinkSync(path.join(snap2Path, 'hello.txt'));
  fs.copyFileSync(path.join(SOURCE_DIR, 'hello.txt'), path.join(snap2Path, 'hello.txt'));

  // 2. Delete removed files
  fs.unlinkSync(path.join(snap2Path, 'config.json'));

  // 3. Copy new files
  copyRecursiveSync(path.join(SOURCE_DIR, 'projects'), path.join(snap2Path, 'projects'));

  setRecursiveTimestamps(snap2Path, date2);
  // Specifically update modified file timestamps
  fs.utimesSync(path.join(snap2Path, 'hello.txt'), date2, date2);

  console.log(`   ✅ Snapshot 2 created: ${snap2Name}`);

  console.log('📦 Creating Step 3 (Snapshot 3 - Now)...');
  // Modify source
  fs.appendFileSync(path.join(SOURCE_DIR, 'hello.txt'), 'Update v3\n');
  fs.writeFileSync(path.join(SOURCE_DIR, 'config.json'), JSON.stringify({ version: 2 }, null, 2)); // Restore file

  // Snapshot 3
  const date3 = new Date();
  const snap3Name = formatDate(date3);
  const snap3Path = path.join(DEST_DIR, snap3Name);

  // Hard link from snap2
  linkRecursiveSync(snap2Path, snap3Path);

  // Apply changes
  fs.unlinkSync(path.join(snap3Path, 'hello.txt'));
  fs.copyFileSync(path.join(SOURCE_DIR, 'hello.txt'), path.join(snap3Path, 'hello.txt'));

  fs.copyFileSync(path.join(SOURCE_DIR, 'config.json'), path.join(snap3Path, 'config.json'));

  setRecursiveTimestamps(snap3Path, date3);

  // Create latest symlink
  const linkPath = path.join(DEST_DIR, 'latest');
  if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath);
  fs.symlinkSync(snap3Name, linkPath);

  console.log(`   ✅ Snapshot 3 created: ${snap3Name}`);

  console.log('🔍 Verifying Hard Links...');
  const inode1 = fs.statSync(path.join(snap1Path, 'documents', 'thesis.pdf')).ino;
  const inode2 = fs.statSync(path.join(snap2Path, 'documents', 'thesis.pdf')).ino;
  const inode3 = fs.statSync(path.join(snap3Path, 'documents', 'thesis.pdf')).ino;

  if (inode1 === inode2 && inode2 === inode3) {
    console.log('   ✅ Hard links verified! (Inodes match)');
  } else {
    console.error('   ❌ Hard link verification FAILED!');
    console.log(`      Snap1: ${inode1}, Snap2: ${inode2}, Snap3: ${inode3}`);
  }

  console.log('\n🎉 Sandbox setup complete!');
  console.log(`   Source: ${SOURCE_DIR}`);
  console.log(`   Dest:   ${DEST_DIR}`);
}

main().catch(console.error);
