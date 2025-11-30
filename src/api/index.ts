/**
 * Unified API abstraction layer for Amber Backup
 * Supports both Electron IPC and Tauri commands
 */

import type { SyncJob } from '../types';

// Detect which runtime we're in
const isTauri = '__TAURI__' in window;
const isElectron = 'electronAPI' in window;

// Event emitter for rsync events (Tauri uses Tauri events, Electron uses IPC)
type RsyncLogCallback = (data: { jobId: string; message: string }) => void;
type RsyncProgressCallback = (data: { jobId: string; transferred: string; percentage: number; speed: string; eta: string; currentFile?: string }) => void;
type RsyncCompleteCallback = (data: { jobId: string; success: boolean; error?: string }) => void;

class AmberAPI {
  private tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;
  private tauriListen: ((event: string, handler: (event: any) => void) => Promise<() => void>) | null = null;

  constructor() {
    if (isTauri) {
      // Dynamically import Tauri API
      import('@tauri-apps/api/core').then((mod) => {
        this.tauriInvoke = mod.invoke;
      });
      import('@tauri-apps/api/event').then((mod) => {
        this.tauriListen = mod.listen;
      });
    }
  }

  // ===== Jobs =====

  async getJobs(): Promise<SyncJob[]> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('get_jobs');
    }
    if (isElectron) {
      return window.electronAPI.getJobs();
    }
    throw new Error('No backend available');
  }

  async saveJob(job: SyncJob): Promise<void> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('save_job', { job });
    }
    if (isElectron) {
      await window.electronAPI.saveJob(job);
      return;
    }
    throw new Error('No backend available');
  }

  async deleteJob(jobId: string): Promise<void> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('delete_job', { jobId });
    }
    if (isElectron) {
      await window.electronAPI.deleteJob(jobId);
      return;
    }
    throw new Error('No backend available');
  }

  // ===== Rsync Operations =====

  async runRsync(job: SyncJob): Promise<void> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('run_rsync', { job });
    }
    if (isElectron) {
      window.electronAPI.runRsync(job);
      return;
    }
    throw new Error('No backend available');
  }

  async killRsync(jobId: string): Promise<void> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('kill_rsync', { jobId });
    }
    if (isElectron) {
      window.electronAPI.killRsync(jobId);
      return;
    }
    throw new Error('No backend available');
  }

  onRsyncLog(callback: RsyncLogCallback): () => void {
    if (isTauri && this.tauriListen) {
      let unlisten: (() => void) | null = null;
      this.tauriListen('rsync-log', (event: any) => callback(event.payload)).then((fn) => {
        unlisten = fn;
      });
      return () => unlisten?.();
    }
    if (isElectron) {
      return window.electronAPI.onRsyncLog(callback);
    }
    return () => {};
  }

  onRsyncProgress(callback: RsyncProgressCallback): () => void {
    if (isTauri && this.tauriListen) {
      let unlisten: (() => void) | null = null;
      this.tauriListen('rsync-progress', (event: any) => callback(event.payload)).then((fn) => {
        unlisten = fn;
      });
      return () => unlisten?.();
    }
    if (isElectron) {
      return window.electronAPI.onRsyncProgress(callback);
    }
    return () => {};
  }

  onRsyncComplete(callback: RsyncCompleteCallback): () => void {
    if (isTauri && this.tauriListen) {
      let unlisten: (() => void) | null = null;
      this.tauriListen('rsync-complete', (event: any) => callback(event.payload)).then((fn) => {
        unlisten = fn;
      });
      return () => unlisten?.();
    }
    if (isElectron) {
      return window.electronAPI.onRsyncComplete(callback);
    }
    return () => {};
  }

  // ===== Filesystem =====

  async readDir(path: string): Promise<any[]> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('read_dir', { path });
    }
    if (isElectron) {
      return window.electronAPI.readDir(path);
    }
    throw new Error('No backend available');
  }

  async selectDirectory(): Promise<string | null> {
    if (isTauri) {
      // Use Tauri dialog plugin
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true });
      return selected as string | null;
    }
    if (isElectron) {
      return window.electronAPI.selectDirectory();
    }
    throw new Error('No backend available');
  }

  async openPath(path: string): Promise<void> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('open_path', { path });
    }
    if (isElectron) {
      await window.electronAPI.openPath(path);
      return;
    }
    throw new Error('No backend available');
  }

  async showItemInFolder(path: string): Promise<void> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('show_item_in_folder', { path });
    }
    if (isElectron) {
      await window.electronAPI.showItemInFolder(path);
      return;
    }
    throw new Error('No backend available');
  }

  async getDiskStats(path: string): Promise<{ success: boolean; stats?: { total: number; free: number; status: 'AVAILABLE' | 'UNAVAILABLE' }; error?: string }> {
    if (isTauri && this.tauriInvoke) {
      try {
        const result = await this.tauriInvoke('get_disk_stats', { path });
        // Parse df output
        return { success: true, stats: { total: 0, free: 0, status: 'AVAILABLE' } };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
    if (isElectron) {
      return window.electronAPI.getDiskStats(path);
    }
    throw new Error('No backend available');
  }

  async readFilePreview(filePath: string, maxLines?: number): Promise<string> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('read_file_preview', { filePath, maxLines });
    }
    if (isElectron) {
      return window.electronAPI.readFilePreview(filePath, maxLines);
    }
    throw new Error('No backend available');
  }

  async readFileAsBase64(filePath: string): Promise<string> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('read_file_as_base64', { filePath });
    }
    if (isElectron) {
      return window.electronAPI.readFileAsBase64(filePath);
    }
    throw new Error('No backend available');
  }

  // ===== Snapshots =====

  async listSnapshots(jobId: string, destPath: string): Promise<any[]> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('list_snapshots', { jobId, destPath });
    }
    if (isElectron) {
      return window.electronAPI.listSnapshots(jobId, destPath);
    }
    throw new Error('No backend available');
  }

  async getSnapshotTree(jobId: string, timestamp: number, snapshotPath: string): Promise<any[]> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('get_snapshot_tree', { jobId, timestamp, snapshotPath });
    }
    if (isElectron) {
      return window.electronAPI.getSnapshotTree(jobId, timestamp, snapshotPath);
    }
    throw new Error('No backend available');
  }

  async restoreFiles(job: SyncJob, snapshotPath: string, files: string[], targetPath: string): Promise<{ success: boolean; error?: string }> {
    if (isTauri && this.tauriInvoke) {
      try {
        await this.tauriInvoke('restore_files', { jobId: job.id, snapshotPath, files, targetPath });
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
    if (isElectron) {
      return window.electronAPI.restoreFiles(job, snapshotPath, files, targetPath);
    }
    throw new Error('No backend available');
  }

  async restoreSnapshot(job: SyncJob, snapshotPath: string, targetPath: string): Promise<{ success: boolean; error?: string }> {
    if (isTauri && this.tauriInvoke) {
      try {
        await this.tauriInvoke('restore_snapshot', { jobId: job.id, snapshotPath, targetPath });
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
    if (isElectron) {
      return window.electronAPI.restoreSnapshot(job, snapshotPath, targetPath);
    }
    throw new Error('No backend available');
  }

  // ===== Preferences =====

  async getPreferences(): Promise<{ runInBackground: boolean; startOnBoot: boolean; notifications: boolean }> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('get_preferences');
    }
    if (isElectron) {
      return window.electronAPI.getPreferences();
    }
    throw new Error('No backend available');
  }

  async setPreferences(prefs: Partial<{ runInBackground: boolean; startOnBoot: boolean; notifications: boolean }>): Promise<any> {
    if (isTauri && this.tauriInvoke) {
      return this.tauriInvoke('set_preferences', { preferences: prefs });
    }
    if (isElectron) {
      return window.electronAPI.setPreferences(prefs);
    }
    throw new Error('No backend available');
  }

  async testNotification(): Promise<boolean> {
    if (isTauri && this.tauriInvoke) {
      await this.tauriInvoke('test_notification');
      return true;
    }
    if (isElectron) {
      return window.electronAPI.testNotification();
    }
    throw new Error('No backend available');
  }

  // ===== Utilities =====

  async isDev(): Promise<boolean> {
    if (isTauri) {
      return import.meta.env.DEV;
    }
    if (isElectron) {
      return window.electronAPI.isDev();
    }
    return false;
  }

  async getDesktopPath(): Promise<string> {
    if (isTauri) {
      const { desktopDir } = await import('@tauri-apps/api/path');
      return desktopDir();
    }
    if (isElectron) {
      return window.electronAPI.getDesktopPath();
    }
    throw new Error('No backend available');
  }

  // ===== Runtime Info =====

  get runtime(): 'tauri' | 'electron' | 'none' {
    if (isTauri) return 'tauri';
    if (isElectron) return 'electron';
    return 'none';
  }
}

// Export singleton instance
export const api = new AmberAPI();

// Export for direct usage
export default api;
