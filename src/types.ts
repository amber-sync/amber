export enum SyncMode {
  MIRROR = 'MIRROR',
  ARCHIVE = 'ARCHIVE',
  TIME_MACHINE = 'TIME_MACHINE', // Incremental with hard links
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
  configFile?: string; // Path to ssh_config
  disableHostKeyChecking?: boolean; // SECURITY: explicit opt-in
  proxyJump?: string; // -J user@host
  customSshOptions?: string; // Additional SSH flags
}

export interface CloudConfig {
  remoteName: string; // Rclone remote name, e.g., "myS3:", "gdrive:"
  remotePath?: string; // Optional subpath within remote
  encrypt: boolean; // Whether to use rclone crypt layer
  encryptPasswordKeychain: string; // Keychain service name for encryption password
  bandwidth?: string; // Bandwidth limit, e.g., "10M" for 10MB/s
  provider?: string; // Provider type for UI (s3, drive, dropbox, etc.)
}

/**
 * Centralized file type constants - use these everywhere instead of string literals.
 * These match the Rust file_type module in src-tauri/src/types/snapshot.rs
 */
export const FILE_TYPE = {
  DIR: 'dir',
  FILE: 'file',
} as const;

export type FileType = (typeof FILE_TYPE)[keyof typeof FILE_TYPE];

/** Check if a type string represents a directory */
export function isDirectory(type: string): boolean {
  return type === FILE_TYPE.DIR;
}

export interface FileNode {
  id: string;
  name: string;
  type: FileType;
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
  status: 'Complete' | 'Partial' | 'Failed';
  duration?: number; // Duration of backup in milliseconds
  restored?: boolean;
  restoredDate?: number;
  path?: string; // Path to the snapshot folder
  root?: FileNode[]; // Mocked file tree for visualization (optional for persistence)
}

// TIM-46: SQLite indexed snapshot metadata
export interface IndexedSnapshot {
  id: number;
  job_id: string;
  timestamp: number;
  root_path: string;
  file_count: number;
  total_size: number;
}

// TIM-101: File type stats from SQLite index
export interface FileTypeStats {
  extension: string;
  count: number;
  totalSize: number;
}

// TIM-101: Largest file info from SQLite index
export interface LargestFile {
  name: string;
  size: number;
  path: string;
}

// TIM-101: Global FTS5 search result
export interface GlobalSearchResult {
  file: {
    id: string;
    name: string;
    type: 'file' | 'dir'; // Matches FileType::as_str() in Rust
    size: number;
    modified: number;
    path: string;
    children?: unknown[];
  };
  job_id: string;
  job_name?: string;
  snapshot_timestamp: number;
  rank: number;
}

// TIM-47: Volume info for file search palette
export interface VolumeInfo {
  name: string;
  path: string;
  totalBytes: number;
  freeBytes: number;
  isExternal: boolean;
}

export interface JobSchedule {
  enabled: boolean;
  cron?: string;
  runOnMount?: boolean;
}

export interface SyncJob {
  id: string;
  name: string;
  sourcePath: string; // e.g., user@remote:/var/www or /Users/me/Documents
  destPath: string; // Local: /Volumes/Backups/ProjectA, Cloud: myS3:/backup
  mode: SyncMode;
  destinationType: DestinationType; // NEW: Local or Cloud
  scheduleInterval: number | null; // minutes, null if manual
  schedule?: JobSchedule;
  config: RsyncConfig;
  sshConfig?: SshConfig; // For remote sources (SSH)
  cloudConfig?: CloudConfig; // Only when destinationType === CLOUD
  lastRun: number | null;
  status: JobStatus;
  /**
   * DEPRECATED: Snapshots are now stored in manifest.json on the backup drive.
   * This field is populated from the manifest when the destination is mounted.
   * It may be undefined when loading from jobs.json - use `job.snapshots ?? []`.
   */
  snapshots?: Snapshot[];
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
    typeof (data as RsyncProgressData).percentage === 'number'
  );
}

export function isBackupResult(data: unknown): data is BackupResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    typeof (data as BackupResult).success === 'boolean'
  );
}

// Directory entry from filesystem commands
export interface DirEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  modified: number;
}

// Tauri event payload types
export interface RsyncLogPayload {
  jobId: string;
  message: string;
}

export interface RsyncProgressPayload {
  jobId: string;
  transferred: string;
  percentage: number;
  speed: string;
  eta: string;
  currentFile?: string;
}

export interface RsyncCompletePayload {
  jobId: string;
  success: boolean;
  error?: string;
}

// Preferences type
export interface AppPreferences {
  runInBackground: boolean;
  startOnBoot: boolean;
  notifications: boolean;
}

/**
 * Helper to safely get snapshots from a job.
 * Use this when accessing job.snapshots to handle the optional field.
 */
export function getJobSnapshots(job: SyncJob): Snapshot[] {
  return job.snapshots ?? [];
}

// Error extraction helper
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

// Manifest types (TIM-114: Repository-centric architecture)
export type ManifestSnapshotStatus = 'Complete' | 'Partial' | 'Failed';

export interface ManifestSnapshot {
  id: string;
  timestamp: number;
  folderName: string;
  fileCount: number;
  totalSize: number;
  status: ManifestSnapshotStatus;
  durationMs?: number;
}

export interface BackupManifest {
  version: number;
  machineId: string;
  machineName?: string;
  jobId: string;
  jobName: string;
  sourcePath: string;
  createdAt: number;
  updatedAt: number;
  snapshots: ManifestSnapshot[];
}

// Dev tools types (only used in dev mode)
export interface DevSeedResult {
  jobs_created: number;
  snapshots_created: number;
  files_created: number;
  total_size_bytes: number;
  duration_ms: number;
}

export interface DevBenchmarkResult {
  operation: string;
  iterations: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  total_ms: number;
}

export interface DevDbStats {
  snapshot_count: number;
  file_count: number;
  total_size_bytes: number;
  fts_index_entries: number;
  db_size_bytes: number;
}

// TIM-109: Mount detection types
export interface MountStatus {
  path: string;
  mounted: boolean;
  isExternal: boolean;
  volumeName?: string;
}

// TIM-110: Snapshot info from manifest (compatible with Snapshot type)
export interface SnapshotInfo {
  id: string;
  timestamp: number;
  sizeBytes: number;
  fileCount: number;
  changesCount: number;
  status: 'Complete' | 'Partial' | 'Failed';
  duration?: number;
  path?: string;
}

// TIM-110: Job with mount status and manifest snapshots
export interface JobWithStatus extends Omit<SyncJob, 'snapshots'> {
  /** Whether the destination is currently mounted/accessible */
  mounted: boolean;
  /** Whether the destination is an external volume */
  isExternal: boolean;
  /** Volume name if external */
  volumeName?: string;
  /** Snapshots loaded from manifest or cache - always present */
  snapshots: SnapshotInfo[];
  /** Source of snapshot data: "manifest" or "cache" or "none" */
  snapshotSource: string;
  /** When the cache was last updated (unix ms), only set when source is "cache" */
  cachedAt?: number;
}

// TIM-118: Orphan backup detection
export interface DiscoveredBackup {
  /** Path to the backup directory */
  backupPath: string;
  /** Job ID from manifest */
  jobId: string;
  /** Job name from manifest */
  jobName: string;
  /** Source path that was backed up */
  sourcePath: string;
  /** Machine ID that created this backup */
  machineId: string;
  /** Number of snapshots */
  snapshotCount: number;
  /** Whether there's a matching job in jobs.json */
  hasMatchingJob: boolean;
}

// TIM-113: Migration types
export interface JobMigrationResult {
  jobId: string;
  jobName: string;
  snapshotsMigrated: number;
  manifestWritten: boolean;
  cacheWritten: boolean;
  error?: string;
}

export interface MigrationReport {
  jobsMigrated: number;
  jobsSkipped: number;
  totalSnapshotsMigrated: number;
  manifestsWritten: number;
  cachesWritten: number;
  results: JobMigrationResult[];
}
