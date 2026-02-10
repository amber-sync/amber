/**
 * TIM-186: System and preferences API operations
 * Extracted from monolithic AmberAPI class for better organization
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  AppPreferences,
  BackupManifest,
  ManifestSnapshot,
  ManifestSnapshotStatus,
  MigrationReport,
  DevSeedResult,
  DevBenchmarkResult,
  DevChurnResult,
  DevDbStats,
} from '../types';

// ===== Preferences =====

export async function getPreferences(): Promise<AppPreferences> {
  return invoke('get_preferences');
}

export async function setPreferences(prefs: Partial<AppPreferences>): Promise<AppPreferences> {
  return invoke('set_preferences', { preferences: prefs });
}

export async function testNotification(): Promise<boolean> {
  return invoke('test_notification');
}

// ===== Utilities =====

export async function isDev(): Promise<boolean> {
  return import.meta.env.DEV;
}

// ===== Dev Tools (only available in dev mode) =====

/**
 * Seed the database with realistic mock data for testing
 */
export async function devSeedData(): Promise<DevSeedResult> {
  return invoke('dev_seed_data');
}

/**
 * Run performance benchmarks on the seeded data
 */
export async function devRunBenchmarks(): Promise<DevBenchmarkResult[]> {
  return invoke('dev_run_benchmarks');
}

/**
 * Apply churn (add/modify/delete files) to dev job source directories
 */
export async function devChurnData(): Promise<DevChurnResult> {
  return invoke('dev_churn_data');
}

/**
 * Clear all dev seeded data and delete playground directory
 */
export async function devClearData(): Promise<void> {
  return invoke('dev_clear_data');
}

/**
 * Get database statistics
 */
export async function devDbStats(): Promise<DevDbStats> {
  return invoke('dev_db_stats');
}

// ===== Manifest API (TIM-114: Repository-centric architecture) =====

/**
 * Get manifest from a backup destination
 * Returns null if no manifest exists
 */
export async function getManifest(destPath: string): Promise<BackupManifest | null> {
  return invoke('get_manifest', { destPath });
}

/**
 * Get or create a manifest for a job
 */
export async function getOrCreateManifest(
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
export async function manifestExists(destPath: string): Promise<boolean> {
  return invoke('manifest_exists', { destPath });
}

/**
 * Add a snapshot to the manifest
 */
export async function addManifestSnapshot(
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
export async function removeManifestSnapshot(
  destPath: string,
  snapshotId: string
): Promise<ManifestSnapshot | null> {
  return invoke('remove_manifest_snapshot', { destPath, snapshotId });
}

/**
 * Get the .amber-meta directory path for a destination
 */
export async function getAmberMetaPath(destPath: string): Promise<string> {
  return invoke('get_amber_meta_path', { destPath });
}

// ===== Migration (TIM-113) =====

/**
 * Check if migration from embedded snapshots is needed
 */
export async function needsMigration(): Promise<boolean> {
  return invoke('needs_migration');
}

/**
 * Run migration from embedded snapshots to manifest-based architecture
 */
export async function runMigration(): Promise<MigrationReport> {
  return invoke('run_migration');
}
