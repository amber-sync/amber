/**
 * Centralized formatting utilities for the Amber app.
 * Import these instead of defining inline formatters.
 */

/**
 * Format bytes to human-readable string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format schedule interval to human-readable string
 */
export function formatSchedule(minutes: number | null): string {
  if (minutes === null) return 'Manual Only';
  if (minutes === 5) return 'Heartbeat';
  if (minutes === 60) return 'Hourly';
  if (minutes === 1440) return 'Daily';
  if (minutes === 10080) return 'Weekly';
  return `Every ${minutes} mins`;
}

/**
 * Format a Date to snapshot-style string (YYYY-MM-DD-HHmmss)
 */
export function formatSnapshotDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}${min}${s}`;
}

/**
 * Format a timestamp to a display date string
 * @param timestamp - Unix timestamp in milliseconds
 * @param style - 'short' for "Dec 3, 2025", 'long' for "December 3, 2025 at 2:30 PM"
 */
export function formatDate(timestamp: number, style: 'short' | 'long' = 'short'): string {
  const date = new Date(timestamp);

  if (style === 'short') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format a timestamp to relative time string (e.g., "2 hours ago", "just now")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (weeks === 1) return '1 week ago';
  if (weeks < 4) return `${weeks} weeks ago`;
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;

  return formatDate(timestamp, 'short');
}

/**
 * Format duration in milliseconds to human-readable string
 * @param ms - Duration in milliseconds
 * @param compact - If true, use compact format ("4m 32s" vs "4 minutes, 32 seconds")
 */
export function formatDuration(ms: number, compact: boolean = true): string {
  if (ms < 1000) return compact ? '< 1s' : 'less than a second';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  if (compact) {
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (remainingMinutes > 0)
    parts.push(`${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`);
  if (remainingSeconds > 0 && hours === 0) {
    parts.push(`${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}`);
  }

  return parts.join(', ');
}

/**
 * Format a time to display string (e.g., "2:30 PM")
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Truncate a string in the middle, preserving start and end
 */
export function truncateMiddle(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  const sideLength = Math.floor((maxLength - 3) / 2);
  return str.slice(0, sideLength) + '...' + str.slice(-sideLength);
}
