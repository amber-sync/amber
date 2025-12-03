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
  GlobalSearchResult,
  DevSeedResult,
  DevBenchmarkResult,
  DevDbStats,
  BackupManifest,
  ManifestSnapshot,
  ManifestSnapshotStatus,
  MountStatus,
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

  // ===== Mount Detection (TIM-109) =====

  /**
   * Check if a single path is accessible/mounted
   */
  async isPathMounted(path: string): Promise<MountStatus> {
    return invoke('is_path_mounted', { path });
  }

  /**
   * Check mount status for multiple destination paths at once
   * More efficient than calling isPathMounted for each path
   */
  async checkDestinations(paths: string[]): Promise<MountStatus[]> {
    return invoke('check_destinations', { paths });
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
   * Search files globally across ALL snapshots using FTS5
   * This is blazing fast - sub-millisecond even with millions of files
   */
  async searchFilesGlobal(
    pattern: string,
    jobId?: string,
    limit?: number
  ): Promise<GlobalSearchResult[]> {
    return invoke('search_files_global', { pattern, jobId, limit });
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
   * Get file type statistics for a snapshot (aggregated by extension)
   */
  async getFileTypeStats(
    jobId: string,
    timestamp: number,
    limit?: number
  ): Promise<{ extension: string; count: number; totalSize: number }[]> {
    return invoke('get_file_type_stats', { jobId, timestamp, limit });
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

  // ===== Dev Tools (only available in dev mode) =====

  /**
   * Seed the database with realistic mock data for testing
   * Creates 2 jobs with ~50 snapshots total and millions of file entries
   */
  async devSeedData(): Promise<DevSeedResult> {
    return invoke('dev_seed_data');
  }

  /**
   * Run performance benchmarks on the seeded data
   */
  async devRunBenchmarks(): Promise<DevBenchmarkResult[]> {
    return invoke('dev_run_benchmarks');
  }

  /**
   * Clear all dev seeded data
   */
  async devClearData(): Promise<void> {
    return invoke('dev_clear_data');
  }

  /**
   * Get database statistics
   */
  async devDbStats(): Promise<DevDbStats> {
    return invoke('dev_db_stats');
  }

  async getDesktopPath(): Promise<string> {
    return desktopDir();
  }

  // ===== Manifest API (TIM-114: Repository-centric architecture) =====

  /**
   * Get manifest from a backup destination
   * Returns null if no manifest exists
   */
  async getManifest(destPath: string): Promise<BackupManifest | null> {
    return invoke('get_manifest', { destPath });
  }

  /**
   * Get or create a manifest for a job
   * Creates a new manifest if one doesn't exist
   */
  async getOrCreateManifest(
    destPath: string,
    jobId: string,
    jobName: string,
    sourcePath: string
  ): Promise<BackupManifest> {
    return invoke('get_or_create_manifest', { destPath, jobId, jobName, sourcePath });
  }

  /**
   * Check if a manifest exists at the destination
   */
  async manifestExists(destPath: string): Promise<boolean> {
    return invoke('manifest_exists', { destPath });
  }

  /**
   * Add a snapshot to the manifest
   */
  async addManifestSnapshot(
    destPath: string,
    folderName: string,
    fileCount: number,
    totalSize: number,
    status: ManifestSnapshotStatus,
    durationMs?: number
  ): Promise<BackupManifest> {
    return invoke('add_manifest_snapshot', {
      destPath,
      folderName,
      fileCount,
      totalSize,
      status,
      durationMs,
    });
  }

  /**
   * Remove a snapshot from the manifest
   */
  async removeManifestSnapshot(
    destPath: string,
    snapshotId: string
  ): Promise<ManifestSnapshot | null> {
    return invoke('remove_manifest_snapshot', { destPath, snapshotId });
  }

  /**
   * Get the .amber-meta directory path for a destination
   */
  async getAmberMetaPath(destPath: string): Promise<string> {
    return invoke('get_amber_meta_path', { destPath });
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
