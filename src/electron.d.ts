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
  testNotification: () => Promise<{ success: boolean; error?: string }>;
  setActiveJob: (job: any) => void;
  onNavigate: (callback: (view: string) => void) => () => void;
  getJobs: () => Promise<any[]>;
  saveJob: (job: any) => Promise<{ success: boolean; jobs: any[] }>;
  deleteJob: (jobId: string) => Promise<{ success: boolean; jobs: any[] }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
