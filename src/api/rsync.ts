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

export function onRsyncLog(callback: RsyncLogCallback): () => void {
  let unlisten: (() => void) | null = null;
  listen<RsyncLogPayload>('rsync-log', (event: Event<RsyncLogPayload>) =>
    callback(event.payload)
  ).then(fn => {
    unlisten = fn;
  });
  return () => unlisten?.();
}

export function onRsyncProgress(callback: RsyncProgressCallback): () => void {
  let unlisten: (() => void) | null = null;
  listen<RsyncProgressPayload>('rsync-progress', (event: Event<RsyncProgressPayload>) =>
    callback(event.payload)
  ).then(fn => {
    unlisten = fn;
  });
  return () => unlisten?.();
}

export function onRsyncComplete(callback: RsyncCompleteCallback): () => void {
  let unlisten: (() => void) | null = null;
  listen<RsyncCompletePayload>('rsync-complete', (event: Event<RsyncCompletePayload>) =>
    callback(event.payload)
  ).then(fn => {
    unlisten = fn;
  });
  return () => unlisten?.();
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
