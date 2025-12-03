import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../components/IconComponents';
import { DiskStats, LogEntry, RsyncProgressData, SyncJob, SyncMode } from '../types';
import { FileBrowser } from '../components/FileBrowser';
import { api } from '../api';
import { logger } from '../utils/logger';
import {
  JobDetailHeader,
  StorageUsage,
  StatsQuickView,
  StorageHistory,
  JobAnalytics,
  JobAnalyticsPlaceholder,
  SnapshotList,
  LiveActivity,
  SnapshotGrouping,
  JobAnalyticsData,
  buildSnapshotFolderName,
  groupSnapshots,
} from '../components/job-detail';

interface JobDetailProps {
  job: SyncJob;
  diskStats: Record<string, DiskStats>;
  isRunning: boolean;
  progress: RsyncProgressData | null;
  logs: LogEntry[];
  onBack: () => void;
  onRun: (jobId: string) => void;
  onStop: (jobId: string) => void;
  onOpenSettings: () => void;
  onDelete: (jobId: string) => void;
  onRestore: (jobId: string) => void;
}

export const JobDetail: React.FC<JobDetailProps> = ({
  job,
  diskStats,
  isRunning,
  progress,
  logs,
  onBack,
  onRun,
  onStop,
  onOpenSettings,
  onDelete,
  onRestore,
}) => {
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
  const [snapshotGrouping, setSnapshotGrouping] = useState<SnapshotGrouping>('ALL');
  const [activeBrowserPath, setActiveBrowserPath] = useState<string | null>(null);
  const [activeBrowserTimestamp, setActiveBrowserTimestamp] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'size'>('date');

  // Reset state when job changes
  useEffect(() => {
    setSnapshotGrouping('ALL');
    setIsTerminalExpanded(false);
    setActiveBrowserPath(null);
    setActiveBrowserTimestamp(null);
    setSortBy('date');
  }, [job.id]);

  // Chart data for storage history
  const chartData = useMemo(
    () =>
      (job.snapshots ?? []).map((s, i, arr) => {
        const prevSize = i > 0 ? arr[i - 1].sizeBytes : 0;
        const dataAdded = Math.max(0, s.sizeBytes - prevSize);
        return {
          name: new Date(s.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          size: s.sizeBytes / (1024 * 1024),
          dataAdded: dataAdded / (1024 * 1024),
          changes: s.changesCount,
          timestamp: s.timestamp,
        };
      }),
    [job.snapshots ?? []]
  );

  // Latest snapshot for analytics
  const snapshots = job.snapshots ?? [];
  const latestSnapshot = snapshots[snapshots.length - 1];
  const [analytics, setAnalytics] = useState<JobAnalyticsData | null>(null);

  // Fetch analytics directly from SQLite index (fast!)
  useEffect(() => {
    if (!latestSnapshot) {
      setAnalytics(null);
      return;
    }

    // Parallel fetch of file type stats and largest files from SQLite
    Promise.all([
      api.getFileTypeStats(job.id, latestSnapshot.timestamp, 5),
      api.getLargestFiles(job.id, latestSnapshot.timestamp, 5),
    ])
      .then(([fileTypeStats, largestFiles]) => {
        setAnalytics({
          fileTypes: fileTypeStats.map(ft => ({
            name: ft.extension || 'No ext',
            value: ft.count,
          })),
          largestFiles: largestFiles,
        });
      })
      .catch(err => {
        logger.error('Failed to fetch analytics from index', err);
        setAnalytics(null);
      });
  }, [latestSnapshot, job.id]);

  // Group snapshots based on grouping preference
  const groupedSnapshots = useMemo(
    () => groupSnapshots(job.snapshots ?? [], snapshotGrouping, sortBy),
    [job.snapshots ?? [], snapshotGrouping, sortBy]
  );

  // Handlers
  const handleOpenSnapshot = (timestamp: number) => {
    if (!job.destPath) return;
    const folderName = buildSnapshotFolderName(timestamp);
    const fullPath =
      job.mode === SyncMode.TIME_MACHINE ? `${job.destPath}/${folderName}` : job.destPath;
    api.openPath(fullPath);
  };

  const handleBrowseSnapshot = (timestamp: number) => {
    if (!job.destPath) return;
    const folderName = buildSnapshotFolderName(timestamp);
    const fullPath =
      job.mode === SyncMode.TIME_MACHINE ? `${job.destPath}/${folderName}` : job.destPath;
    setActiveBrowserPath(fullPath);
    setActiveBrowserTimestamp(timestamp);
  };

  const handleShowFile = (path: string) => {
    if (!job.destPath || !latestSnapshot) return;
    const folderName = buildSnapshotFolderName(latestSnapshot.timestamp);
    const basePath =
      job.mode === SyncMode.TIME_MACHINE ? `${job.destPath}/${folderName}` : job.destPath;
    // Path from index is relative (e.g., "Archive/file.csv"), needs leading slash
    const fullPath = path.startsWith('/') ? `${basePath}${path}` : `${basePath}/${path}`;
    api.showItemInFolder(fullPath);
  };

  const handleBackFromBrowser = () => {
    setActiveBrowserPath(null);
    setActiveBrowserTimestamp(null);
  };

  return (
    <div className="h-screen flex flex-col relative z-10">
      <JobDetailHeader
        job={job}
        isRunning={isRunning}
        onBack={activeBrowserPath ? handleBackFromBrowser : onBack}
        onRun={onRun}
        onStop={onStop}
        onOpenSettings={onOpenSettings}
        onDelete={onDelete}
        onRestore={onRestore}
        titleOverride={activeBrowserPath ? 'File Browser' : undefined}
      />

      <div className="flex-1 overflow-auto p-8">
        {activeBrowserPath ? (
          <div className="h-full animate-fade-in">
            <FileBrowser
              initialPath={activeBrowserPath}
              jobId={job.id}
              snapshotTimestamp={activeBrowserTimestamp ?? undefined}
            />
          </div>
        ) : (
          <div
            className={`transition-all duration-500 ${isTerminalExpanded ? 'fixed inset-0 z-50 bg-black/90 p-8 overflow-auto' : 'grid grid-cols-1 lg:grid-cols-3 gap-8'}`}
          >
            {isTerminalExpanded && (
              <button
                onClick={() => setIsTerminalExpanded(false)}
                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full z-50"
              >
                <Icons.XCircle size={24} />
              </button>
            )}

            {/* LEFT COLUMN: Main Content */}
            <div className={`${isTerminalExpanded ? 'w-full h-full' : 'lg:col-span-2 space-y-8'}`}>
              {!isTerminalExpanded && <StorageUsage job={job} diskStats={diskStats} />}

              <LiveActivity
                isRunning={isRunning}
                progress={progress}
                logs={logs}
                isTerminalExpanded={isTerminalExpanded}
                onExpand={() => setIsTerminalExpanded(true)}
              />

              {!isTerminalExpanded && (
                <SnapshotList
                  job={job}
                  snapshots={groupedSnapshots}
                  snapshotGrouping={snapshotGrouping}
                  onGroupingChange={setSnapshotGrouping}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  onOpenSnapshot={handleOpenSnapshot}
                  onBrowseSnapshot={handleBrowseSnapshot}
                />
              )}
            </div>

            {/* RIGHT COLUMN: Sidebar */}
            {!isTerminalExpanded && (
              <div className="space-y-6">
                <StatsQuickView job={job} />
                <StorageHistory chartData={chartData} />
                {analytics ? (
                  <JobAnalytics analytics={analytics} onShowFile={handleShowFile} />
                ) : (
                  <JobAnalyticsPlaceholder />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
