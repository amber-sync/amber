/**
 * Tauri API abstraction layer for Amber Backup
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { desktopDir } from '@tauri-apps/api/path';
import type { SyncJob } from '../types';

// Event callback types
type RsyncLogCallback = (data: { jobId: string; message: string }) => void;
type RsyncProgressCallback = (data: { jobId: string; transferred: string; percentage: number; speed: string; eta: string; currentFile?: string }) => void;
type RsyncCompleteCallback = (data: { jobId: string; success: boolean; error?: string }) => void;

class AmberAPI {
  // ===== Jobs =====

  async getJobs(): Promise<SyncJob[]> {
    return invoke('get_jobs');
  }

  async saveJob(job: SyncJob): Promise<void> {
    return invoke('save_job', { job });
  }

  async deleteJob(jobId: string): Promise<void> {
    return invoke('delete_job', { jobId });
  }

  // ===== Rsync Operations =====

  async runRsync(job: SyncJob): Promise<void> {
    return invoke('run_rsync', { job });
  }

  async killRsync(jobId: string): Promise<void> {
    return invoke('kill_rsync', { jobId });
  }

  onRsyncLog(callback: RsyncLogCallback): () => void {
    let unlisten: (() => void) | null = null;
    listen('rsync-log', (event: any) => callback(event.payload)).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }

  onRsyncProgress(callback: RsyncProgressCallback): () => void {
    let unlisten: (() => void) | null = null;
    listen('rsync-progress', (event: any) => callback(event.payload)).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }

  onRsyncComplete(callback: RsyncCompleteCallback): () => void {
    let unlisten: (() => void) | null = null;
    listen('rsync-complete', (event: any) => callback(event.payload)).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }

  // ===== Filesystem =====

  async readDir(path: string): Promise<any[]> {
    return invoke('read_dir', { path });
  }

  async selectDirectory(): Promise<string | null> {
    const selected = await open({ directory: true });
    return selected as string | null;
  }

  async openPath(path: string): Promise<void> {
    return invoke('open_path', { path });
  }

  async showItemInFolder(path: string): Promise<void> {
    return invoke('show_item_in_folder', { path });
  }

  async getDiskStats(path: string): Promise<{ success: boolean; stats?: { total: number; free: number; status: 'AVAILABLE' | 'UNAVAILABLE' }; error?: string }> {
    try {
      const result = await invoke<{ totalBytes: number; availableBytes: number }>('get_volume_info', { path });
      return {
        success: true,
        stats: {
          total: result.totalBytes,
          free: result.availableBytes,
          status: 'AVAILABLE'
        }
      };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  async readFilePreview(filePath: string, maxLines?: number): Promise<string> {
    return invoke('read_file_preview', { filePath, maxLines });
  }

  async readFileAsBase64(filePath: string): Promise<string> {
    return invoke('read_file_as_base64', { filePath });
  }

  // ===== Snapshots =====

  async listSnapshots(jobId: string, destPath: string): Promise<any[]> {
    return invoke('list_snapshots', { jobId, destPath });
  }

  async getSnapshotTree(jobId: string, timestamp: number, snapshotPath: string): Promise<any[]> {
    return invoke('get_snapshot_tree', { jobId, timestamp, snapshotPath });
  }

  async restoreFiles(job: SyncJob, snapshotPath: string, files: string[], targetPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await invoke('restore_files', { jobId: job.id, snapshotPath, files, targetPath });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  async restoreSnapshot(job: SyncJob, snapshotPath: string, targetPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await invoke('restore_snapshot', { jobId: job.id, snapshotPath, targetPath });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  // ===== Preferences =====

  async getPreferences(): Promise<{ runInBackground: boolean; startOnBoot: boolean; notifications: boolean }> {
    return invoke('get_preferences');
  }

  async setPreferences(prefs: Partial<{ runInBackground: boolean; startOnBoot: boolean; notifications: boolean }>): Promise<any> {
    return invoke('set_preferences', { preferences: prefs });
  }

  async testNotification(): Promise<boolean> {
    await invoke('test_notification');
    return true;
  }

  // ===== Utilities =====

  async isDev(): Promise<boolean> {
    return import.meta.env.DEV;
  }

  async getDesktopPath(): Promise<string> {
    return desktopDir();
  }

  // ===== Runtime Info =====

  get runtime(): 'tauri' {
    return 'tauri';
  }
}

// Export singleton instance
export const api = new AmberAPI();

// Export for direct usage
export default api;
