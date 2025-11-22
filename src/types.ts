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
}

export interface SshConfig {
  enabled: boolean;
  port?: string;
  identityFile?: string; // Path to private key
  configFile?: string;   // Path to ssh_config
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
  root: FileNode[]; // Mocked file tree for visualization
}

export interface SyncJob {
  id: string;
  name: string;
  sourcePath: string; // e.g., user@remote:/var/www
  destPath: string;   // e.g., /Volumes/Backups/ProjectA
  mode: SyncMode;
  scheduleInterval: number | null; // minutes, null if manual
  config: RsyncConfig;
  sshConfig?: SshConfig;
  lastRun: number | null;
  status: JobStatus;
  snapshots: Snapshot[];
}