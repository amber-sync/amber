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
  setActiveJob: (job: any) => ipcRenderer.send('active-job', job),
  onNavigate: (callback: (view: string) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('navigate-view', subscription);
    return () => ipcRenderer.removeListener('navigate-view', subscription);
  },
});
 
