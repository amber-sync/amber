import React, { useState } from 'react';
import { SyncJob, DiskStats } from '../types';
import { Icons } from '../components/IconComponents';
import { TimelineStrip } from '../components/timeline/TimelineStrip';
import { TimeContextPanel } from '../components/timeline/TimeContextPanel';
import { SnapshotSearch } from '../components/timeline/SnapshotSearch';
import { BackupCalendar, StorageProjection, BackupHealth } from '../components/analytics';
import { useTimeline, TimelineSnapshot } from '../hooks/useTimeline';
import { formatBytes } from '../utils/formatters';

interface TimelineViewProps {
  jobs: SyncJob[];
  diskStats?: Record<string, DiskStats>;
  onBrowseSnapshot?: (jobId: string, snapshotPath: string) => void;
  onCalendarDayClick?: (date: Date) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  jobs,
  diskStats = {},
  onBrowseSnapshot,
  onCalendarDayClick,
}) => {
  const [insightsExpanded, setInsightsExpanded] = useState(true);

  const {
    snapshots,
    selectedTimestamp,
    selectedSnapshot,
    zoomLevel,
    timeRange,
    selectSnapshot,
    setZoomLevel,
  } = useTimeline(jobs);

  // Calculate aggregate stats
  const totalSnapshots = snapshots.length;
  const totalSize = snapshots.reduce((acc, s) => acc + (s.sizeBytes || 0), 0);
  const successCount = snapshots.filter(s => s.status !== 'Failed').length;
  const successRate = totalSnapshots > 0 ? Math.round((successCount / totalSnapshots) * 100) : 0;

  const oldestSnapshot = snapshots[0];
  const newestSnapshot = snapshots[snapshots.length - 1];

  const handleBrowseSnapshot = (snapshot: TimelineSnapshot) => {
    if (onBrowseSnapshot && snapshot.path) {
      onBrowseSnapshot(snapshot.jobId, snapshot.path);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Timeline</h1>
            <p className="text-text-secondary mt-1">Travel through your backup history</p>
          </div>

          {/* Stats Bar */}
          {totalSnapshots > 0 && (
            <div className="flex items-center gap-4 bg-layer-1/50 backdrop-blur-md px-5 py-3 rounded-2xl border border-border-base shadow-sm">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Icons.Archive size={14} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wider">
                    Snapshots
                  </div>
                  <div className="text-sm font-bold text-text-primary leading-none">
                    {totalSnapshots}
                  </div>
                </div>
              </div>

              <div className="w-px h-8 bg-border-base" />

              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Icons.HardDrive size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wider">
                    Total Size
                  </div>
                  <div className="text-sm font-bold text-text-primary leading-none">
                    {formatBytes(totalSize)}
                  </div>
                </div>
              </div>

              <div className="w-px h-8 bg-border-base" />

              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Icons.CheckCircle size={14} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wider">
                    Success
                  </div>
                  <div className="text-sm font-bold text-text-primary leading-none">
                    {successRate}%
                  </div>
                </div>
              </div>

              {oldestSnapshot && newestSnapshot && (
                <>
                  <div className="w-px h-8 bg-border-base" />
                  <div>
                    <div className="text-[10px] text-text-tertiary uppercase tracking-wider">
                      Range
                    </div>
                    <div className="text-xs text-text-secondary">
                      {new Date(oldestSnapshot.timestamp || 0).toLocaleDateString()} –{' '}
                      {new Date(newestSnapshot.timestamp || 0).toLocaleDateString()}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Timeline Strip */}
        <TimelineStrip
          snapshots={snapshots}
          selectedTimestamp={selectedTimestamp}
          timeRange={timeRange}
          zoomLevel={zoomLevel}
          onSelectSnapshot={selectSnapshot}
          onZoomChange={setZoomLevel}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Context Panel - Takes 1/3 on large screens */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <TimeContextPanel
              selectedSnapshot={selectedSnapshot}
              onBrowseSnapshot={onBrowseSnapshot ? handleBrowseSnapshot : undefined}
            />
          </div>

          {/* Activity & Jobs - Takes 2/3 on large screens */}
          <div className="lg:col-span-2 order-2 lg:order-1 space-y-6">
            {/* Jobs Summary */}
            <div className="bg-layer-1 rounded-2xl border border-border-base overflow-hidden">
              <div className="px-5 py-4 border-b border-border-base">
                <div className="flex items-center gap-2">
                  <Icons.Database size={16} className="text-accent-primary" />
                  <span className="text-sm font-semibold text-text-primary">Jobs Overview</span>
                </div>
              </div>

              <div className="p-4">
                {jobs.length > 0 ? (
                  <div className="space-y-2">
                    {jobs.map(job => {
                      const jobSnapshots = snapshots.filter(s => s.jobId === job.id);
                      const latestSnapshot = jobSnapshots[jobSnapshots.length - 1];
                      const isSelectedJob = selectedSnapshot?.jobId === job.id;

                      return (
                        <div
                          key={job.id}
                          className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                            isSelectedJob
                              ? 'bg-accent-primary/10 border border-accent-primary/30'
                              : 'bg-layer-2 hover:bg-layer-3'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                jobSnapshots.length > 0 ? 'bg-green-500' : 'bg-gray-400'
                              }`}
                            />
                            <div>
                              <div className="text-sm font-medium text-text-primary">
                                {job.name}
                              </div>
                              <div className="text-xs text-text-tertiary">
                                {jobSnapshots.length} snapshot{jobSnapshots.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>

                          {latestSnapshot && (
                            <div className="text-right">
                              <div className="text-xs text-text-secondary">
                                {new Date(latestSnapshot.timestamp || 0).toLocaleDateString()}
                              </div>
                              <div className="text-[10px] text-text-tertiary">
                                {latestSnapshot.sizeBytes
                                  ? formatBytes(latestSnapshot.sizeBytes)
                                  : '--'}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-text-tertiary">
                    <Icons.Database className="mx-auto mb-3 opacity-20" size={32} />
                    <p className="text-sm">No jobs configured yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-layer-1 rounded-2xl border border-border-base overflow-hidden">
              <div className="px-5 py-4 border-b border-border-base">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icons.Activity size={16} className="text-accent-primary" />
                    <span className="text-sm font-semibold text-text-primary">Recent Activity</span>
                  </div>
                  {snapshots.length > 5 && (
                    <span className="text-xs text-text-tertiary tabular-nums">
                      Showing last 5 of {snapshots.length}
                    </span>
                  )}
                </div>
              </div>

              <div className="divide-y divide-border-base">
                {snapshots.length > 0 ? (
                  [...snapshots]
                    .reverse()
                    .slice(0, 5)
                    .map((snapshot, index) => {
                      const isSelected = snapshot.timestamp === selectedTimestamp;

                      return (
                        <button
                          key={snapshot.id || index}
                          onClick={() => selectSnapshot(snapshot)}
                          className={`group w-full flex items-center gap-3 p-4 text-left transition-all duration-200 ${
                            isSelected ? 'bg-accent-primary/10' : 'hover:bg-layer-2'
                          }`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${
                              snapshot.status === 'Failed'
                                ? 'bg-red-100 dark:bg-red-900/30'
                                : 'bg-green-100 dark:bg-green-900/30'
                            }`}
                          >
                            {snapshot.status === 'Failed' ? (
                              <Icons.XCircle size={16} className="text-red-600 dark:text-red-400" />
                            ) : (
                              <Icons.CheckCircle
                                size={16}
                                className="text-green-600 dark:text-green-400"
                              />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text-primary truncate">
                                {snapshot.jobName}
                              </span>
                              {isSelected && (
                                <span className="px-1.5 py-0.5 bg-accent-primary/20 text-accent-primary text-[10px] font-medium rounded animate-scale-in">
                                  Selected
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-text-tertiary">
                              {snapshot.timestamp
                                ? new Date(snapshot.timestamp).toLocaleString()
                                : 'Unknown date'}
                            </div>
                          </div>

                          <div className="text-right tabular-nums">
                            <div className="text-sm font-medium text-text-primary">
                              {snapshot.sizeBytes ? formatBytes(snapshot.sizeBytes) : '--'}
                            </div>
                            {snapshot.changesCount !== undefined && (
                              <div className="text-xs text-text-tertiary">
                                {snapshot.changesCount} changes
                              </div>
                            )}
                          </div>

                          <Icons.ChevronRight
                            size={16}
                            className="text-text-tertiary transition-transform duration-200 group-hover:translate-x-1"
                          />
                        </button>
                      );
                    })
                ) : (
                  <div className="py-12 text-center text-text-tertiary animate-fade-in">
                    <div className="w-16 h-16 rounded-2xl bg-layer-2 flex items-center justify-center mx-auto mb-4 animate-pulse-subtle">
                      <Icons.FolderClock size={28} className="text-text-quaternary" />
                    </div>
                    <p className="text-sm font-medium text-text-secondary">No backups yet</p>
                    <p className="text-xs mt-1">Run a backup job to see your timeline</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Snapshot Search */}
        <SnapshotSearch snapshots={snapshots} onSelectSnapshot={selectSnapshot} />

        {/* Collapsible Insights Section */}
        {jobs.length > 0 && (
          <div className="border-t border-border-base pt-6">
            <button
              onClick={() => setInsightsExpanded(!insightsExpanded)}
              className="flex items-center gap-2 mb-4 group transition-colors duration-200 hover:opacity-80"
            >
              <div className="p-1 bg-layer-2 rounded-lg group-hover:bg-layer-3 transition-colors duration-200">
                <Icons.ChevronDown
                  size={14}
                  className={`text-text-tertiary transition-transform duration-300 ease-out ${
                    insightsExpanded ? '' : '-rotate-90'
                  }`}
                />
              </div>
              <span className="text-sm font-semibold text-text-primary">Insights</span>
              <span className="text-xs text-text-tertiary transition-opacity duration-200 group-hover:text-text-secondary">
                {insightsExpanded ? 'Click to collapse' : 'Click to expand'}
              </span>
            </button>

            <div
              className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 transition-all duration-300 ease-out origin-top ${
                insightsExpanded
                  ? 'opacity-100 scale-100 max-h-[1000px]'
                  : 'opacity-0 scale-95 max-h-0 overflow-hidden pointer-events-none'
              }`}
            >
              <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                <BackupCalendar
                  jobs={jobs}
                  onDayClick={(date, backups) => {
                    // Jump to closest snapshot on that day
                    if (backups.length > 0) {
                      const dayStart = date.getTime();
                      const closest = snapshots.find(
                        s => s.timestamp && Math.abs(s.timestamp - dayStart) < 24 * 60 * 60 * 1000
                      );
                      if (closest) {
                        selectSnapshot(closest);
                      }
                    }
                    onCalendarDayClick?.(date);
                  }}
                />
              </div>
              <div className="animate-fade-in-up" style={{ animationDelay: '75ms' }}>
                <StorageProjection jobs={jobs} diskStats={diskStats} />
              </div>
              <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
                <BackupHealth jobs={jobs} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
