/**
 * Snapshot-related type definitions
 */
import type { FileNode } from './files';

export interface Snapshot {
  id: string;
  timestamp: number;
  sizeBytes: number;
  fileCount: number;
  changesCount: number;
  status: 'Complete' | 'Partial' | 'Failed';
  duration?: number;
  restored?: boolean;
  restoredDate?: number;
  path?: string;
  root?: FileNode[];
}

/** TIM-46: SQLite indexed snapshot metadata */
export interface IndexedSnapshot {
  id: number;
  jobId: string;
  timestamp: number;
  rootPath: string;
  fileCount: number;
  totalSize: number;
}

/** TIM-110: Snapshot info from manifest */
export interface SnapshotInfo {
  id: string;
  timestamp: number;
  sizeBytes: number;
  fileCount: number;
  changesCount: number;
  status: 'Complete' | 'Partial' | 'Failed';
  duration?: number;
  path?: string;
}

/** TIM-128: Snapshot density for calendar/timeline visualization */
export interface SnapshotDensity {
  period: string;
  count: number;
  totalSize: number;
}

/** Paginated directory contents with metadata */
export interface DirectoryContents {
  files: FileNode[];
  totalCount: number;
  hasMore: boolean;
}

// Manifest types (TIM-114)
export type ManifestSnapshotStatus = 'Complete' | 'Partial' | 'Failed';

export interface ManifestSnapshot {
  id: string;
  timestamp: number;
  folderName: string;
  fileCount: number;
  totalSize: number;
  status: ManifestSnapshotStatus;
  durationMs?: number;
  changesCount?: number;
}

export interface BackupManifest {
  version: number;
  machineId: string;
  machineName?: string;
  jobId: string;
  jobName: string;
  sourcePath: string;
  createdAt: number;
  updatedAt: number;
  snapshots: ManifestSnapshot[];
}
