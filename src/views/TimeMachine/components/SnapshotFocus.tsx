/**
 * SnapshotFocus - Central content panel showing selected snapshot details
 *
 * Displays date, time, stats, and quick actions for the selected snapshot.
 * Uses the Observatory design language with prominent typography.
 */

import { useMemo, useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { SyncJob, FileTypeStats, LargestFile } from '../../../types';
import { TimeMachineSnapshot } from '../TimeMachine';
import { Icons } from '../../../components/IconComponents';
import { formatBytes } from '../../../utils';
import { api } from '../../../api';

interface SnapshotFocusProps {
  snapshot: TimeMachineSnapshot | null;
  job: SyncJob;
  onBrowseFiles: () => void;
  onRestore: () => void;
  onViewAnalytics: () => void;
  onRunBackup: () => void;
  isRunning: boolean;
}

interface AnalyticsData {
  fileTypes: FileTypeStats[];
  largestFiles: LargestFile[];
}

export function SnapshotFocus({
  snapshot,
  job,
  onBrowseFiles,
  onRestore,
  onViewAnalytics,
  onRunBackup,
  isRunning,
}: SnapshotFocusProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Load analytics when snapshot changes
  useEffect(() => {
    if (!snapshot || !job.destPath) {
      setAnalytics(null);
      return;
    }

    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const [fileTypes, largestFiles] = await Promise.all([
          api.getFileTypeStatsOnDestination(job.destPath, job.id, snapshot.timestamp, 6),
          api.getLargestFilesOnDestination(job.destPath, job.id, snapshot.timestamp, 3),
        ]);
        setAnalytics({ fileTypes, largestFiles });
      } catch (err) {
        console.error('Failed to load analytics:', err);
        setAnalytics(null);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    // Small delay to avoid loading during rapid navigation
    const timer = setTimeout(loadAnalytics, 200);
    return () => clearTimeout(timer);
  }, [snapshot?.timestamp, job.id, job.destPath]);

  // Format date parts
  const dateParts = useMemo(() => {
    if (!snapshot) return null;
    const date = new Date(snapshot.timestamp);
    return {
      weekday: format(date, 'EEEE'),
      month: format(date, 'MMMM'),
      day: format(date, 'd'),
      year: format(date, 'yyyy'),
      time: format(date, 'h:mm:ss a'),
      relative: formatDistanceToNow(date, { addSuffix: true }),
    };
  }, [snapshot]);

  // No snapshot selected
  if (!snapshot || !dateParts) {
    return (
      <div className="tm-focus">
        <div className="tm-empty-icon">
          <Icons.Clock size={32} />
        </div>
        <h2 className="tm-empty-title">Select a Snapshot</h2>
        <p className="tm-empty-desc">Click on a marker in the timeline to view snapshot details</p>
      </div>
    );
  }

  return (
    <div className="tm-focus">
      {/* Date display - prominent typography */}
      <div className="tm-animate-slide-up">
        <h1 className="tm-focus-date tm-font-display">
          {dateParts.month} {dateParts.day}, {dateParts.year}
        </h1>
        <p className="tm-focus-time tm-font-body">
          {dateParts.weekday}, {dateParts.time}
        </p>
        <p className="tm-focus-relative">{dateParts.relative}</p>
      </div>

      {/* Stats grid */}
      <div className="tm-stats-grid tm-animate-slide-up tm-stagger-1">
        <StatCard
          icon={<Icons.File size={16} />}
          label="Files"
          value={snapshot.fileCount?.toLocaleString() ?? '—'}
        />
        <StatCard
          icon={<Icons.HardDrive size={16} />}
          label="Size"
          value={formatBytes(snapshot.sizeBytes ?? 0)}
        />
        <StatCard
          icon={<Icons.RefreshCw size={16} />}
          label="Changes"
          value={snapshot.changesCount?.toLocaleString() ?? '—'}
          highlight={Boolean(snapshot.changesCount && snapshot.changesCount > 0)}
        />
        <StatCard
          icon={<Icons.Zap size={16} />}
          label="Duration"
          value={snapshot.duration ? `${Math.round(snapshot.duration / 1000)}s` : '—'}
        />
      </div>

      {/* Quick actions */}
      <div className="tm-actions tm-animate-slide-up tm-stagger-2">
        <button onClick={onBrowseFiles} className="tm-action-btn tm-action-btn--primary">
          <Icons.FolderOpen size={18} />
          <span>Browse Files</span>
        </button>
        <button onClick={onRestore} className="tm-action-btn tm-action-btn--secondary">
          <Icons.RotateCcw size={18} />
          <span>Restore</span>
        </button>
        <button
          onClick={() => snapshot.path && api.openPath(snapshot.path)}
          className="tm-action-btn tm-action-btn--secondary"
        >
          <Icons.ExternalLink size={18} />
          <span>Open in Finder</span>
        </button>
      </div>

      {/* Analytics preview */}
      {(analytics || analyticsLoading) && (
        <div className="tm-analytics tm-animate-slide-up tm-stagger-3">
          <div className="tm-analytics-header">
            <span className="tm-analytics-title">File Types</span>
            <button onClick={onViewAnalytics} className="tm-analytics-expand">
              View all →
            </button>
          </div>
          {analyticsLoading ? (
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-8 w-20 bg-[var(--tm-dust)] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : analytics?.fileTypes && analytics.fileTypes.length > 0 ? (
            <div className="tm-file-types">
              {analytics.fileTypes.slice(0, 6).map((ft, i) => (
                <div key={i} className="tm-file-type">
                  <span className="tm-file-type-ext">.{ft.extension || 'other'}</span>
                  <span className="tm-file-type-count">({ft.count})</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--tm-text-dim)]">No file type data available</p>
          )}
        </div>
      )}

      {/* Status indicator */}
      <div className="mt-6 flex items-center gap-2 text-xs tm-animate-fade-in tm-stagger-4">
        <div
          className={`w-2 h-2 rounded-full ${
            snapshot.status === 'Complete'
              ? 'bg-[var(--tm-success)]'
              : snapshot.status === 'Partial'
                ? 'bg-[var(--tm-warning)]'
                : 'bg-[var(--tm-error)]'
          }`}
        />
        <span className="text-[var(--tm-text-dim)]">{snapshot.status || 'Complete'} backup</span>
        {snapshot.path && (
          <>
            <span className="text-[var(--tm-text-muted)]">•</span>
            <span className="text-[var(--tm-text-dim)] font-mono truncate max-w-xs">
              {snapshot.path.split('/').pop()}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// Stat card component
function StatCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="tm-stat">
      <div className="tm-stat-label">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
      </div>
      <div className={`tm-stat-value ${highlight ? 'tm-stat-value--amber' : ''}`}>{value}</div>
    </div>
  );
}

export default SnapshotFocus;
