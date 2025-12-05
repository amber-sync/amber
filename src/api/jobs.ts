/**
 * TIM-186: Job-related API operations
 * Extracted from monolithic AmberAPI class for better organization
 */

import { invoke } from '@tauri-apps/api/core';
import type { SyncJob, JobWithStatus, DiscoveredBackup } from '../types';

// ===== Job CRUD =====

export async function getJobs(): Promise<SyncJob[]> {
  return invoke('get_jobs');
}

/**
 * Get jobs with mount status and snapshots from manifests
 * This is the preferred endpoint for the UI - includes live mount detection
 * and loads snapshots from manifest.json when destination is mounted
 */
export async function getJobsWithStatus(): Promise<JobWithStatus[]> {
  return invoke('get_jobs_with_status');
}

export async function saveJob(job: SyncJob): Promise<void> {
  return invoke('save_job', { job });
}

export async function deleteJob(jobId: string): Promise<void> {
  return invoke('delete_job', { jobId });
}

/**
 * Delete backup data from the destination path
 * This permanently removes all snapshots from the backup drive
 */
export async function deleteJobData(destPath: string): Promise<void> {
  return invoke('delete_job_data', { destPath });
}

// ===== Orphan Backup Detection (TIM-118) =====

/**
 * Scan a volume for Amber backup folders
 * Returns all backups found, marking which have matching jobs
 */
export async function scanForBackups(
  volumePath: string,
  knownJobIds: string[]
): Promise<DiscoveredBackup[]> {
  return invoke('scan_for_backups', { volumePath, knownJobIds });
}

/**
 * Scan all mounted volumes for orphan backups (backups without matching jobs)
 */
export async function findOrphanBackups(knownJobIds: string[]): Promise<DiscoveredBackup[]> {
  return invoke('find_orphan_backups', { knownJobIds });
}

/**
 * Import an orphan backup by creating a job from its manifest
 * Returns a SyncJob that can be saved with saveJob()
 */
export async function importBackupAsJob(backupPath: string): Promise<SyncJob> {
  return invoke('import_backup_as_job', { backupPath });
}
