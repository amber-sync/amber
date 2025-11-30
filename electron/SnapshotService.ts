import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';
import log from 'electron-log';
import { FileService, FileEntry } from './FileService';
import { CONSTANTS } from './constants';

export interface SnapshotMetadata {
  id: string; // usually timestamp
  timestamp: number;
  date: string;
  sizeBytes: number;
  fileCount: number;
  path: string;
}

export interface FileNode {
  id: string;
  name: string;
  type: 'FILE' | 'FOLDER';
  size: number;
  modified: number;
  children?: FileNode[];
  path: string; // Full path for restore
}

export class SnapshotService {
  private cacheDir: string;
  private fileService: FileService;

  constructor(fileService: FileService) {
    this.fileService = fileService;
    this.cacheDir = path.join(app.getPath('userData'), 'snapshot-cache');
    this.ensureCacheDir();
  }

  private async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      log.error(`Failed to create snapshot cache dir: ${error}`);
    }
  }

  private getCachePath(jobId: string, timestamp: number): string {
    return path.join(this.cacheDir, `${jobId}-${timestamp}.json`);
  }

  /**
   * Scans a backup snapshot and caches the file tree.
   * Uses the sidecar for speed.
   */
  async indexSnapshot(jobId: string, timestamp: number, snapshotPath: string): Promise<void> {
    const cachePath = this.getCachePath(jobId, timestamp);
    
    // Check if already cached
    try {
      await fs.access(cachePath);
      // log.info(`Snapshot ${timestamp} already indexed.`);
      return; 
    } catch {
      // Not cached, proceed
    }

    log.info(`Indexing snapshot: ${snapshotPath}`);
    const entries: FileEntry[] = [];

    try {
      // Use sidecar to scan
      log.info(`Scanning path with sidecar: ${snapshotPath}`);
      await this.fileService.search(snapshotPath, '', (entry) => {
        entries.push(entry);
      }, (err) => {
        log.error(`Error indexing snapshot ${snapshotPath}: ${err}`);
      });
      
      if (entries.length === 0) {
        log.warn(`Sidecar returned 0 entries for ${snapshotPath}. Is the sidecar working?`);
      } else {
        log.info(`Sidecar found ${entries.length} entries for ${snapshotPath}`);
      }

      // Build tree
      const tree = this.buildFileTree(snapshotPath, entries);
      
      // Calculate stats
      const stats = this.calculateStats(tree);

      const data = {
        timestamp,
        stats,
        tree
      };

      // Write to cache
      await fs.writeFile(cachePath, JSON.stringify(data));
      log.info(`Indexed snapshot ${timestamp}: ${entries.length} files`);

    } catch (error) {
      log.error(`Failed to index snapshot ${snapshotPath}: ${error}`);
      throw error;
    }
  }

  /**
   * Retrieves the cached file tree for a snapshot.
   * If not cached, it attempts to index it first (on-demand).
   */
  async getSnapshotTree(jobId: string, timestamp: number, snapshotPath: string): Promise<FileNode[]> {
    const cachePath = this.getCachePath(jobId, timestamp);

    try {
      const data = await fs.readFile(cachePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.tree;
    } catch (error) {
      log.warn(`Snapshot cache miss for ${timestamp}, indexing now...`);
      await this.indexSnapshot(jobId, timestamp, snapshotPath);
      
      // Retry read
      const data = await fs.readFile(cachePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.tree;
    }
  }

  /**
   * Lists available snapshots for a job by scanning the destination directory.
   * Returns metadata (timestamp, size, etc.)
   */
  async listSnapshots(jobId: string, destPath: string): Promise<SnapshotMetadata[]> {
    try {
      // Scan destination for timestamp folders
      // Expected format: YYYY-MM-DD-HHMMSS
      const entries = await fs.readdir(destPath, { withFileTypes: true });
      const snapshots: SnapshotMetadata[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!CONSTANTS.BACKUP_DIR_PATTERN.test(entry.name)) continue;

        const date = this.parseDate(entry.name);
        if (!date) continue;

        const timestamp = date.getTime();
        const fullPath = path.join(destPath, entry.name);

        // Check if we have cached stats
        let sizeBytes = 0;
        let fileCount = 0;
        
        try {
          const cachePath = this.getCachePath(jobId, timestamp);
          const cacheData = JSON.parse(await fs.readFile(cachePath, 'utf-8'));
          sizeBytes = cacheData.stats.sizeBytes;
          fileCount = cacheData.stats.fileCount;
          // log.info(`Loaded cached stats for ${timestamp}: ${fileCount} files, ${sizeBytes} bytes`);
        } catch {
          log.warn(`Cache miss for snapshot ${timestamp}. Indexing now...`);
          try {
            await this.indexSnapshot(jobId, timestamp, fullPath);
            // Retry read
            const cachePath = this.getCachePath(jobId, timestamp);
            const cacheData = JSON.parse(await fs.readFile(cachePath, 'utf-8'));
            sizeBytes = cacheData.stats.sizeBytes;
            fileCount = cacheData.stats.fileCount;
            log.info(`Indexed and loaded stats for ${timestamp}: ${fileCount} files`);
          } catch (err) {
            log.error(`Failed to index snapshot ${timestamp} on-demand: ${err}`);
          }
        }

        snapshots.push({
          id: timestamp.toString(),
          timestamp,
          date: date.toISOString(),
          sizeBytes,
          fileCount,
          path: fullPath
        });
      }

      // Sort by timestamp descending (newest first)
      return snapshots.sort((a, b) => b.timestamp - a.timestamp);

    } catch (error) {
      log.error(`Failed to list snapshots for job ${jobId}: ${error}`);
      return [];
    }
  }

  private parseDate(folderName: string): Date | null {
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

  // Reusing tree building logic from RsyncService, but returning FileNode
  private buildFileTree(rootDir: string, entries: FileEntry[]): FileNode[] {
    const tree: FileNode[] = [];
    const map = new Map<string, FileNode>();

    const normalizedRoot = rootDir.endsWith(path.sep) ? rootDir.slice(0, -1) : rootDir;

    for (const entry of entries) {
      if (entry.path === normalizedRoot) continue;

      const relativePath = path.relative(normalizedRoot, entry.path);
      const parts = relativePath.split(path.sep);
      const name = parts[parts.length - 1];
      
      const node: FileNode = {
        id: `${path.basename(normalizedRoot)}-${relativePath}`,
        name: name,
        type: entry.is_dir ? 'FOLDER' : 'FILE',
        size: entry.size,
        modified: entry.modified,
        children: entry.is_dir ? [] : undefined,
        path: entry.path
      };
      
      map.set(entry.path, node);
    }

    for (const entry of entries) {
      if (entry.path === normalizedRoot) continue;
      
      const node = map.get(entry.path);
      if (!node) continue;

      const parentPath = path.dirname(entry.path);
      
      if (parentPath === normalizedRoot) {
        tree.push(node);
      } else {
        const parent = map.get(parentPath);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      }
    }

    return tree;
  }

  private calculateStats(nodes: FileNode[]): { sizeBytes: number, fileCount: number } {
    let size = 0;
    let count = 0;
    for (const node of nodes) {
      if (node.type === 'FOLDER' && node.children) {
        const sub = this.calculateStats(node.children);
        size += sub.sizeBytes;
        count += sub.fileCount;
      } else {
        size += node.size;
        count++;
      }
    }
    return { sizeBytes: size, fileCount: count };
  }
}
