/**
 * SnapshotFocus - Central content panel showing selected snapshot details
 *
 * Displays date, time, stats, and quick actions for the selected snapshot.
 * Uses the Observatory design language with prominent typography.
 */

import { useMemo, useEffect, useState, useRef, memo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { SyncJob, FileTypeStats, LargestFile } from '../../../types';
import { TimeMachineSnapshot } from '../TimeMachinePage';
import { Icons } from '../../../components/IconComponents';
import { Title, Body, Caption, Code } from '../../../components/ui';
import { formatBytes } from '../../../utils';
import { api } from '../../../api';

interface SnapshotFocusProps {
  snapshot: TimeMachineSnapshot | null;
  job: SyncJob;
  onBrowseFiles: () => void;
  onRestore: () => void;
  onViewAnalytics: () => void;
  onRunBackup: () => void;
  onCompare: () => void;
  isRunning: boolean;
}

interface AnalyticsData {
  fileTypes: FileTypeStats[];
  largestFiles: LargestFile[];
}

// Cache analytics data to prevent re-fetching during navigation (TIM-167 performance fix)
const analyticsCache = new Map<string, AnalyticsData>();

function SnapshotFocusComponent({
  snapshot,
  job,
  onBrowseFiles,
  onRestore,
  onViewAnalytics,
  onRunBackup,
  onCompare,
  isRunning,
}: SnapshotFocusProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Track pending requests to avoid race conditions
  const pendingRequestRef = useRef<string | null>(null);

  // Load analytics when snapshot changes - with caching
  useEffect(() => {
    if (!snapshot || !job.destPath) {
      setAnalytics(null);
      return;
    }

    const cacheKey = `${job.id}-${snapshot.timestamp}`;

    // Check cache first - instant return if we have data
    const cached = analyticsCache.get(cacheKey);
    if (cached) {
      setAnalytics(cached);
      setAnalyticsLoading(false);
      return;
    }

    const loadAnalytics = async () => {
      // Track this request
      pendingRequestRef.current = cacheKey;
      setAnalyticsLoading(true);

      try {
        const [fileTypes, largestFiles] = await Promise.all([
          api.getFileTypeStatsOnDestination(job.destPath, job.id, snapshot.timestamp, 6),
          api.getLargestFilesOnDestination(job.destPath, job.id, snapshot.timestamp, 3),
        ]);

        const data = { fileTypes, largestFiles };

        // Only update if this is still the pending request (user hasn't navigated away)
        if (pendingRequestRef.current === cacheKey) {
          analyticsCache.set(cacheKey, data);
          setAnalytics(data);
        }
      } catch (err) {
        console.error('Failed to load analytics:', err);
        if (pendingRequestRef.current === cacheKey) {
          setAnalytics(null);
        }
      } finally {
        if (pendingRequestRef.current === cacheKey) {
          setAnalyticsLoading(false);
        }
      }
    };

    // Load analytics immediately - caching handles rapid navigation (TIM-167)
    loadAnalytics();
    return () => {
      pendingRequestRef.current = null;
    };
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
        <Title level={2} className="tm-empty-title">
          Select a Snapshot
        </Title>
        <Body size="sm" color="secondary" className="tm-empty-desc">
          Click on a marker in the timeline to view snapshot details
        </Body>
      </div>
    );
  }

  return (
    <div className="tm-focus">
      {/* Date display - prominent typography */}
      <div>
        <Title level={1} className="tm-focus-date">
          {dateParts.month} {dateParts.day}, {dateParts.year}
        </Title>
        <Body size="lg" className="tm-focus-time">
          {dateParts.weekday}, {dateParts.time}
        </Body>
        <Caption color="secondary" className="tm-focus-relative">
          {dateParts.relative}
        </Caption>
      </div>

      {/* Stats grid */}
      <div className="tm-stats-grid">
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
      <div className="tm-actions">
        <button onClick={onBrowseFiles} className="tm-action-btn tm-action-btn--primary">
          <Icons.FolderOpen size={18} />
          <Body size="sm" weight="medium">
            Browse Files
          </Body>
        </button>
        <button onClick={onRestore} className="tm-action-btn tm-action-btn--secondary">
          <Icons.RotateCcw size={18} />
          <Body size="sm" weight="medium">
            Restore
          </Body>
        </button>
        <button onClick={onCompare} className="tm-action-btn tm-action-btn--secondary">
          <Icons.GitCompare size={18} />
          <Body size="sm" weight="medium">
            Compare
          </Body>
        </button>
        <button
          onClick={() => snapshot.path && api.openPath(snapshot.path)}
          className="tm-action-btn tm-action-btn--secondary"
        >
          <Icons.ExternalLink size={18} />
          <Body size="sm" weight="medium">
            Open in Finder
          </Body>
        </button>
      </div>

      {/* Analytics preview - always rendered to prevent layout shift (TIM-172) */}
      <div className="tm-analytics">
        {analyticsLoading ? (
          <>
            <div className="tm-analytics-header">
              <Caption className="tm-analytics-title font-weight-medium">File Types</Caption>
              <button onClick={onViewAnalytics} className="tm-analytics-expand">
                <Caption color="secondary">View all →</Caption>
              </button>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-8 w-20 bg-[var(--tm-dust)] rounded-lg animate-pulse" />
              ))}
            </div>
          </>
        ) : analytics?.fileTypes && analytics.fileTypes.length > 0 ? (
          <>
            <div className="tm-analytics-header">
              <Caption className="tm-analytics-title font-weight-medium">File Types</Caption>
              <button onClick={onViewAnalytics} className="tm-analytics-expand">
                <Caption color="secondary">View all →</Caption>
              </button>
            </div>
            <div className="tm-file-types">
              {analytics.fileTypes.slice(0, 6).map((ft, i) => (
                <div key={i} className="tm-file-type">
                  <Code size="sm" className="tm-file-type-ext">
                    .{ft.extension || 'other'}
                  </Code>
                  <Caption size="sm" className="tm-file-type-count">
                    ({ft.count})
                  </Caption>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="tm-analytics-header">
              <Caption className="tm-analytics-title font-weight-medium">File Types</Caption>
            </div>
            <Body size="sm" className="text-[var(--tm-text-dim)]">
              No file type data available
            </Body>
          </>
        )}
      </div>

      {/* Status indicator - more prominent */}
      <div className="mt-6 flex items-center gap-2">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            snapshot.status === 'Complete'
              ? 'bg-success'
              : snapshot.status === 'Partial'
                ? 'bg-warning'
                : 'bg-error'
          }`}
        />
        <Body
          size="sm"
          className={
            snapshot.status === 'Complete'
              ? 'text-success'
              : snapshot.status === 'Partial'
                ? 'text-warning'
                : 'text-error'
          }
        >
          {snapshot.status || 'Complete'}
        </Body>
        {snapshot.path && (
          <>
            <Caption className="text-[var(--tm-text-muted)]">•</Caption>
            <Code size="sm" truncate className="max-w-xs text-[var(--tm-text-dim)]">
              {snapshot.path.split('/').pop()}
            </Code>
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
        <Caption color="secondary" className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </Caption>
      </div>
      <div className={`tm-stat-value ${highlight ? 'tm-stat-value--amber' : ''}`}>
        <Body size="lg" weight="semibold">
          {value}
        </Body>
      </div>
    </div>
  );
}

export const SnapshotFocus = memo(SnapshotFocusComponent);
SnapshotFocus.displayName = 'SnapshotFocus';

export default SnapshotFocus;
