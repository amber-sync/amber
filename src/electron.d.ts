export interface ElectronAPI {
  runRsync: (job: any) => void;
  onRsyncLog: (callback: (data: { jobId: string; message: string }) => void) => () => void;
  onRsyncComplete: (callback: (data: { jobId: string; success: boolean; error?: string }) => void) => () => void;
  readDir: (path: string) => Promise<any[]>;
  selectDirectory: () => Promise<string | null>;
  killRsync: (jobId: string) => void;
  createSandboxDirs: (source: string, dest: string) => Promise<{ success: boolean; error?: string }>;
  onRsyncProgress: (callback: (data: { jobId: string; transferred: string; percentage: number; speed: string; eta: string; currentFile?: string }) => void) => () => void;
  openPath: (path: string) => Promise<string>;
  showItemInFolder: (path: string) => Promise<void>;
  getDiskStats: (path: string) => Promise<{ success: boolean; stats?: { total: number; free: number; status: 'AVAILABLE' | 'UNAVAILABLE' }; error?: string }>;
  getPreferences: () => Promise<{ runInBackground: boolean; startOnBoot: boolean; notifications: boolean }>;
  setPreferences: (prefs: Partial<{ runInBackground: boolean; startOnBoot: boolean; notifications: boolean }>) => Promise<any>;
  testNotification: () => Promise<boolean>;
  restoreFiles: (job: SyncJob, snapshotPath: string, files: string[], targetPath: string) => Promise<{ success: boolean; error?: string }>;
  restoreSnapshot: (job: any, snapshotPath: string, targetPath: string) => Promise<{ success: boolean; error?: string }>;
  getDesktopPath: () => Promise<string>;
  
  initSandbox: () => Promise<{ source: string; dest: string }>;
  sandboxStep2: () => Promise<{ success: boolean }>;
  sandboxStep3: () => Promise<{ success: boolean }>;
  createMockBackups: () => Promise<{ source: string; dest: string }>;

  setActiveJob: (job: SyncJob) => void;
  onNavigate: (callback: (view: string) => void) => () => void;
  getJobs: () => Promise<any[]>;
  saveJob: (job: any) => Promise<{ success: boolean; jobs: any[] }>;
  deleteJob: (jobId: string) => Promise<{ success: boolean; jobs: any[] }>;
  
  // Sidecar
  scanDirectory: (path: string, onEntry: (entry: any) => void) => Promise<void>;
  searchDirectory: (path: string, query: string, onEntry: (entry: any) => void) => Promise<void>;
  listSnapshots: (jobId: string, destPath: string) => Promise<any[]>;
  getSnapshotTree: (jobId: string, timestamp: number, snapshotPath: string) => Promise<any[]>;
  readFilePreview: (filePath: string, maxLines?: number) => Promise<string>;
  isDev: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
