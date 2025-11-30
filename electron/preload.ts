import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  runRsync: (job: any) => ipcRenderer.send('run-rsync', job),
    
  onRsyncLog: (callback: (data: { jobId: string; message: string }) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('rsync-log', subscription);
    // Return a cleanup function to be called by the caller
    return () => ipcRenderer.removeListener('rsync-log', subscription);
  },
    
  onRsyncComplete: (callback: (data: { jobId: string; success: boolean; error?: string }) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('rsync-complete', subscription);
    return () => ipcRenderer.removeListener('rsync-complete', subscription);
  },

  readDir: (path: string) => ipcRenderer.invoke('read-dir', path),

  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  killRsync: (jobId: string) => ipcRenderer.send('kill-rsync', jobId),

  createSandboxDirs: (source: string, dest: string) => ipcRenderer.invoke('create-sandbox-dirs', source, dest),

  onRsyncProgress: (callback: (data: { jobId: string; transferred: string; percentage: number; speed: string; eta: string; currentFile?: string }) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('rsync-progress', subscription);
    return () => ipcRenderer.removeListener('rsync-progress', subscription);
  },
  getJobs: () => ipcRenderer.invoke('jobs:get'),
  saveJob: (job: any) => ipcRenderer.invoke('jobs:save', job),
  deleteJob: (jobId: string) => ipcRenderer.invoke('jobs:delete', jobId),

  openPath: (path: string) => ipcRenderer.invoke('open-path', path),
  showItemInFolder: (path: string) => ipcRenderer.invoke('show-item-in-folder', path),
  getDiskStats: (path: string) => ipcRenderer.invoke('get-disk-stats', path),
  getPreferences: () => ipcRenderer.invoke('prefs:get'),
  setPreferences: (prefs: any) => ipcRenderer.invoke('prefs:set', prefs),
  testNotification: () => ipcRenderer.invoke('test-notification'),
  listSnapshots: (jobId: string, destPath: string) => ipcRenderer.invoke('snapshot:list', jobId, destPath),
  getSnapshotTree: (jobId: string, timestamp: number, snapshotPath: string) => ipcRenderer.invoke('snapshot:getTree', jobId, timestamp, snapshotPath),
  isDev: () => ipcRenderer.invoke('is-dev'),
  restoreFiles: (job: any, snapshotPath: string, files: string[], targetPath: string) => ipcRenderer.invoke('snapshot:restore', job, snapshotPath, files, targetPath),
  restoreSnapshot: (job: any, snapshotPath: string, targetPath: string) => ipcRenderer.invoke('snapshot:restoreFull', job, snapshotPath, targetPath),
  getDesktopPath: () => ipcRenderer.invoke('app:getDesktopPath'),
  
  // Sandbox / Dev Tools
  initSandbox: () => ipcRenderer.invoke('sandbox:init'),
  sandboxStep2: () => ipcRenderer.invoke('sandbox:step2'),
  sandboxStep3: () => ipcRenderer.invoke('sandbox:step3'),
  createMockBackups: () => ipcRenderer.invoke('sandbox:mockBackups'),

  setActiveJob: (job: any) => ipcRenderer.send('active-job', job),
  onNavigate: (callback: (view: string) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('navigate-view', subscription);
    return () => ipcRenderer.removeListener('navigate-view', subscription);
  },
  // Rclone Integration
  rcloneCheckInstalled: () => ipcRenderer.invoke('rclone:checkInstalled'),
  rcloneListRemotes: () => ipcRenderer.invoke('rclone:listRemotes'),
  rcloneLaunchConfig: () => ipcRenderer.invoke('rclone:launchConfig'),
  rcloneCreateRemote: (config: any) => ipcRenderer.invoke('rclone:createRemote', config),

  // Sidecar
  scanDirectory: (path: string, onEntry: (entry: any) => void) => {
    const requestId = Math.random().toString(36).substring(7);
    ipcRenderer.send('fs:scan', { path, requestId });
    
    const entryHandler = (_: any, entry: any) => onEntry(entry);
    ipcRenderer.on(`fs:entry:${requestId}`, entryHandler);
    
    return new Promise<void>((resolve, reject) => {
        ipcRenderer.once(`fs:end:${requestId}`, () => {
            ipcRenderer.removeListener(`fs:entry:${requestId}`, entryHandler);
            resolve();
        });
        ipcRenderer.once(`fs:error:${requestId}`, (_: any, err: string) => {
            ipcRenderer.removeListener(`fs:entry:${requestId}`, entryHandler);
            reject(new Error(err));
        });
    });
  },

  searchDirectory: (path: string, query: string, onEntry: (entry: any) => void) => {
    const requestId = Math.random().toString(36).substring(7);
    ipcRenderer.send('fs:search', { path, query, requestId });
    
    const entryHandler = (_: any, entry: any) => onEntry(entry);
    ipcRenderer.on(`fs:entry:${requestId}`, entryHandler);
    
    return new Promise<void>((resolve, reject) => {
        ipcRenderer.once(`fs:end:${requestId}`, () => {
            ipcRenderer.removeListener(`fs:entry:${requestId}`, entryHandler);
            resolve();
        });
        ipcRenderer.once(`fs:error:${requestId}`, (_: any, err: string) => {
            ipcRenderer.removeListener(`fs:entry:${requestId}`, entryHandler);
            reject(new Error(err));
        });
    });
  }
});
 
