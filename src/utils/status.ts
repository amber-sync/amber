/**
 * Status utilities for consistent status display across the app.
 * Use these instead of inline switch statements or ternary chains.
 */

/**
 * Minimal job interface for status utilities.
 * Works with SyncJob, JobWithStatus, or any job-like object.
 */
interface JobLike {
  status?: string;
  lastRun?: number | null;
}

/**
 * Map of snapshot statuses to their semantic status for styling
 */
export type SemanticStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/**
 * Get the semantic status for a snapshot status string
 */
export function getSnapshotStatus(status: string): SemanticStatus {
  switch (status.toLowerCase()) {
    case 'complete':
    case 'success':
      return 'success';
    case 'partial':
    case 'incomplete':
      return 'warning';
    case 'failed':
    case 'error':
      return 'error';
    case 'running':
    case 'in_progress':
      return 'info';
    default:
      return 'neutral';
  }
}

/**
 * Get a human-readable label for a snapshot status
 */
export function getStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'complete':
    case 'success':
      return 'Complete';
    case 'partial':
    case 'incomplete':
      return 'Partial';
    case 'failed':
    case 'error':
      return 'Failed';
    case 'running':
    case 'in_progress':
      return 'Running';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }
}

/**
 * Get the CSS class for a status color (for text)
 */
export function getStatusTextClass(status: string): string {
  const semantic = getSnapshotStatus(status);
  switch (semantic) {
    case 'success':
      return 'text-[var(--color-success)]';
    case 'warning':
      return 'text-[var(--color-warning)]';
    case 'error':
      return 'text-[var(--color-error)]';
    case 'info':
      return 'text-[var(--color-info)]';
    default:
      return 'text-text-secondary';
  }
}

/**
 * Get the CSS class for a status background color
 */
export function getStatusBgClass(status: string): string {
  const semantic = getSnapshotStatus(status);
  switch (semantic) {
    case 'success':
      return 'bg-[var(--color-success-subtle)]';
    case 'warning':
      return 'bg-[var(--color-warning-subtle)]';
    case 'error':
      return 'bg-[var(--color-error-subtle)]';
    case 'info':
      return 'bg-[var(--color-info-subtle)]';
    default:
      return 'bg-layer-2';
  }
}

/**
 * Check if a job is currently running
 */
export function isJobRunning(job: JobLike): boolean {
  return job.status === 'running' || job.status === 'in_progress';
}

/**
 * Check if a job has any issues (failed last run, etc.)
 */
export function hasJobIssue(job: JobLike): boolean {
  const status = job.status?.toLowerCase();
  return status === 'failed' || status === 'error';
}

/**
 * Get the overall status of a job for display
 */
export function getJobStatus(job: JobLike): SemanticStatus {
  if (isJobRunning(job)) return 'info';
  if (hasJobIssue(job)) return 'error';
  const status = job.status?.toLowerCase();
  if (status === 'partial') return 'warning';
  if (status === 'complete' || status === 'success' || status === 'idle') return 'success';
  return 'neutral';
}

/**
 * Get a human-readable label for a job's current state
 */
export function getJobStatusLabel(job: JobLike): string {
  if (isJobRunning(job)) return 'Running';
  if (!job.lastRun) return 'Never run';
  return getStatusLabel(job.status || 'unknown');
}

/**
 * Get sync mode display label
 */
export function getSyncModeLabel(mode: string): string {
  switch (mode) {
    case 'TIME_MACHINE':
      return 'Time Machine';
    case 'MIRROR':
      return 'Mirror';
    case 'ARCHIVE':
      return 'Archive';
    default:
      return mode;
  }
}

/**
 * Get destination type display label
 */
export function getDestTypeLabel(type: string): string {
  switch (type) {
    case 'LOCAL':
      return 'Local';
    case 'CLOUD':
      return 'Cloud';
    default:
      return type;
  }
}
