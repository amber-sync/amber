import React, { useMemo } from 'react';
import { SyncJob } from '../../types';
import { Icons } from '../IconComponents';
import { formatDistanceToNow } from 'date-fns';
import { Title, Body, Caption } from '../ui';

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
        color: 'text-[var(--color-success)]',
        bg: 'bg-[var(--color-success-subtle)]',
      };
    if (stats.successRate7Days >= 80)
      return {
        label: 'Good',
        color: 'text-[var(--color-info)]',
        bg: 'bg-[var(--color-info-subtle)]',
      };
    if (stats.successRate7Days >= 50)
      return {
        label: 'Fair',
        color: 'text-[var(--color-warning)]',
        bg: 'bg-[var(--color-warning-subtle)]',
      };
    return {
      label: 'Poor',
      color: 'text-[var(--color-error)]',
      bg: 'bg-[var(--color-error-subtle)]',
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
          <Body size="sm" weight="semibold">
            Backup Health
          </Body>
        </div>
        <div className={`px-2.5 py-1 rounded-lg ${healthStatus.bg} ${healthStatus.color}`}>
          <Caption className="font-medium">{healthStatus.label}</Caption>
        </div>
      </div>

      {/* Stats */}
      <div className="p-5 space-y-4">
        {/* Success Rate */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-layer-2 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <Icons.CheckCircle size={12} className="text-[var(--color-success)]" />
              <Caption color="tertiary" className="font-medium uppercase tracking-wider">
                7-Day Success
              </Caption>
            </div>
            <Title level={2}>{stats.successRate7Days}%</Title>
            <Caption size="sm" color="tertiary">
              {stats.backupsLast7Days} backup{stats.backupsLast7Days !== 1 ? 's' : ''}
            </Caption>
          </div>

          <div className="p-3 bg-layer-2 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <Icons.Calendar size={12} className="text-[var(--color-info)]" />
              <Caption color="tertiary" className="font-medium uppercase tracking-wider">
                30-Day Success
              </Caption>
            </div>
            <Title level={2}>{stats.successRate30Days}%</Title>
            <Caption size="sm" color="tertiary">
              {stats.totalBackups} total
            </Caption>
          </div>
        </div>

        {/* Avg Duration */}
        {stats.avgDuration !== null && (
          <div className="flex items-center justify-between p-3 bg-layer-2 rounded-xl">
            <div className="flex items-center gap-2">
              <Icons.Clock size={14} className="text-accent-primary" />
              <Body size="sm" color="secondary">
                Avg Duration
              </Body>
            </div>
            <Body size="sm" weight="medium">
              {stats.avgDuration < 60
                ? `${stats.avgDuration}s`
                : `${Math.floor(stats.avgDuration / 60)}m ${stats.avgDuration % 60}s`}
            </Body>
          </div>
        )}

        {/* Latest Backup */}
        {stats.latestBackup && (
          <div className="flex items-center justify-between p-3 bg-layer-2 rounded-xl">
            <div className="flex items-center gap-2">
              <Icons.Clock size={14} className="text-text-tertiary" />
              <Body size="sm" color="secondary">
                Latest Backup
              </Body>
            </div>
            <Body size="sm" weight="medium">
              {stats.latestBackup.timestamp
                ? formatDistanceToNow(new Date(stats.latestBackup.timestamp), { addSuffix: true })
                : '--'}
            </Body>
          </div>
        )}

        {/* Last Failure (if any) */}
        {stats.lastFailure && (
          <div className="p-3 bg-[var(--color-error-subtle)] rounded-xl border border-[var(--color-error)]">
            <div className="flex items-center gap-2 mb-1">
              <Icons.AlertCircle size={14} className="text-[var(--color-error)]" />
              <Caption className="font-medium text-[var(--color-error)]">Last Failure</Caption>
            </div>
            <Body size="sm" color="error">
              {(stats.lastFailure as any).jobName}
            </Body>
            <Caption size="sm" className="text-[var(--color-error)] opacity-70">
              {stats.lastFailure.timestamp
                ? formatDistanceToNow(new Date(stats.lastFailure.timestamp), { addSuffix: true })
                : '--'}
            </Caption>
          </div>
        )}

        {/* No failures */}
        {!stats.lastFailure && stats.totalBackups > 0 && (
          <div className="p-3 bg-[var(--color-success-subtle)] rounded-xl border border-[var(--color-success)]">
            <div className="flex items-center gap-2">
              <Icons.CheckCircle size={14} className="text-[var(--color-success)]" />
              <Body size="sm" color="success">
                No recent failures
              </Body>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
