/**
 * TIM-186: Tauri API abstraction layer for Amber Backup
 *
 * This barrel file re-exports all API functions from domain-specific modules
 * and provides a backward-compatible `api` singleton for existing consumers.
 */

// Re-export all functions from domain modules
export * from '../features/jobs/api';
export * from './snapshots';
export * from './filesystem';
export * from './rsync';
export * from './system';

// Import for building the backward-compatible api object
import * as jobs from '../features/jobs/api';
import * as snapshots from './snapshots';
import * as filesystem from './filesystem';
import * as rsync from './rsync';
import * as system from './system';

/**
 * Backward-compatible API facade
 *
 * @deprecated Prefer importing functions directly:
 *   import { getJobs, saveJob } from '../api/jobs';
 *   import { listSnapshots } from '../api/snapshots';
 *
 * The api singleton is maintained for backward compatibility with existing code.
 */
export const api = {
  // ===== Jobs =====
  getJobs: jobs.getJobs,
  getJobsWithStatus: jobs.getJobsWithStatus,
  saveJob: jobs.saveJob,
  deleteJob: jobs.deleteJob,
  deleteJobData: jobs.deleteJobData,
  scanForBackups: jobs.scanForBackups,
  findOrphanBackups: jobs.findOrphanBackups,
  importBackupAsJob: jobs.importBackupAsJob,

  // ===== Rsync Operations =====
  runRsync: rsync.runRsync,
  killRsync: rsync.killRsync,
  onRsyncLog: rsync.onRsyncLog,
  onRsyncProgress: rsync.onRsyncProgress,
  onRsyncComplete: rsync.onRsyncComplete,
  checkRclone: rsync.checkRclone,
  listRcloneRemotes: rsync.listRcloneRemotes,
  runRclone: rsync.runRclone,
  killRclone: rsync.killRclone,

  // ===== Filesystem =====
  readDir: filesystem.readDir,
  selectDirectory: filesystem.selectDirectory,
  openPath: filesystem.openPath,
  showItemInFolder: filesystem.showItemInFolder,
  getDiskStats: filesystem.getDiskStats,
  readFilePreview: filesystem.readFilePreview,
  readFileAsBase64: filesystem.readFileAsBase64,
  getDesktopPath: filesystem.getDesktopPath,
  listVolumes: filesystem.listVolumes,
  searchVolume: filesystem.searchVolume,
  isPathMounted: filesystem.isPathMounted,
  checkDestinations: filesystem.checkDestinations,

  // ===== Snapshots =====
  listSnapshots: snapshots.listSnapshots,
  listSnapshotsInRange: snapshots.listSnapshotsInRange,
  listSnapshotsInRangeOnDestination: snapshots.listSnapshotsInRangeOnDestination,
  getJobAggregateStats: snapshots.getJobAggregateStats,
  getJobAggregateStatsOnDestination: snapshots.getJobAggregateStatsOnDestination,
  getSnapshotDensity: snapshots.getSnapshotDensity,
  getSnapshotDensityOnDestination: snapshots.getSnapshotDensityOnDestination,
  getSnapshotTree: snapshots.getSnapshotTree,
  restoreFiles: snapshots.restoreFiles,
  restoreSnapshot: snapshots.restoreSnapshot,
  indexSnapshot: snapshots.indexSnapshot,
  isSnapshotIndexed: snapshots.isSnapshotIndexed,
  getIndexedDirectory: snapshots.getIndexedDirectory,
  getIndexedDirectoryPaginated: snapshots.getIndexedDirectoryPaginated,
  searchSnapshotFiles: snapshots.searchSnapshotFiles,
  searchFilesGlobal: snapshots.searchFilesGlobal,
  getSnapshotStats: snapshots.getSnapshotStats,
  getFileTypeStats: snapshots.getFileTypeStats,
  getLargestFiles: snapshots.getLargestFiles,
  deleteSnapshotIndex: snapshots.deleteSnapshotIndex,
  deleteJobIndex: snapshots.deleteJobIndex,
  getDestinationIndexPath: snapshots.getDestinationIndexPath,
  destinationHasIndex: snapshots.destinationHasIndex,
  exportIndexToDestination: snapshots.exportIndexToDestination,
  indexSnapshotOnDestination: snapshots.indexSnapshotOnDestination,
  getDirectoryFromDestination: snapshots.getDirectoryFromDestination,
  isIndexedOnDestination: snapshots.isIndexedOnDestination,
  searchFilesOnDestination: snapshots.searchFilesOnDestination,
  getFileTypeStatsOnDestination: snapshots.getFileTypeStatsOnDestination,
  getLargestFilesOnDestination: snapshots.getLargestFilesOnDestination,
  deleteSnapshotFromDestination: snapshots.deleteSnapshotFromDestination,
  compareSnapshots: snapshots.compareSnapshots,
  pruneSnapshot: snapshots.pruneSnapshot,

  // ===== System & Preferences =====
  getPreferences: system.getPreferences,
  setPreferences: system.setPreferences,
  testNotification: system.testNotification,
  isDev: system.isDev,
  devSeedData: system.devSeedData,
  devRunBenchmarks: system.devRunBenchmarks,
  devChurnData: system.devChurnData,
  devClearData: system.devClearData,
  devDbStats: system.devDbStats,
  getManifest: system.getManifest,
  getOrCreateManifest: system.getOrCreateManifest,
  manifestExists: system.manifestExists,
  addManifestSnapshot: system.addManifestSnapshot,
  removeManifestSnapshot: system.removeManifestSnapshot,
  getAmberMetaPath: system.getAmberMetaPath,
  needsMigration: system.needsMigration,
  runMigration: system.runMigration,

  // ===== Runtime Info =====
  get runtime(): 'tauri' {
    return 'tauri';
  },
};

// Default export for backward compatibility
export default api;
