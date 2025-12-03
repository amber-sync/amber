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

// TIM-101: Global FTS5 search result
export interface GlobalSearchResult {
  file: {
    id: string;
    name: string;
    node_type: 'FILE' | 'FOLDER'; // Note: Rust uses node_type
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
