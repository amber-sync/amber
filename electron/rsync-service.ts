import { spawn, ChildProcess, execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { SyncJob, SyncMode } from './types';

export class RsyncService {

  private activeJobs = new Map<string, ChildProcess>();

  /**
   * Check if a filesystem is FAT (FAT32, exFAT, vfat, etc.)
   * FAT filesystems have lower timestamp precision and need --modify-window
   */
  private isFatFilesystem(dirPath: string): boolean {
    try {
      // Try different methods depending on OS
      const platform = process.platform;

      if (platform === 'darwin' || platform === 'linux') {
        // Use df to get filesystem info
        // On macOS: df -T gives type in different column than Linux
        // On Linux: df -T gives type in column 2
        // Better approach: use stat --file-system on Linux, diskutil on macOS

        if (platform === 'darwin') {
          // Use diskutil to get filesystem type
          const output = execSync(`diskutil info "${dirPath}" 2>/dev/null || echo "UNKNOWN"`, {
            encoding: 'utf8',
            timeout: 5000
          });

          // Look for File System Personality line
          const fsMatch = output.match(/File System Personality:\s+(.+)/i);
          if (fsMatch) {
            const fsType = fsMatch[1].toLowerCase();
            return fsType.includes('fat') || fsType.includes('msdos') || fsType.includes('exfat');
          }
        } else if (platform === 'linux') {
          // Use stat to get filesystem type
          const output = execSync(`stat -f -c %T "${dirPath}" 2>/dev/null || echo "UNKNOWN"`, {
            encoding: 'utf8',
            timeout: 5000
          });

          const fsType = output.trim().toLowerCase();
          return fsType.includes('fat') || fsType.includes('vfat') || fsType.includes('msdos') || fsType.includes('exfat');
        }
      }

      // If we can't determine, assume not FAT
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
    // Check for 'latest' symlink first
    const latestLink = path.join(destPath, 'latest');
    try {
      await fs.access(latestLink);
      const realPath = await fs.readlink(latestLink);
      return path.resolve(destPath, realPath); // Ensure absolute
    } catch {
      // If no symlink, find newest timestamp folder
      const dirs = await this.getDirectories(destPath);
      const backupDirs = dirs.filter(d => /^\d{4}-\d{2}-\d{2}-\d{6}$/.test(d));
      if (backupDirs.length > 0) {
        return path.join(destPath, backupDirs[backupDirs.length - 1]);
      }
    }
    return null;
  }

  async runBackup(job: SyncJob, onLog: (msg: string) => void, onProgress?: (data: any) => void): Promise<any> {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:T]/g, '-').replace(/\..+/, ''); // YYYY-MM-DD-HH-mm-ss
    // Note: ISO is YYYY-MM-DDTHH:mm:ss.sssZ. Replace : with - and T with - and remove ms
    // Better: custom format YYYY-MM-DD-HHMMSS
    const folderName = this.formatDate(now);

    let dest = job.destPath;
    let linkDest = null;

    onLog(`Starting backup for ${job.name}`);
    onLog(`Mode: ${job.mode}`);

    // Ensure destination exists
    try {
        await fs.mkdir(dest, { recursive: true });
    } catch (e: any) {
        onLog(`Error creating destination: ${e.message}`);
        return { success: false, error: e.message };
    }

    // SAFETY CHECK: Verify backup marker exists in destination
    // This prevents accidentally using the wrong directory and wiping data
    const markerPath = path.join(dest, 'backup.marker');
    try {
        await fs.access(markerPath);
    } catch (e) {
        onLog(`ERROR: Safety check failed - backup marker not found at ${markerPath}`);
        onLog(`This directory does not appear to be a backup destination.`);
        onLog(`To mark this as a backup folder, create the marker file with:`);
        onLog(`  touch "${markerPath}"`);
        return {
            success: false,
            error: 'Backup marker not found. Safety check failed. See logs for instructions.'
        };
    }

    // Setup paths for Time Machine
    if (job.mode === SyncMode.TIME_MACHINE) {
      const latest = await this.getLatestBackup(dest);
      if (latest) {
        onLog(`Found previous backup: ${path.basename(latest)}`);
        linkDest = latest;
      } else {
        onLog(`No previous backup found. Performing full backup.`);
      }
      dest = path.join(job.destPath, folderName);
    }

    const args = this.buildRsyncArgs(job, dest, linkDest, onLog);
    onLog(`Command: rsync ${args.join(' ')}`);

    return new Promise((resolve) => {
      const child = spawn('rsync', args);
      this.activeJobs.set(job.id, child);

      let lastProgressUpdate = 0;
      const PROGRESS_INTERVAL_MS = 200; // Throttle updates to 5 times per second

      child.stdout.on('data', (data) => {
        const str = data.toString();
        
        // Fallback progress for older rsync (estimate based on file count if possible, or just "running")
        // Without --info=progress2, we don't get real-time percentage easily unless we parse verbose file list.
        // If verbose is on, we see file names.
        
        // Check for progress2 output (if user added it via custom flags)
        // Format: 45,678,123 12% 10.5MB/s 0:00:04
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
        } else if (onProgress && str.includes('to-check=')) {
             // Partial support for --info=progress2 if available but regex missed or slightly different
             // But main issue is it's not passed by default now.
        } else {
            // Heuristic for standard verbose output to show "activity"
            // If it looks like a file path (starts with / or ./ or contains /), emit "scrolling" status.
            // Also catch "sent x bytes" lines for summary updates.
            const isFilePath = str.trim().length > 0 && !str.startsWith('sent ') && !str.startsWith('total size') && !str.startsWith('sending incremental');
            
            if (isFilePath) {
                 // Send a "pulse" update without percentage
                 if (onProgress && shouldUpdate) {
                    lastProgressUpdate = now;
                    onProgress({
                        transferred: 'Syncing...',
                        percentage: 0, // indeterminate
                        speed: 'Calculating...',
                        eta: null, // Send null ETA to trigger "Calculating..." display
                        currentFile: str.trim() // Use the file path as status
                    });
                 }
                 
                 // IMPORTANT: Do NOT log every file path to the console log/UI log.
                 // It causes massive lag with thousands of files.
                 // Only log if it seems NOT to be a standard file list item (e.g. headers, summaries)
                 // But rsync -v output is mostly file list.
                 // We suppress file list lines from onLog.
            } else {
                // It's likely a summary line or header
                onLog(str.trim());
            }
        }
      });
      
      child.stderr.on('data', (data) => onLog(`ERROR: ${data.toString().trim()}`));

      child.on('close', async (code) => {
        this.activeJobs.delete(job.id);
        
        // Gather stats from the run (simplified for now, rely on rsync stats in log usually)
        // Ideally we parse the --stats output captured in stdout, but for now let's just scan the result.
        
        if (code === 0) {
          onLog('Rsync finished successfully.');
          
          let snapshotFiles: any[] = [];
          
          try {
              // Scan the destination to build file tree for snapshot
              snapshotFiles = await this.scanDirectory(dest);
          } catch (e: any) {
              onLog(`Warning: Failed to scan snapshot directory: ${e.message}`);
          }

          if (job.mode === SyncMode.TIME_MACHINE) {
            try {
                // Create/Update 'latest' symlink
                const linkPath = path.join(job.destPath, 'latest');
                try {
                    await fs.unlink(linkPath);
                } catch {} // Ignore if doesn't exist
                
                // Symlink relative path
                await fs.symlink(folderName, linkPath);
                onLog(`Updated 'latest' symlink to ${folderName}`);

                // Expiration
                await this.expireBackups(job.destPath, onLog);
            } catch (e: any) {
                onLog(`Post-backup error: ${e.message}`);
            }
          }
          
          resolve({ 
              success: true, 
              snapshot: {
                  root: snapshotFiles,
                  timestamp: now.getTime(),
                  // Calculate size/count from scan result
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

  private async scanDirectory(dir: string): Promise<any[]> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      // Use Promise.all to parallelize subdirectory scanning
      const tasks = entries.map(async (entry) => {
          try {
              if (entry.isDirectory()) {
                  return {
                      id: `${path.basename(dir)}-${entry.name}`,
                      name: entry.name,
                      type: 'FOLDER',
                      size: 0,
                      modified: Date.now(),
                      children: await this.scanDirectory(path.join(dir, entry.name))
                  };
              } else {
                  const stats = await fs.stat(path.join(dir, entry.name));
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
      });

      return (await Promise.all(tasks)).filter(Boolean);
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

  private buildRsyncArgs(job: SyncJob, finalDest: string, linkDest: string | null, onLog: (msg: string) => void): string[] {
    const args: string[] = [];
    const conf = job.config;

    // Explicit flags matching user's bash script "large overhaul"
    // RSYNC_FLAGS="-D --numeric-ids --links --hard-links --one-file-system --itemize-changes --times --recursive --perms --owner --group --stats --human-readable"
    
    args.push(
        '-D',
        '--numeric-ids',
        '--links',
        '--hard-links',
        '--one-file-system', 
        '--itemize-changes',
        '--times',
        '--recursive',
        '--perms',
        '--owner',
        '--group',
        '--stats',
        '--human-readable'
    );

    if (job.sshConfig?.enabled) args.push('--compress'); // Script logic: Only add compress if SSH is enabled
    if (conf.verbose) args.push('-v');
    if (conf.delete) args.push('--delete');

    // Check for FAT filesystems and add --modify-window if needed
    const sourceFat = this.isFatFilesystem(job.sourcePath);
    const destFat = this.isFatFilesystem(finalDest);

    if (sourceFat || destFat) {
        if (sourceFat) {
            onLog('Source filesystem is FAT - using --modify-window=2 for timestamp tolerance');
        }
        if (destFat) {
            onLog('Destination filesystem is FAT - using --modify-window=2 for timestamp tolerance');
        }
        args.push('--modify-window=2');
    }

    if (job.sshConfig?.enabled) {
      let sshCmd = 'ssh';
      if (job.sshConfig.port) sshCmd += ` -p ${job.sshConfig.port}`;
      if (job.sshConfig.identityFile) sshCmd += ` -i ${job.sshConfig.identityFile}`;
      if (job.sshConfig.configFile) sshCmd += ` -F ${job.sshConfig.configFile}`;
      // strict checking off for automation usually
      sshCmd += ' -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null';
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

    if (conf.customFlags) {
      const flags = conf.customFlags.split(' ').filter(f => f.trim().length > 0);
      args.push(...flags);
    }

    // Source and Dest
    // Ensure source ends with slash to copy CONTENTS, matching the script behavior: "$SRC_FOLDER/"
    const sourcePath = job.sourcePath.endsWith(path.sep) ? job.sourcePath : `${job.sourcePath}${path.sep}`;
    args.push(sourcePath);
    args.push(finalDest);

    return args;
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
    // Strategy: 1:1 30:7 365:30
    // "After 1 day, keep one per day."
    // "After 30 days, keep one per 7 days."
    // "After 365 days, keep one per 30 days."
    
    const dirs = await this.getDirectories(destPath);
    const backupDirs = dirs.filter(d => /^\d{4}-\d{2}-\d{2}-\d{6}$/.test(d)).sort();
    
    if (backupDirs.length === 0) return;

    const now = new Date().getTime();
    const msPerDay = 24 * 60 * 60 * 1000;

    // We want to KEEP backups that satisfy conditions.
    // We process from NEWEST to OLDEST to ensure we keep the latest backup of a given interval (e.g. latest of the day).
    // This is standard Time Machine behavior (snapshots represent state at end of interval).
    
    let lastKeptTimestamp = now; // Initialize with current time (effectively keeping "future" or "now" as anchor)
    // Actually, anchor should be the first backup kept.
    // Iterate Newest -> Oldest
    
    // Strategy rules parsed
    const strategies = [
        { afterDays: 1, intervalDays: 1 },
        { afterDays: 30, intervalDays: 7 },
        { afterDays: 365, intervalDays: 30 }
    ].sort((a, b) => a.afterDays - b.afterDays); // 1, 30, 365

    const backupsToDelete: string[] = [];

    // REVERSE iteration (Newest first)
    for (let i = backupDirs.length - 1; i >= 0; i--) {
        const dir = backupDirs[i];
        const date = this.parseDate(dir);
        if (!date) continue;
        
        const ts = date.getTime();
        const ageDays = (now - ts) / msPerDay;
        
        // Find applicable strategy
        let interval = 0; // 0 means keep all
        
        // Find the most relevant strategy (largest afterDays < ageDays)
        // wait, strategies are "after X days".
        // If age is 0.5 days. No strategy > 0.5 days. Keep all.
        // If age is 1.5 days. Strategy > 1 day applies.
        
        // Reversed: 365, 30, 1
        for (let j = strategies.length - 1; j >= 0; j--) {
            if (ageDays >= strategies[j].afterDays) {
                interval = strategies[j].intervalDays;
                break;
            }
        }
        
        if (interval === 0) {
            // Keep all (recent backups)
            lastKeptTimestamp = ts;
            continue;
        }
        
        // Check gap
        // Since we go Newest -> Oldest, we check if this backup is "too close" to the previously kept one (which is NEWER).
        // But "too close" in the past direction.
        // Effectively: Is (lastKept - current) < interval?
        
        // Example: Daily (interval 1).
        // Kept: Day 5, 23:00 (lastKept).
        // Current: Day 5, 22:00. Diff = 1hr (0.04 days). < 1. DELETE.
        // Current: Day 4, 23:00. Diff = 24hr (1.0 days). >= 1. KEEP. Update lastKept.
        
        // We initialize lastKeptTimestamp with the first backup we see in the restricted zone?
        // Or we carry over from "recent" zone.
        // The "recent" zone (age < 1 day) keeps everything.
        // The newest backup in the "old" zone (> 1 day) will be the first encountered.
        // We KEEP it. Then compare next ones to it.
        
        // But we need to handle the transition from "Keep All" to "Keep Daily".
        // The lastKeptTimestamp from "Keep All" might be 0.9 days ago.
        // The first backup in "Keep Daily" is 1.1 days ago. Diff 0.2.
        // Should we delete it? No, standard TM keeps "First of the interval".
        // If we go Newest->Oldest, we keep the newest of the interval.
        // So if we transition zones, we should essentially reset the anchor or check against the strategy's grid.
        // BUT simplified logic: Just check distance from last kept.
        
        if (lastKeptTimestamp === now) {
             // First backup encountered (newest overall). Always keep.
             lastKeptTimestamp = ts;
             continue;
        }

        const daysDiff = (lastKeptTimestamp - ts) / msPerDay; // Positive because lastKept is newer
        
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

