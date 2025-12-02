/**
 * Tauri API abstraction layer for Amber Backup
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type Event } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { desktopDir } from '@tauri-apps/api/path';
import type {
  SyncJob,
  IndexedSnapshot,
  FileNode,
  VolumeInfo,
  DirEntry,
  Snapshot,
  RsyncLogPayload,
  RsyncProgressPayload,
  RsyncCompletePayload,
  AppPreferences,
} from '../types';
import { getErrorMessage } from '../types';

// Event callback types
type RsyncLogCallback = (data: RsyncLogPayload) => void;
type RsyncProgressCallback = (data: RsyncProgressPayload) => void;
type RsyncCompleteCallback = (data: RsyncCompletePayload) => void;

class AmberAPI {
  // ===== Jobs =====

  async getJobs(): Promise<SyncJob[]> {
    return invoke('get_jobs');
  }

  async saveJob(job: SyncJob): Promise<void> {
    return invoke('save_job', { job });
  }

  async deleteJob(jobId: string): Promise<void> {
    return invoke('delete_job', { jobId });
  }

  // ===== Rsync Operations =====

  async runRsync(job: SyncJob): Promise<void> {
    return invoke('run_rsync', { job });
  }

  async killRsync(jobId: string): Promise<void> {
    return invoke('kill_rsync', { jobId });
  }

  onRsyncLog(callback: RsyncLogCallback): () => void {
    let unlisten: (() => void) | null = null;
    listen<RsyncLogPayload>('rsync-log', (event: Event<RsyncLogPayload>) =>
      callback(event.payload)
    ).then(fn => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }

  onRsyncProgress(callback: RsyncProgressCallback): () => void {
    let unlisten: (() => void) | null = null;
    listen<RsyncProgressPayload>('rsync-progress', (event: Event<RsyncProgressPayload>) =>
      callback(event.payload)
    ).then(fn => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }

  onRsyncComplete(callback: RsyncCompleteCallback): () => void {
    let unlisten: (() => void) | null = null;
    listen<RsyncCompletePayload>('rsync-complete', (event: Event<RsyncCompletePayload>) =>
      callback(event.payload)
    ).then(fn => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }

  // ===== Filesystem =====

  async readDir(path: string): Promise<DirEntry[]> {
    return invoke('read_dir', { path });
  }

  async selectDirectory(): Promise<string | null> {
    const selected = await open({ directory: true });
    return selected as string | null;
  }

  async openPath(path: string): Promise<void> {
    return invoke('open_path', { path });
  }

  async showItemInFolder(path: string): Promise<void> {
    return invoke('show_item_in_folder', { path });
  }

  async getDiskStats(path: string): Promise<{
    success: boolean;
    stats?: { total: number; free: number; status: 'AVAILABLE' | 'UNAVAILABLE' };
    error?: string;
  }> {
    try {
      const result = await invoke<{ totalBytes: number; availableBytes: number }>(
        'get_volume_info',
        { path }
      );
      return {
        success: true,
        stats: {
          total: result.totalBytes,
          free: result.availableBytes,
          status: 'AVAILABLE',
        },
      };
    } catch (e: unknown) {
      return { success: false, error: getErrorMessage(e) };
    }
  }

  async readFilePreview(filePath: string, maxLines?: number): Promise<string> {
    return invoke('read_file_preview', { filePath, maxLines });
  }

  async readFileAsBase64(filePath: string): Promise<string> {
    return invoke('read_file_as_base64', { filePath });
  }

  // ===== Volume Search (TIM-47) =====

  /**
   * List mounted external volumes
   */
  async listVolumes(): Promise<VolumeInfo[]> {
    return invoke('list_volumes');
  }

  /**
   * Search files in a volume by pattern (fuzzy match)
   */
  async searchVolume(volumePath: string, pattern: string, limit?: number): Promise<FileNode[]> {
    return invoke('search_volume', { volumePath, pattern, limit });
  }

  // ===== Snapshots =====

  async listSnapshots(jobId: string, destPath: string): Promise<Snapshot[]> {
    return invoke('list_snapshots', { jobId, destPath });
  }

  async getSnapshotTree(
    jobId: string,
    timestamp: number,
    snapshotPath: string
  ): Promise<FileNode[]> {
    return invoke('get_snapshot_tree', { jobId, timestamp, snapshotPath });
  }

  async restoreFiles(
    job: SyncJob,
    snapshotPath: string,
    files: string[],
    targetPath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await invoke('restore_files', { jobId: job.id, snapshotPath, files, targetPath });
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: getErrorMessage(e) };
    }
  }

  async restoreSnapshot(
    job: SyncJob,
    snapshotPath: string,
    targetPath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await invoke('restore_snapshot', { jobId: job.id, snapshotPath, targetPath });
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: getErrorMessage(e) };
    }
  }

  // ===== Snapshot Indexing (TIM-46) =====

  /**
   * Index a snapshot for fast browsing (call after backup completes)
   */
  async indexSnapshot(
    jobId: string,
    timestamp: number,
    snapshotPath: string
  ): Promise<IndexedSnapshot> {
    return invoke('index_snapshot', { jobId, timestamp, snapshotPath });
  }

  /**
   * Check if a snapshot is already indexed
   */
  async isSnapshotIndexed(jobId: string, timestamp: number): Promise<boolean> {
    return invoke('is_snapshot_indexed', { jobId, timestamp });
  }

  /**
   * Get directory contents from SQLite index (fast)
   */
  async getIndexedDirectory(
    jobId: string,
    timestamp: number,
    parentPath: string
  ): Promise<FileNode[]> {
    return invoke('get_indexed_directory', { jobId, timestamp, parentPath });
  }

  /**
   * Search files in a snapshot by pattern
   */
  async searchSnapshotFiles(
    jobId: string,
    timestamp: number,
    pattern: string,
    limit?: number
  ): Promise<FileNode[]> {
    return invoke('search_snapshot_files', { jobId, timestamp, pattern, limit });
  }

  /**
   * Get snapshot statistics from index
   */
  async getSnapshotStats(
    jobId: string,
    timestamp: number
  ): Promise<{ fileCount: number; totalSize: number }> {
    const [fileCount, totalSize] = await invoke<[number, number]>('get_snapshot_stats', {
      jobId,
      timestamp,
    });
    return { fileCount, totalSize };
  }

  /**
   * Delete a snapshot from the index
   */
  async deleteSnapshotIndex(jobId: string, timestamp: number): Promise<void> {
    return invoke('delete_snapshot_index', { jobId, timestamp });
  }

  /**
   * Delete all indexed snapshots for a job
   */
  async deleteJobIndex(jobId: string): Promise<void> {
    return invoke('delete_job_index', { jobId });
  }

  // ===== Preferences =====

  async getPreferences(): Promise<AppPreferences> {
    return invoke('get_preferences');
  }

  async setPreferences(prefs: Partial<AppPreferences>): Promise<AppPreferences> {
    return invoke('set_preferences', { preferences: prefs });
  }

  async testNotification(): Promise<boolean> {
    await invoke('test_notification');
    return true;
  }

  // ===== Rclone (Cloud Backup) =====

  /**
   * Check if rclone is installed and get version info
   */
  async checkRclone(): Promise<{ installed: boolean; version?: string; configPath?: string }> {
    return invoke('check_rclone');
  }

  /**
   * List all configured rclone remotes
   */
  async listRcloneRemotes(): Promise<{ name: string; remoteType: string }[]> {
    return invoke('list_rclone_remotes');
  }

  /**
   * Run an rclone sync job for cloud backup
   */
  async runRclone(job: SyncJob): Promise<void> {
    return invoke('run_rclone', { job });
  }

  /**
   * Kill a running rclone sync job
   */
  async killRclone(jobId: string): Promise<void> {
    return invoke('kill_rclone', { jobId });
  }

  // ===== Utilities =====

  async isDev(): Promise<boolean> {
    return import.meta.env.DEV;
  }

  async getDesktopPath(): Promise<string> {
    return desktopDir();
  }

  // ===== Runtime Info =====

  get runtime(): 'tauri' {
    return 'tauri';
  }
}

// Export singleton instance
export const api = new AmberAPI();

// Export for direct usage
export default api;
