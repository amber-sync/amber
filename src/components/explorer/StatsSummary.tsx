import { JobAggregateStats } from '../../types';

interface StatsSummaryProps {
  stats: JobAggregateStats | null;
  loading: boolean;
}

/**
 * StatsSummary - Aggregate statistics panel for a backup job (TIM-132)
 *
 * Displays total backups, total size, file count, and date range.
 */
export function StatsSummary({ stats, loading }: StatsSummaryProps) {
  if (loading) {
    return (
      <div className="border-b border-stone-200 p-4 dark:border-stone-700">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-24 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-6 w-32 rounded bg-stone-200 dark:bg-stone-700" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="border-b border-stone-200 p-4 dark:border-stone-700">
        <div className="text-sm text-stone-500">No statistics available</div>
      </div>
    );
  }

  return (
    <div className="border-b border-stone-200 p-4 dark:border-stone-700">
      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Backups count */}
        <div>
          <div className="text-stone-500 dark:text-stone-400">Backups</div>
          <div className="text-lg font-semibold">{stats.totalSnapshots}</div>
        </div>

        {/* Total size */}
        <div>
          <div className="text-stone-500 dark:text-stone-400">Total Size</div>
          <div className="text-lg font-semibold">{formatBytes(stats.totalSizeBytes)}</div>
        </div>

        {/* Total files */}
        <div>
          <div className="text-stone-500 dark:text-stone-400">Files</div>
          <div className="text-lg font-semibold">{stats.totalFiles.toLocaleString()}</div>
        </div>

        {/* Date range */}
        <div>
          <div className="text-stone-500 dark:text-stone-400">Since</div>
          <div className="text-lg font-semibold">
            {stats.firstSnapshotMs ? formatRelativeDate(stats.firstSnapshotMs) : '-'}
          </div>
        </div>
      </div>

      {/* Additional info row */}
      {stats.lastSnapshotMs && (
        <div className="mt-3 border-t border-stone-200 pt-3 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
          Last backup:{' '}
          <span className="font-medium text-stone-700 dark:text-stone-300">
            {formatRelativeDate(stats.lastSnapshotMs)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format timestamp to relative date (e.g., "Jan 2024", "2 days ago")
 */
function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  // For recent dates, show relative time
  if (days < 1) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    return `${hours}h ago`;
  }
  if (days < 7) return `${days}d ago`;

  // For older dates, show month/year
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
}

export default StatsSummary;
