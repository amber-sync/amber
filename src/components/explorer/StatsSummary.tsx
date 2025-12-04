import { JobAggregateStats } from '../../types';
import { Card } from '../ui';
import { formatBytes, formatRelativeTime, formatDate } from '../../utils';

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
      <div className="border-b border-border-base p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-24 rounded bg-layer-3" />
          <div className="h-6 w-32 rounded bg-layer-3" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="border-b border-border-base p-4">
        <div className="text-sm text-text-tertiary">No statistics available</div>
      </div>
    );
  }

  return (
    <div className="border-b border-border-base p-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Backups count */}
        <div>
          <div className="text-text-tertiary">Backups</div>
          <div className="text-lg font-semibold">{stats.totalSnapshots}</div>
        </div>

        {/* Total size */}
        <div>
          <div className="text-text-tertiary">Total Size</div>
          <div className="text-lg font-semibold">{formatBytes(stats.totalSizeBytes)}</div>
        </div>

        {/* Total files */}
        <div>
          <div className="text-text-tertiary">Files</div>
          <div className="text-lg font-semibold">{stats.totalFiles.toLocaleString()}</div>
        </div>

        {/* Date range */}
        <div>
          <div className="text-text-tertiary">Since</div>
          <div className="text-lg font-semibold">
            {stats.firstSnapshotMs ? formatDate(stats.firstSnapshotMs, 'short') : '-'}
          </div>
        </div>
      </div>

      {/* Additional info row */}
      {stats.lastSnapshotMs && (
        <div className="mt-3 border-t border-border-base pt-3 text-xs text-text-tertiary">
          Last backup:{' '}
          <span className="font-medium text-text-secondary">
            {formatRelativeTime(stats.lastSnapshotMs)}
          </span>
        </div>
      )}
    </div>
  );
}

export default StatsSummary;
