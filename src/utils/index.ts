/**
 * Centralized utilities barrel export.
 * Import from '@/utils' or '../utils' instead of individual files.
 */

// Formatting utilities
export {
  formatBytes,
  formatSchedule,
  formatSnapshotDate,
  formatDate,
  formatRelativeTime,
  formatDuration,
  formatTime,
  truncateMiddle,
} from './formatters';

// Status utilities
export {
  getSnapshotStatus,
  getStatusLabel,
  getStatusTextClass,
  getStatusBgClass,
  isJobRunning,
  hasJobIssue,
  getJobStatus,
  getJobStatusLabel,
  getSyncModeLabel,
  getDestTypeLabel,
  type SemanticStatus,
} from './status';

// ID generation
export { generateUniqueId } from './idGenerator';

// Path utilities
export {
  isSshRemote,
  sshLocalPart,
  makeRelative,
  makeAbsolute,
  joinPaths,
  getParentPath,
  getFileName,
} from './paths';

// CSS utilities
export { cn } from './cn';
