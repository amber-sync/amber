/**
 * TIM-186: Snapshot-related API operations
 * Extracted from monolithic AmberAPI class for better organization
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  SyncJob,
  Snapshot,
  IndexedSnapshot,
  FileNode,
  GlobalSearchResult,
  FileTypeStats,
  LargestFile,
  JobAggregateStats,
  SnapshotDensity,
  DirectoryContents,
} from '../types';
import { getErrorMessage } from '../types';

// ===== Snapshots =====

export async function listSnapshots(jobId: string, destPath: string): Promise<Snapshot[]> {
  return invoke('list_snapshots', { jobId, destPath });
}

/**
 * List snapshots within a date range (for Time Explorer filtering)
 * TIM-126: Queries SQLite index for fast filtering
 */
export async function listSnapshotsInRange(
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
export async function listSnapshotsInRangeOnDestination(
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
export async function getJobAggregateStats(jobId: string): Promise<JobAggregateStats> {
  return invoke('get_job_aggregate_stats', { jobId });
}

/**
 * Get aggregate statistics for a job from destination's index
 */
export async function getJobAggregateStatsOnDestination(
  destPath: string,
  jobId: string
): Promise<JobAggregateStats> {
  return invoke('get_job_aggregate_stats_on_destination', { destPath, jobId });
}

/**
 * Get snapshot density grouped by period (TIM-128: for calendar/timeline)
 * @param period - "day", "week", "month", or "year"
 */
export async function getSnapshotDensity(
  jobId: string,
  period: string
): Promise<SnapshotDensity[]> {
  return invoke('get_snapshot_density', { jobId, period });
}

/**
 * Get snapshot density from destination's index
 */
export async function getSnapshotDensityOnDestination(
  destPath: string,
  jobId: string,
  period: string
): Promise<SnapshotDensity[]> {
  return invoke('get_snapshot_density_on_destination', { destPath, jobId, period });
}

export async function getSnapshotTree(
  jobId: string,
  timestamp: number,
  snapshotPath: string
): Promise<FileNode[]> {
  return invoke('get_snapshot_tree', { jobId, timestamp, snapshotPath });
}

export async function restoreFiles(
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

export async function restoreSnapshot(
  job: SyncJob,
  snapshotPath: string,
  targetPath: string,
  mirror: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    await invoke('restore_snapshot', { jobId: job.id, snapshotPath, targetPath, mirror });
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ===== Snapshot Indexing (TIM-46) =====

/**
 * Index a snapshot for fast browsing (call after backup completes)
 */
export async function indexSnapshot(
  jobId: string,
  timestamp: number,
  snapshotPath: string
): Promise<IndexedSnapshot> {
  return invoke('index_snapshot', { jobId, timestamp, snapshotPath });
}

/**
 * Check if a snapshot is already indexed
 */
export async function isSnapshotIndexed(jobId: string, timestamp: number): Promise<boolean> {
  return invoke('is_snapshot_indexed', { jobId, timestamp });
}

/**
 * Get directory contents from SQLite index (fast)
 */
export async function getIndexedDirectory(
  jobId: string,
  timestamp: number,
  parentPath: string
): Promise<FileNode[]> {
  return invoke('get_indexed_directory', { jobId, timestamp, parentPath });
}

/**
 * Get directory contents from SQLite index with pagination (for large directories)
 */
export async function getIndexedDirectoryPaginated(
  jobId: string,
  timestamp: number,
  parentPath: string,
  limit?: number,
  offset?: number
): Promise<DirectoryContents> {
  return invoke('get_indexed_directory_paginated', {
    jobId,
    timestamp,
    parentPath,
    limit,
    offset,
  });
}

/**
 * Search files in a snapshot by pattern
 */
export async function searchSnapshotFiles(
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
export async function searchFilesGlobal(
  pattern: string,
  jobId?: string,
  limit?: number
): Promise<GlobalSearchResult[]> {
  return invoke('search_files_global', { pattern, jobId, limit });
}

/**
 * Get snapshot statistics from index
 */
export async function getSnapshotStats(
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
export async function getFileTypeStats(
  jobId: string,
  timestamp: number,
  limit?: number
): Promise<FileTypeStats[]> {
  return invoke('get_file_type_stats', { jobId, timestamp, limit });
}

/**
 * Get largest files in a snapshot (for analytics)
 */
export async function getLargestFiles(
  jobId: string,
  timestamp: number,
  limit?: number
): Promise<LargestFile[]> {
  return invoke('get_largest_files', { jobId, timestamp, limit });
}

/**
 * Delete a snapshot from the index
 */
export async function deleteSnapshotIndex(jobId: string, timestamp: number): Promise<void> {
  return invoke('delete_snapshot_index', { jobId, timestamp });
}

/**
 * Delete all indexed snapshots for a job
 */
export async function deleteJobIndex(jobId: string): Promise<void> {
  return invoke('delete_job_index', { jobId });
}

// ===== Destination Index (TIM-112) =====

/**
 * Get the path to the index database on a destination drive
 */
export async function getDestinationIndexPath(destPath: string): Promise<string> {
  return invoke('get_destination_index_path', { destPath });
}

/**
 * Check if a destination has an index database
 */
export async function destinationHasIndex(destPath: string): Promise<boolean> {
  return invoke('destination_has_index', { destPath });
}

/**
 * Export the local index database to the destination drive
 */
export async function exportIndexToDestination(destPath: string): Promise<void> {
  return invoke('export_index_to_destination', { destPath });
}

// ===== TIM-127: Destination-based Index Operations =====

/**
 * Index a snapshot and store in destination's .amber-meta/index.db
 */
export async function indexSnapshotOnDestination(
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
export async function getDirectoryFromDestination(
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
export async function isIndexedOnDestination(
  destPath: string,
  jobId: string,
  timestamp: number
): Promise<boolean> {
  return invoke('is_indexed_on_destination', { destPath, jobId, timestamp });
}

/**
 * Search files in destination's index
 */
export async function searchFilesOnDestination(
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
export async function getFileTypeStatsOnDestination(
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
export async function getLargestFilesOnDestination(
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
export async function deleteSnapshotFromDestination(
  destPath: string,
  jobId: string,
  timestamp: number
): Promise<void> {
  return invoke('delete_snapshot_from_destination', { destPath, jobId, timestamp });
}
