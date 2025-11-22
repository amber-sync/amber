export enum SyncMode {
  MIRROR = 'MIRROR',
  ARCHIVE = 'ARCHIVE',
  TIME_MACHINE = 'TIME_MACHINE',
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
  delete: boolean;
  verbose: boolean;
  excludePatterns: string[];
  linkDest?: string;
  customFlags: string;
}

export interface SshConfig {
  enabled: boolean;
  port?: string;
  identityFile?: string;
  configFile?: string;
}

export interface SyncJob {
  id: string;
  name: string;
  sourcePath: string;
  destPath: string;
  mode: SyncMode;
  scheduleInterval: number | null;
  config: RsyncConfig;
  sshConfig?: SshConfig;
  lastRun: number | null;
  status: JobStatus;
  // snapshots: Snapshot[]; // We don't need full snapshot tree in backend for now, just paths
}

