/**
 * Centralized type exports
 * Import all types from this barrel file: import { SyncJob, Snapshot } from '@/types';
 */

// Jobs
export {
  SyncMode,
  DestinationType,
  JobStatus,
  type RsyncConfig,
  type SshConfig,
  type CloudConfig,
  type JobSchedule,
  type SyncJob,
  type JobMountInfo,
  type JobAggregateStats,
} from './jobs';

// Snapshots
export {
  type Snapshot,
  type IndexedSnapshot,
  type SnapshotInfo,
  type SnapshotDensity,
  type DirectoryContents,
  type ManifestSnapshotStatus,
  type ManifestSnapshot,
  type BackupManifest,
  type DiffEntry,
  type DiffSummary,
  type SnapshotDiff,
} from './snapshots';

// Files
export {
  FILE_TYPE,
  type FileType,
  isDirectory,
  isFile,
  type FileNode,
  type DirEntry,
  type IndexedDirEntry,
  type ReadDirEntry,
  type FileTypeStats,
  type LargestFile,
  type GlobalSearchResult,
} from './files';

// System
export {
  type DiskStats,
  type VolumeInfo,
  type MountStatus,
  type AppPreferences,
  type JobWithStatus,
} from './system';

// Rsync
export {
  type LogEntry,
  type RsyncProgressData,
  type BackupResult,
  type RsyncLogPayload,
  type RsyncProgressPayload,
  type RsyncCompletePayload,
  type RsyncStartedPayload,
  isRsyncProgress,
  isBackupResult,
} from './rsync';

// Dev
export {
  type DevSeedResult,
  type DevBenchmarkResult,
  type DevChurnResult,
  type DevDbStats,
} from './dev';

// Migration
export { type DiscoveredBackup, type JobMigrationResult, type MigrationReport } from './migration';

// Helper functions
import type { SyncJob } from './jobs';
import type { Snapshot } from './snapshots';

/**
 * Helper to safely get snapshots from a job.
 */
export function getJobSnapshots(job: SyncJob): Snapshot[] {
  return job.snapshots ?? [];
}

/**
 * Error extraction helper
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}
