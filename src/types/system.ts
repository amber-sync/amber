/**
 * System-related type definitions
 */
import type { SnapshotInfo } from './snapshots';
import type { SyncJob } from './jobs';

export interface DiskStats {
  total: number;
  free: number;
  status: 'AVAILABLE' | 'UNAVAILABLE';
}

/** TIM-47: Volume info for file search palette */
export interface VolumeInfo {
  name: string;
  path: string;
  totalBytes: number;
  freeBytes: number;
  isExternal: boolean;
}

/** TIM-109: Mount detection types */
export interface MountStatus {
  path: string;
  mounted: boolean;
  isExternal: boolean;
  volumeName?: string;
}

/** Preferences type */
export interface AppPreferences {
  runInBackground: boolean;
  startOnBoot: boolean;
  notifications: boolean;
  theme: string;
  accentColor: string;
}

/** TIM-110: Job with mount status and manifest snapshots */
export interface JobWithStatus extends Omit<SyncJob, 'snapshots'> {
  mounted: boolean;
  isExternal: boolean;
  volumeName?: string;
  snapshots: SnapshotInfo[];
  snapshotSource: string;
  cachedAt?: number;
}
