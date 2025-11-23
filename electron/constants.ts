export const CONSTANTS = {
  // Performance
  PROGRESS_UPDATE_INTERVAL_MS: 200,
  LOG_FLUSH_INTERVAL_MS: 200,
  MAX_LOG_ENTRIES: 500,

  // Timeouts
  FILESYSTEM_CHECK_TIMEOUT_MS: 5000,
  BACKUP_DELAY_MS: 3000,
  DISK_STATS_REFRESH_INTERVAL_MS: 10000,

  // File Operations
  FILE_CREATION_BATCH_SIZE: 100,
  SANDBOX_TOTAL_FILES: 10000,
  SANDBOX_LARGE_FILES_COUNT: 5,
  SANDBOX_LARGE_FILE_SIZE_MB: 50,
  DIRECTORY_SCAN_BATCH_SIZE: 50,
  MAX_DIRECTORY_SCAN_DEPTH: 20,

  // Retention Policy
  RETENTION_STRATEGIES: [
    { afterDays: 1, intervalDays: 1 },
    { afterDays: 30, intervalDays: 7 },
    { afterDays: 365, intervalDays: 30 }
  ] as const,

  // Regex Patterns
  BACKUP_DIR_PATTERN: /^\d{4}-\d{2}-\d{2}-\d{6}$/,

  // Paths
  BACKUP_MARKER_FILENAME: '.backup-marker', // Note: Dynamically generated as .{foldername}_backup-marker
  LATEST_SYMLINK_NAME: 'latest',
} as const;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
