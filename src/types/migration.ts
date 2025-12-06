/**
 * Migration and orphan backup types
 */

/** TIM-118: Orphan backup detection */
export interface DiscoveredBackup {
  backupPath: string;
  jobId: string;
  jobName: string;
  sourcePath: string;
  machineId: string;
  snapshotCount: number;
  hasMatchingJob: boolean;
}

/** TIM-113: Migration types */
export interface JobMigrationResult {
  jobId: string;
  jobName: string;
  snapshotsMigrated: number;
  manifestWritten: boolean;
  cacheWritten: boolean;
  error?: string;
}

export interface MigrationReport {
  jobsMigrated: number;
  jobsSkipped: number;
  totalSnapshotsMigrated: number;
  manifestsWritten: number;
  cachesWritten: number;
  results: JobMigrationResult[];
}
