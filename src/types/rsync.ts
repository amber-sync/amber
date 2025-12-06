/**
 * Rsync event and progress type definitions
 */
import type { Snapshot } from './snapshots';

export interface LogEntry {
  message: string;
  timestamp: number;
  level?: 'info' | 'error' | 'warning';
}

export interface RsyncProgressData {
  transferred: string;
  percentage: number;
  speed: string;
  eta: string | null;
  currentFile?: string;
}

export interface BackupResult {
  success: boolean;
  error?: string;
  snapshot?: Partial<Snapshot>;
}

/** Tauri event payload types */
export interface RsyncLogPayload {
  jobId: string;
  message: string;
}

export interface RsyncProgressPayload {
  jobId: string;
  transferred: string;
  percentage: number;
  speed: string;
  eta: string;
  currentFile?: string;
}

export interface RsyncCompletePayload {
  jobId: string;
  success: boolean;
  error?: string;
  /** Snapshot data returned on successful backup */
  snapshot?: Partial<Snapshot>;
}

// Type guards
export function isRsyncProgress(data: unknown): data is RsyncProgressData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'percentage' in data &&
    typeof (data as RsyncProgressData).percentage === 'number'
  );
}

export function isBackupResult(data: unknown): data is BackupResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    typeof (data as BackupResult).success === 'boolean'
  );
}
