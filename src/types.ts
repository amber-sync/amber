export enum SyncMode {
  MIRROR = 'MIRROR',
  ARCHIVE = 'ARCHIVE',
  TIME_MACHINE = 'TIME_MACHINE', // Incremental with hard links
}

export enum JobStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface RsyncConfig {
  recursive: boolean;
  compress: boolean;
  archive: boolean;
  delete: boolean; // --delete
  verbose: boolean;
  excludePatterns: string[];
  linkDest?: string; // For Time Machine mode
  customFlags: string;
  customCommand?: string; // Advanced override for rsync invocation
}

export interface SshConfig {
  enabled: boolean;
  port?: string;
  identityFile?: string; // Path to private key
  configFile?: string;   // Path to ssh_config
  disableHostKeyChecking?: boolean; // SECURITY: explicit opt-in
  proxyJump?: string;    // -J user@host
  customSshOptions?: string; // Additional SSH flags
}

export interface FileNode {
  id: string;
  name: string;
  type: 'FILE' | 'FOLDER';
  size: number;
  modified: number;
  children?: FileNode[];
}

export interface Snapshot {
  id: string;
  timestamp: number;
  sizeBytes: number;
  fileCount: number;
  changesCount: number;
  status: 'Complete' | 'Partial';
  root?: FileNode[]; // Mocked file tree for visualization (optional for persistence)
}

export interface JobSchedule {
  enabled: boolean;
  cron?: string;
  runOnMount?: boolean;
}

export interface SyncJob {
  id: string;
  name: string;
  sourcePath: string; // e.g., user@remote:/var/www
  destPath: string;   // e.g., /Volumes/Backups/ProjectA
  mode: SyncMode;
  scheduleInterval: number | null; // minutes, null if manual
  schedule?: JobSchedule;
  config: RsyncConfig;
  sshConfig?: SshConfig;
  lastRun: number | null;
  status: JobStatus;
  snapshots: Snapshot[];
}

// Additional types for better type safety

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

export interface DiskStats {
  total: number;
  free: number;
  status: 'AVAILABLE' | 'UNAVAILABLE';
}

export interface BackupResult {
  success: boolean;
  error?: string;
  snapshot?: Partial<Snapshot>;
}

// Type guards
export function isRsyncProgress(data: unknown): data is RsyncProgressData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'percentage' in data &&
    typeof (data as any).percentage === 'number'
  );
}

export function isBackupResult(data: unknown): data is BackupResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    typeof (data as any).success === 'boolean'
  );
}
