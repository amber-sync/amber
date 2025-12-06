/**
 * Job-related type definitions
 */
import type { Snapshot } from './snapshots';

export enum SyncMode {
  MIRROR = 'MIRROR',
  ARCHIVE = 'ARCHIVE',
  TIME_MACHINE = 'TIME_MACHINE',
}

export enum DestinationType {
  LOCAL = 'LOCAL',
  CLOUD = 'CLOUD',
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
  customCommand?: string;
}

export interface SshConfig {
  enabled: boolean;
  port?: string;
  identityFile?: string;
  configFile?: string;
  disableHostKeyChecking?: boolean;
  proxyJump?: string;
  customSshOptions?: string;
}

export interface CloudConfig {
  remoteName: string;
  remotePath?: string;
  encrypt: boolean;
  encryptPasswordKeychain?: string;
  bandwidth?: string;
  provider?: string;
}

export interface JobSchedule {
  enabled: boolean;
  cron?: string;
  runOnMount?: boolean;
}

export interface SyncJob {
  id: string;
  name: string;
  sourcePath: string;
  destPath: string;
  mode: SyncMode;
  destinationType: DestinationType;
  scheduleInterval: number | null;
  schedule?: JobSchedule;
  config: RsyncConfig;
  sshConfig?: SshConfig;
  cloudConfig?: CloudConfig;
  lastRun: number | null;
  status: JobStatus;
  snapshots?: Snapshot[];
}

/** TIM-184: Consolidated mount info for job components */
export interface JobMountInfo {
  mounted: boolean;
  isExternal: boolean;
  volumeName?: string;
}

/** TIM-127: Aggregate statistics for a job */
export interface JobAggregateStats {
  totalSnapshots: number;
  totalSizeBytes: number;
  totalFiles: number;
  firstSnapshotMs: number | null;
  lastSnapshotMs: number | null;
}
