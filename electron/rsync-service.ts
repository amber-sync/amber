import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SyncJob, SyncMode, SyncResult } from './types';
import { CONSTANTS, MS_PER_DAY } from './constants';

const execAsync = promisify(exec);

import { FileService, FileEntry } from './FileService';

export class RsyncService {

  private activeJobs = new Map<string, ChildProcess>();
  private fileService: FileService | null = null;

  constructor(fileService?: FileService) {
    if (fileService) {
      this.fileService = fileService;
    }
  }

  public setFileService(service: FileService) {
    this.fileService = service;
  }

  /**
   * Check if a filesystem is FAT (FAT32, exFAT, vfat, etc.)
   * FAT filesystems have lower timestamp precision and need --modify-window
   * FIXED: Now async to avoid blocking the event loop
   */
  private async isFatFilesystem(dirPath: string): Promise<boolean> {
    try {
      const platform = process.platform;

      if (platform === 'darwin') {
        const { stdout } = await execAsync(
          `diskutil info "${dirPath}" 2>/dev/null || echo "UNKNOWN"`,
          {
            timeout: CONSTANTS.FILESYSTEM_CHECK_TIMEOUT_MS,
            encoding: 'utf8'
          }
        );

        const fsMatch = stdout.match(/File System Personality:\s+(.+)/i);
        if (fsMatch) {
          const fsType = fsMatch[1].toLowerCase();
          return fsType.includes('fat') || fsType.includes('msdos') || fsType.includes('exfat');
        }
      } else if (platform === 'linux') {
        const { stdout } = await execAsync(
          `stat -f -c %T "${dirPath}" 2>/dev/null || echo "UNKNOWN"`,
          {
            timeout: CONSTANTS.FILESYSTEM_CHECK_TIMEOUT_MS,
            encoding: 'utf8'
          }
        );

        const fsType = stdout.trim().toLowerCase();
        return fsType.includes('fat') || fsType.includes('vfat') ||
               fsType.includes('msdos') || fsType.includes('exfat');
      }

      return false;
    } catch (error) {
      // If detection fails, assume not FAT to avoid breaking backups
      return false;
    }
  }

  private async getDirectories(source: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(source, { withFileTypes: true });
      return entries
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort(); // ASCII sort is usually fine for ISO timestamps
    } catch (error) {
      return [];
    }
  }

  private async getLatestBackup(destPath: string): Promise<string | null> {
    const latestLink = path.join(destPath, CONSTANTS.LATEST_SYMLINK_NAME);

    try {
      await fs.access(latestLink);
      const linkTarget = await fs.readlink(latestLink);

      // FIXED: Handle both absolute and relative symlinks
      const resolvedPath = path.isAbsolute(linkTarget)
        ? linkTarget
        : path.join(destPath, linkTarget);

      return resolvedPath;
    } catch {
      // If no symlink, find newest timestamp folder
      const dirs = await this.getDirectories(destPath);
      const backupDirs = dirs.filter(d => CONSTANTS.BACKUP_DIR_PATTERN.test(d));

      if (backupDirs.length > 0) {
        return path.join(destPath, backupDirs[backupDirs.length - 1]);
      }
    }

    return null;
  }

  private resolvePath(p: string): string {
    if (p.startsWith('~/')) {
      return path.join(os.homedir(), p.slice(2));
    }
    if (p === '~') {
      return os.homedir();
    }
    if (!path.isAbsolute(p)) {
      // Resolve relative paths against home dir, NOT CWD (which might be / in prod)
      return path.join(os.homedir(), p);
    }
    return p;
  }

  async runBackup(job: SyncJob, onLog: (msg: string) => void, onProgress: (data: any) => void): Promise<SyncResult> {
    const now = new Date();
    const folderName = this.formatDate(now);

    // Resolve paths to ensure safety
    const sourcePath = this.resolvePath(job.sourcePath);
    const destPath = this.resolvePath(job.destPath);
    
    // Use resolved paths for operations
    // Note: We don't mutate the job object itself to avoid confusion, but use local vars
    
    const sourceBasename = path.basename(sourcePath);
    // New structure: dest/source_name/timestamp
    const targetBaseDir = path.join(destPath, sourceBasename);
    
    // We still use the root job.destPath for the marker check
    const rootDest = destPath;

    onLog(`Starting backup for ${job.name}`);
    onLog(`Source: ${sourcePath}`);
    onLog(`Destination Root: ${rootDest}`);
    onLog(`Target Directory: ${targetBaseDir}`);
    onLog(`Mode: ${job.mode}`);

    // SAFETY CHECK: Ensure backup marker exists in destination ROOT
    const destBasename = path.basename(rootDest);
    const markerFilename = `.${destBasename}_backup-marker`;
    const markerPath = path.join(rootDest, markerFilename);
    
    try {
        await fs.access(markerPath);
        onLog(`Backup marker verified at ${markerPath}`);
    } catch (e) {
        onLog(`Safety check failed: Backup marker missing.`);
        onLog(`Please create an empty file named '${markerFilename}' in '${rootDest}' to verify this is the correct drive.`);
        onLog(`Run this command: touch "${markerPath}"`);
        return {
            success: false,
            error: `Safety check failed: Missing marker file '${markerFilename}' in destination root. See logs for details.`
        };
    }

    // Ensure target subdirectory exists
    try {
        await fs.mkdir(targetBaseDir, { recursive: true });
    } catch (e: any) {
        onLog(`Error creating target directory: ${e.message}`);
        return { success: false, error: e.message };
    }

    let finalDest = targetBaseDir; // Default for Mirror/Archive (though Mirror usually syncs TO the dir, not INTO it, but rsync behavior depends on trailing slash)
    // Actually for Mirror/Archive, if we want "dest/source_name", we usually pass "dest" and rsync creates "source_name" if we don't put trailing slash on source.
    // BUT here we are explicitly defining the structure.
    // If we want the CONTENT of source to go into targetBaseDir, we use targetBaseDir as dest.
    
    let linkDest = null;

    // Setup paths for Time Machine
    if (job.mode === SyncMode.TIME_MACHINE) {
      // Check for previous backup in NEW structure
      let latest = await this.getLatestBackup(targetBaseDir);
      
      if (latest) {
        onLog(`Found previous backup (new structure): ${path.basename(latest)}`);
        linkDest = latest;
      } else {
        // Fallback: Check for previous backup in OLD structure (root)
        onLog(`No previous backup in ${targetBaseDir}. Checking legacy root...`);
        latest = await this.getLatestBackup(rootDest);
        if (latest) {
             onLog(`Found previous backup (legacy structure): ${path.basename(latest)}`);
             linkDest = latest;
        } else {
             onLog(`No previous backup found. Performing full backup.`);
        }
      }
      
      finalDest = path.join(targetBaseDir, folderName);
    } else {
        // For Mirror/Archive, we want to sync INTO targetBaseDir.
        // If we want exact mirror of source content into targetBaseDir:
        finalDest = targetBaseDir;
    }

    let args: string[];
    try {
      args = await this.buildRsyncArgs(job, finalDest, linkDest, onLog);
    } catch (err: any) {
      onLog(`ERROR: ${err?.message || 'Failed to build rsync command'}`);
      return { success: false, error: err?.message || 'Failed to build rsync command' };
    }

    if (!args || args.length === 0) {
      onLog('ERROR: Unable to build rsync command.');
      return { success: false, error: 'Failed to build rsync command' };
    }
    onLog(`Command: rsync ${args.join(' ')}`);

    return new Promise((resolve) => {
      const child = spawn('rsync', args);
      this.activeJobs.set(job.id, child);

      let lastProgressUpdate = 0;
      const PROGRESS_INTERVAL_MS = 200;

      child.stdout.on('data', (data) => {
        const str = data.toString();
        const progressMatch = str.match(/^\s*([\d,]+)\s+(\d+)%\s+([0-9.]+[kKMGTP]?B\/s)\s+([\d:]+)/);
        
        const now = Date.now();
        const shouldUpdate = (now - lastProgressUpdate) > PROGRESS_INTERVAL_MS;

        if (progressMatch && onProgress && shouldUpdate) {
            lastProgressUpdate = now;
            onProgress({
                transferred: progressMatch[1],
                percentage: parseInt(progressMatch[2]),
                speed: progressMatch[3],
                eta: progressMatch[4]
            });
        } else {
            const isFilePath = str.trim().length > 0 && !str.startsWith('sent ') && !str.startsWith('total size') && !str.startsWith('sending incremental');
            
            if (isFilePath) {
                 if (onProgress && shouldUpdate) {
                    lastProgressUpdate = now;
                    onProgress({
                        transferred: 'Syncing...',
                        percentage: 0,
                        speed: 'Calculating...',
                        eta: null,
                        currentFile: str.trim()
                    });
                 }
            } else {
                onLog(str.trim());
            }
        }
      });
      
      child.stderr.on('data', (data) => onLog(`ERROR: ${data.toString().trim()}`));

      child.on('close', async (code) => {
        this.activeJobs.delete(job.id);
        
        if (code === 0) {
          onLog('Rsync finished successfully.');
          
          let snapshotFiles: any[] = [];
          
          try {
              // Scan the destination (finalDest)
              snapshotFiles = await this.scanDirectory(finalDest);
          } catch (e: any) {
              onLog(`Warning: Failed to scan snapshot directory: ${e.message}`);
          }

          if (job.mode === SyncMode.TIME_MACHINE) {
            try {
                // Create/Update 'latest' symlink in targetBaseDir
                const linkPath = path.join(targetBaseDir, CONSTANTS.LATEST_SYMLINK_NAME);
                try {
                    await fs.unlink(linkPath);
                } catch {}

                // Use relative path for portability: folderName is just the timestamp folder
                await fs.symlink(folderName, linkPath);
                onLog(`Updated '${CONSTANTS.LATEST_SYMLINK_NAME}' symlink in ${targetBaseDir}`);

                // Expiration - only in targetBaseDir
                await this.expireBackups(targetBaseDir, onLog);
            } catch (e: any) {
                onLog(`Post-backup error: ${e.message}`);
            }
          }
          
          resolve({ 
              success: true, 
              snapshot: {
                  root: snapshotFiles,
                  timestamp: now.getTime(),
                  ...this.calculateStats(snapshotFiles)
              }
          });
        } else {
          onLog(`Rsync failed with code ${code}`);
          resolve({ success: false, error: `Rsync exited with code ${code}` });
        }
      });
      
      child.on('error', (err) => {
          this.activeJobs.delete(job.id);
          onLog(`Failed to start rsync process: ${err.message}`);
          resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Recursively scan a directory with performance optimizations
   * FIXED: Added batching and depth limits to prevent memory issues
   */
  private async scanDirectory(dir: string, depth = 0): Promise<any[]> {
      if (depth > CONSTANTS.MAX_DIRECTORY_SCAN_DEPTH) {
        return []; // Prevent infinite recursion
      }

      const entries = await fs.readdir(dir, { withFileTypes: true });
      const results: any[] = [];

      // Process in batches to avoid creating thousands of promises simultaneously
      for (let i = 0; i < entries.length; i += CONSTANTS.DIRECTORY_SCAN_BATCH_SIZE) {
        const batch = entries.slice(i, i + CONSTANTS.DIRECTORY_SCAN_BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(entry => this.scanEntry(dir, entry, depth))
        );
        results.push(...batchResults.filter((item): item is any => item !== null));
      }

      return results;
  }

  private async scanEntry(dir: string, entry: any, depth: number): Promise<any | null> {
      try {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
              return {
                  id: `${path.basename(dir)}-${entry.name}`,
                  name: entry.name,
                  type: 'FOLDER',
                  size: 0,
                  modified: Date.now(),
                  children: await this.scanDirectory(fullPath, depth + 1)
              };
          } else {
              const stats = await fs.stat(fullPath);
              return {
                  id: `${path.basename(dir)}-${entry.name}`,
                  name: entry.name,
                  type: 'FILE',
                  size: stats.size,
                  modified: stats.mtimeMs
              };
          }
      } catch (e) {
          // Ignore inaccessible files to prevent total failure
          return null;
      }
  }

  private calculateStats(files: any[]): { sizeBytes: number, fileCount: number } {
      let size = 0;
      let count = 0;
      for (const f of files) {
          if (f.type === 'FOLDER' && f.children) {
              const sub = this.calculateStats(f.children);
              size += sub.sizeBytes;
              count += sub.fileCount;
          } else {
              size += f.size;
              count++;
          }
      }
      return { sizeBytes: size, fileCount: count };
  }

  killJob(jobId: string) {
    const child = this.activeJobs.get(jobId);
    if (child) {
      child.kill(); // SIGTERM
      this.activeJobs.delete(jobId);
    }
  }

  private async buildRsyncArgs(
    job: SyncJob,
    finalDest: string,
    linkDest: string | null,
    onLog: (msg: string) => void
  ): Promise<string[]> {
    const safeLog = onLog || (() => {});
    const conf = job.config;

    // Advanced override: user provided full command template
    if (conf.customCommand !== undefined) {
      if (!conf.customCommand.trim()) {
        throw new Error('Custom rsync command is selected but empty.');
      }
      return this.buildCustomCommand(job, finalDest, linkDest, safeLog);
    }

    const args: string[] = [];
    // Explicit flags for reliable backups
    args.push(
      '-D',
      '--numeric-ids',
      '--links',
      '--hard-links',
      '--one-file-system',
      '--itemize-changes',
      '--stats',
      '--human-readable'
    );

    if (conf.archive) {
      args.push('-a'); // implies recursive, times, owner, group, perms, links, devices, specials
    } else {
      if (conf.recursive) args.push('--recursive');
      // Preserve metadata even when not using -a
      args.push('--times', '--perms', '--owner', '--group');
    }

    const shouldCompress = conf.compress === true || (job.sshConfig?.enabled && conf.compress === undefined);
    if (shouldCompress) args.push('-z');

    if (conf.verbose) args.push('-v');
    if (conf.delete) args.push('--delete');

    // FIXED: Now async FAT filesystem check
    const sourceFat = await this.isFatFilesystem(job.sourcePath);
    const destFat = await this.isFatFilesystem(finalDest);

    if (sourceFat || destFat) {
      if (sourceFat) {
        onLog('Source filesystem is FAT - using --modify-window=2 for timestamp tolerance');
      }
      if (destFat) {
        onLog('Destination filesystem is FAT - using --modify-window=2 for timestamp tolerance');
      }
      args.push('--modify-window=2');
    }

    // SECURITY FIX: SSH host key checking
    if (job.sshConfig?.enabled) {
      let sshCmd = 'ssh';
      if (job.sshConfig.port) sshCmd += ` -p ${job.sshConfig.port}`;
      if (job.sshConfig.identityFile) sshCmd += ` -i ${job.sshConfig.identityFile}`;
      if (job.sshConfig.configFile) sshCmd += ` -F ${job.sshConfig.configFile}`;
      if (job.sshConfig.proxyJump) sshCmd += ` -J ${job.sshConfig.proxyJump}`;
      if (job.sshConfig.customSshOptions) sshCmd += ` ${job.sshConfig.customSshOptions}`;

      // SECURITY FIX: Only disable host key checking if explicitly enabled
      if (job.sshConfig.disableHostKeyChecking === true) {
        onLog('⚠️  WARNING: SSH host key checking is disabled. Use only in trusted networks.');
        sshCmd += ' -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null';
      }

      args.push('-e', sshCmd);
    }

    if (linkDest && job.mode === SyncMode.TIME_MACHINE) {
      args.push(`--link-dest=${linkDest}`);
    }

    if (conf.excludePatterns) {
      conf.excludePatterns.forEach(p => {
        if (p.trim()) args.push(`--exclude=${p.trim()}`);
      });
    }

    if (conf.customFlags && conf.customFlags.trim()) {
      throw new Error('Custom flags are disabled; use the custom command field for advanced use.');
    }

    // Source and Dest - ensure trailing slash
    const sourcePath = this.ensureTrailingSlash(job.sourcePath);
    args.push(sourcePath);
    args.push(finalDest);

    return args;
  }

  private buildCustomCommand(
    job: SyncJob,
    finalDest: string,
    linkDest: string | null,
    onLog: (msg: string) => void
  ): string[] {
    const template = (job.config.customCommand || '').trim();

    // Replace placeholders when present; otherwise leave untouched.
    const commandString = template
      .replace(/{source}/g, this.ensureTrailingSlash(job.sourcePath))
      .replace(/{dest}/g, finalDest)
      .replace(/{linkDest}/g, linkDest || '');

    const tokens = this.tokenizeFlags(commandString);

    if (tokens.length === 0) {
      throw new Error('Custom command is empty after parsing.');
    }

    onLog('Using custom rsync command (advanced mode, no safety checks).');
    return tokens;
  }

  private tokenizeFlags(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;
    let escaped = false;

    for (const ch of input) {
      if (escaped) {
        current += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '\'' && !inDouble) {
        inSingle = !inSingle;
        continue;
      }
      if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
        continue;
      }
      if (ch === ' ' && !inSingle && !inDouble) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }
      current += ch;
    }

    if (inSingle || inDouble) {
      throw new Error('Unbalanced quotes in custom flags/command.');
    }

    if (current) tokens.push(current);
    return tokens;
  }

  private ensureTrailingSlash(p: string): string {
    return p.endsWith(path.sep) ? p : p + path.sep;
  }

  isJobRunning(jobId: string): boolean {
    return this.activeJobs.has(jobId);
  }

  private formatDate(date: Date): string {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const h = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const s = String(date.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${d}-${h}${min}${s}`;
  }

  private parseDate(folderName: string): Date | null {
      // Expected: YYYY-MM-DD-HHMMSS
      const match = folderName.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})$/);
      if (!match) return null;
      return new Date(
          parseInt(match[1]),
          parseInt(match[2]) - 1,
          parseInt(match[3]),
          parseInt(match[4]),
          parseInt(match[5]),
          parseInt(match[6])
      );
  }

  private async expireBackups(destPath: string, onLog: (msg: string) => void) {
    const dirs = await this.getDirectories(destPath);
    const backupDirs = dirs.filter(d => CONSTANTS.BACKUP_DIR_PATTERN.test(d)).sort();

    if (backupDirs.length === 0) return;

    const now = Date.now();
    const strategies = CONSTANTS.RETENTION_STRATEGIES;

    const backupsToDelete: string[] = [];
    let lastKeptTimestamp = now;

    // Iterate from newest to oldest
    for (let i = backupDirs.length - 1; i >= 0; i--) {
      const dir = backupDirs[i];
      const date = this.parseDate(dir);
      if (!date) continue;

      const ts = date.getTime();
      const ageDays = (now - ts) / MS_PER_DAY;

      // Determine retention interval based on age
      let interval = 0; // 0 means keep all (recent backups)

      for (let j = strategies.length - 1; j >= 0; j--) {
        if (ageDays >= strategies[j].afterDays) {
          interval = strategies[j].intervalDays;
          break;
        }
      }

      if (interval === 0) {
        // Keep all recent backups
        lastKeptTimestamp = ts;
        continue;
      }

      if (lastKeptTimestamp === now) {
        // First backup in retention zone - always keep
        lastKeptTimestamp = ts;
        continue;
      }

      const daysDiff = (lastKeptTimestamp - ts) / MS_PER_DAY;

      if (daysDiff < interval) {
        backupsToDelete.push(dir);
      } else {
        lastKeptTimestamp = ts;
      }
    }

    // Execute deletes
    for (const dir of backupsToDelete) {
      onLog(`Pruning old backup: ${dir}`);
      try {
        await fs.rm(path.join(destPath, dir), { recursive: true, force: true });
      } catch (e: any) {
        onLog(`Failed to prune ${dir}: ${e.message}`);
      }
    }
  }
}
