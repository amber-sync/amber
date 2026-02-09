/**
 * TIM-186: Rsync and Rclone operation API
 * Extracted from monolithic AmberAPI class for better organization
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type Event } from '@tauri-apps/api/event';
import type {
  SyncJob,
  RsyncLogPayload,
  RsyncProgressPayload,
  RsyncCompletePayload,
} from '../types';

// Event callback types
export type RsyncLogCallback = (data: RsyncLogPayload) => void;
export type RsyncProgressCallback = (data: RsyncProgressPayload) => void;
export type RsyncCompleteCallback = (data: RsyncCompletePayload) => void;

// ===== Rsync Operations =====

export async function runRsync(job: SyncJob): Promise<void> {
  return invoke('run_rsync', { job });
}

export async function killRsync(jobId: string): Promise<void> {
  return invoke('kill_rsync', { jobId });
}

/**
 * Helper: subscribe to a Tauri event with safe cleanup.
 * If the returned cleanup is called before the listen Promise resolves,
 * the listener is still properly removed once it does resolve.
 */
function safeEventListener<T>(event: string, callback: (data: T) => void): () => void {
  let unlisten: (() => void) | null = null;
  let disposed = false;
  listen<T>(event, (e: Event<T>) => callback(e.payload)).then(fn => {
    if (disposed) {
      fn(); // Already cleaned up - unlisten immediately
    } else {
      unlisten = fn;
    }
  });
  return () => {
    disposed = true;
    unlisten?.();
  };
}

export function onRsyncLog(callback: RsyncLogCallback): () => void {
  return safeEventListener<RsyncLogPayload>('rsync-log', callback);
}

export function onRsyncProgress(callback: RsyncProgressCallback): () => void {
  return safeEventListener<RsyncProgressPayload>('rsync-progress', callback);
}

export function onRsyncComplete(callback: RsyncCompleteCallback): () => void {
  return safeEventListener<RsyncCompletePayload>('rsync-complete', callback);
}

// ===== Rclone (Cloud Backup) =====

/**
 * Check if rclone is installed and get version info
 */
export async function checkRclone(): Promise<{
  installed: boolean;
  version?: string;
  configPath?: string;
}> {
  return invoke('check_rclone');
}

/**
 * List all configured rclone remotes
 */
export async function listRcloneRemotes(): Promise<{ name: string; remoteType: string }[]> {
  return invoke('list_rclone_remotes');
}

/**
 * Run an rclone sync job for cloud backup
 */
export async function runRclone(job: SyncJob): Promise<void> {
  return invoke('run_rclone', { job });
}

/**
 * Kill a running rclone sync job
 */
export async function killRclone(jobId: string): Promise<void> {
  return invoke('kill_rclone', { jobId });
}
