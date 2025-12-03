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
  FileTypeStats,
  LargestFile,
  JobAggregateStats,
  DevSeedResult,
  DevBenchmarkResult,
  DevDbStats,
  BackupManifest,
  ManifestSnapshot,
  ManifestSnapshotStatus,
  MountStatus,
  JobWithStatus,
  DiscoveredBackup,
  MigrationReport,
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

  /**
   * Get jobs with mount status and snapshots from manifests
   * This is the preferred endpoint for the UI - includes live mount detection
   * and loads snapshots from manifest.json when destination is mounted
   */
  async getJobsWithStatus(): Promise<JobWithStatus[]> {
    return invoke('get_jobs_with_status');
  }

  async saveJob(job: SyncJob): Promise<void> {
    return invoke('save_job', { job });
  }

  async deleteJob(jobId: string): Promise<void> {
    return invoke('delete_job', { jobId });
  }

  /**
   * Delete backup data from the destination path
   * This permanently removes all snapshots from the backup drive
   */
  async deleteJobData(destPath: string): Promise<void> {
    return invoke('delete_job_data', { destPath });
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

  // ===== Orphan Backup Detection (TIM-118) =====

  /**
   * Scan a volume for Amber backup folders
   * Returns all backups found, marking which have matching jobs
   */
  async scanForBackups(volumePath: string, knownJobIds: string[]): Promise<DiscoveredBackup[]> {
    return invoke('scan_for_backups', { volumePath, knownJobIds });
  }

  /**
   * Scan all mounted volumes for orphan backups (backups without matching jobs)
   */
  async findOrphanBackups(knownJobIds: string[]): Promise<DiscoveredBackup[]> {
    return invoke('find_orphan_backups', { knownJobIds });
  }

  /**
   * Import an orphan backup by creating a job from its manifest
   * Returns a SyncJob that can be saved with saveJob()
   */
  async importBackupAsJob(backupPath: string): Promise<SyncJob> {
    return invoke('import_backup_as_job', { backupPath });
  }

  // ===== Snapshots =====

  async listSnapshots(jobId: string, destPath: string): Promise<Snapshot[]> {
    return invoke('list_snapshots', { jobId, destPath });
  }

  /**
   * List snapshots within a date range (for Time Explorer filtering)
   * TIM-126: Queries SQLite index for fast filtering
   */
  async listSnapshotsInRange(
    jobId: string,
    startMs: number,
    endMs: number
  ): Promise<IndexedSnapshot[]> {
    return invoke('list_snapshots_in_range', { jobId, startMs, endMs });
  }

  /**
   * List snapshots within a date range from destination's index
   * TIM-126: Queries destination-based SQLite index
   */
  async listSnapshotsInRangeOnDestination(
    destPath: string,
    jobId: string,
    startMs: number,
    endMs: number
  ): Promise<IndexedSnapshot[]> {
    return invoke('list_snapshots_in_range_on_destination', {
      destPath,
      jobId,
      startMs,
      endMs,
    });
  }

  /**
   * Get aggregate statistics for a job (TIM-127: for Time Explorer stats panel)
   */
  async getJobAggregateStats(jobId: string): Promise<JobAggregateStats> {
    return invoke('get_job_aggregate_stats', { jobId });
  }

  /**
   * Get aggregate statistics for a job from destination's index
   */
  async getJobAggregateStatsOnDestination(
    destPath: string,
    jobId: string
  ): Promise<JobAggregateStats> {
    return invoke('get_job_aggregate_stats_on_destination', { destPath, jobId });
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
  ): Promise<FileTypeStats[]> {
    return invoke('get_file_type_stats', { jobId, timestamp, limit });
  }

  /**
   * Get largest files in a snapshot (for analytics)
   */
  async getLargestFiles(jobId: string, timestamp: number, limit?: number): Promise<LargestFile[]> {
    return invoke('get_largest_files', { jobId, timestamp, limit });
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

  // ===== Destination Index (TIM-112) =====

  /**
   * Get the path to the index database on a destination drive
   */
  async getDestinationIndexPath(destPath: string): Promise<string> {
    return invoke('get_destination_index_path', { destPath });
  }

  /**
   * Check if a destination has an index database
   */
  async destinationHasIndex(destPath: string): Promise<boolean> {
    return invoke('destination_has_index', { destPath });
  }

  /**
   * Export the local index database to the destination drive
   */
  async exportIndexToDestination(destPath: string): Promise<void> {
    return invoke('export_index_to_destination', { destPath });
  }

  // ===== TIM-127: Destination-based Index Operations =====
  // These methods operate directly on the destination drive's index.db

  /**
   * Index a snapshot and store in destination's .amber-meta/index.db
   * This is the primary indexing method for destination-centric architecture
   */
  async indexSnapshotOnDestination(
    destPath: string,
    jobId: string,
    timestamp: number,
    snapshotPath: string
  ): Promise<IndexedSnapshot> {
    return invoke('index_snapshot_on_destination', { destPath, jobId, timestamp, snapshotPath });
  }

  /**
   * Get directory contents from destination's index
   */
  async getDirectoryFromDestination(
    destPath: string,
    jobId: string,
    timestamp: number,
    parentPath: string
  ): Promise<FileNode[]> {
    return invoke('get_directory_from_destination', { destPath, jobId, timestamp, parentPath });
  }

  /**
   * Check if a snapshot is indexed on the destination
   */
  async isIndexedOnDestination(
    destPath: string,
    jobId: string,
    timestamp: number
  ): Promise<boolean> {
    return invoke('is_indexed_on_destination', { destPath, jobId, timestamp });
  }

  /**
   * Search files in destination's index
   */
  async searchFilesOnDestination(
    destPath: string,
    jobId: string,
    timestamp: number,
    pattern: string,
    limit?: number
  ): Promise<FileNode[]> {
    return invoke('search_files_on_destination', { destPath, jobId, timestamp, pattern, limit });
  }

  /**
   * Get file type stats from destination's index
   */
  async getFileTypeStatsOnDestination(
    destPath: string,
    jobId: string,
    timestamp: number,
    limit?: number
  ): Promise<FileTypeStats[]> {
    return invoke('get_file_type_stats_on_destination', { destPath, jobId, timestamp, limit });
  }

  /**
   * Get largest files from destination's index
   */
  async getLargestFilesOnDestination(
    destPath: string,
    jobId: string,
    timestamp: number,
    limit?: number
  ): Promise<LargestFile[]> {
    return invoke('get_largest_files_on_destination', { destPath, jobId, timestamp, limit });
  }

  /**
   * Delete snapshot from destination's index
   */
  async deleteSnapshotFromDestination(
    destPath: string,
    jobId: string,
    timestamp: number
  ): Promise<void> {
    return invoke('delete_snapshot_from_destination', { destPath, jobId, timestamp });
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

  // ===== Migration (TIM-113) =====

  /**
   * Check if migration from embedded snapshots is needed
   */
  async needsMigration(): Promise<boolean> {
    return invoke('needs_migration');
  }

  /**
   * Run migration from embedded snapshots to manifest-based architecture
   * Returns a report of what was migrated
   */
  async runMigration(): Promise<MigrationReport> {
    return invoke('run_migration');
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
