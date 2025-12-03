import React, { useMemo } from 'react';
import { SyncJob } from '../../types';
import { Icons } from '../IconComponents';
import { formatDistanceToNow } from 'date-fns';

interface BackupHealthProps {
  jobs: SyncJob[];
  className?: string;
}

export const BackupHealth: React.FC<BackupHealthProps> = ({ jobs, className = '' }) => {
  const stats = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Collect all snapshots
    const allSnapshots = jobs.flatMap(job =>
      (job.snapshots || []).map(s => ({
        ...s,
        jobName: job.name,
        jobId: job.id,
      }))
    );

    // Last 7 days snapshots
    const last7Days = allSnapshots.filter(s => (s.timestamp || 0) >= sevenDaysAgo);
    const last30Days = allSnapshots.filter(s => (s.timestamp || 0) >= thirtyDaysAgo);

    // Success rates
    const success7Days = last7Days.filter(s => s.status !== 'Failed').length;
    const success30Days = last30Days.filter(s => s.status !== 'Failed').length;

    const successRate7Days =
      last7Days.length > 0 ? Math.round((success7Days / last7Days.length) * 100) : 100;
    const successRate30Days =
      last30Days.length > 0 ? Math.round((success30Days / last30Days.length) * 100) : 100;

    // Average duration (from snapshots that have duration)
    const durationsMs = allSnapshots
      .filter(s => s.duration && s.duration > 0)
      .map(s => s.duration as number);
    const avgDuration =
      durationsMs.length > 0
        ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length / 1000)
        : null;

    // Last failure
    const failures = allSnapshots
      .filter(s => s.status === 'Failed')
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const lastFailure = failures[0];

    // Latest backup
    const sorted = [...allSnapshots].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const latestBackup = sorted[0];

    return {
      successRate7Days,
      successRate30Days,
      avgDuration,
      lastFailure,
      latestBackup,
      totalBackups: allSnapshots.length,
      backupsLast7Days: last7Days.length,
    };
  }, [jobs]);

  // Determine health status
  const getHealthStatus = () => {
    if (stats.successRate7Days >= 95)
      return {
        label: 'Excellent',
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
      };
    if (stats.successRate7Days >= 80)
      return {
        label: 'Good',
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-100 dark:bg-blue-900/30',
      };
    if (stats.successRate7Days >= 50)
      return {
        label: 'Fair',
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-100 dark:bg-amber-900/30',
      };
    return {
      label: 'Poor',
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
    };
  };

  const healthStatus = getHealthStatus();

  return (
    <div
      className={`bg-layer-1 rounded-2xl border border-border-base overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-base flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icons.Activity size={16} className="text-accent-primary" />
          <span className="text-sm font-semibold text-text-primary">Backup Health</span>
        </div>
        <div
          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${healthStatus.bg} ${healthStatus.color}`}
        >
          {healthStatus.label}
        </div>
      </div>

      {/* Stats */}
      <div className="p-5 space-y-4">
        {/* Success Rate */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-layer-2 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <Icons.CheckCircle size={12} className="text-green-500" />
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                7-Day Success
              </span>
            </div>
            <div className="text-xl font-bold text-text-primary">{stats.successRate7Days}%</div>
            <div className="text-[10px] text-text-tertiary">
              {stats.backupsLast7Days} backup{stats.backupsLast7Days !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="p-3 bg-layer-2 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <Icons.Calendar size={12} className="text-blue-500" />
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                30-Day Success
              </span>
            </div>
            <div className="text-xl font-bold text-text-primary">{stats.successRate30Days}%</div>
            <div className="text-[10px] text-text-tertiary">{stats.totalBackups} total</div>
          </div>
        </div>

        {/* Avg Duration */}
        {stats.avgDuration !== null && (
          <div className="flex items-center justify-between p-3 bg-layer-2 rounded-xl">
            <div className="flex items-center gap-2">
              <Icons.Clock size={14} className="text-purple-500" />
              <span className="text-sm text-text-secondary">Avg Duration</span>
            </div>
            <span className="text-sm font-medium text-text-primary">
              {stats.avgDuration < 60
                ? `${stats.avgDuration}s`
                : `${Math.floor(stats.avgDuration / 60)}m ${stats.avgDuration % 60}s`}
            </span>
          </div>
        )}

        {/* Latest Backup */}
        {stats.latestBackup && (
          <div className="flex items-center justify-between p-3 bg-layer-2 rounded-xl">
            <div className="flex items-center gap-2">
              <Icons.Clock size={14} className="text-text-tertiary" />
              <span className="text-sm text-text-secondary">Latest Backup</span>
            </div>
            <span className="text-sm font-medium text-text-primary">
              {stats.latestBackup.timestamp
                ? formatDistanceToNow(new Date(stats.latestBackup.timestamp), { addSuffix: true })
                : '--'}
            </span>
          </div>
        )}

        {/* Last Failure (if any) */}
        {stats.lastFailure && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-1">
              <Icons.AlertCircle size={14} className="text-red-500" />
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                Last Failure
              </span>
            </div>
            <div className="text-sm text-red-700 dark:text-red-300">
              {(stats.lastFailure as any).jobName}
            </div>
            <div className="text-xs text-red-600/70 dark:text-red-400/70">
              {stats.lastFailure.timestamp
                ? formatDistanceToNow(new Date(stats.lastFailure.timestamp), { addSuffix: true })
                : '--'}
            </div>
          </div>
        )}

        {/* No failures */}
        {!stats.lastFailure && stats.totalBackups > 0 && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <Icons.CheckCircle size={14} className="text-green-500" />
              <span className="text-sm text-green-700 dark:text-green-300">No recent failures</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
