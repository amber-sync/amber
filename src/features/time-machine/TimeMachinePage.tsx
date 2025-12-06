/**
 * TimeMachine - Unified Backup Time Travel Experience
 *
 * Replaces TimeExplorer, TimelineView, and JobDetail with a single
 * immersive interface centered on timeline navigation.
 *
 * @see docs/UNIFIED_TIME_MACHINE_DESIGN.md
 */

/**
 * TIM-205: Uses specific context hooks for better performance
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useJobs } from '../../context/JobsContext';
import { useUI } from '../../context/UIContext';
import { api } from '../../api';
import { Snapshot, SyncJob, LogEntry, RsyncProgressData } from '../../types';
import { Icons } from '../../components/IconComponents';
import { formatBytes } from '../../utils';

// Components
import { TimeMachineHeader } from './components/TimeMachineHeader';
import { TimelineRuler } from './components/TimelineRuler';
import { SnapshotFocus } from './components/SnapshotFocus';
import { LiveActivityBar } from './components/LiveActivityBar';
import { FileExplorerOverlay } from './components/FileExplorerOverlay';
import { RestoreOverlay } from './components/RestoreOverlay';
import { AnalyticsOverlay } from './components/AnalyticsOverlay';
import { TerminalOverlay } from './components/TerminalOverlay';
import { EmptyState } from './components/EmptyState';
import { SlidePanel } from '../../components/explorer/panels/SlidePanel';
import { EditJobPanel } from '../../components/explorer/panels/EditJobPanel';
import { PageContainer } from '../../components/layout';

// Styles
import './timemachine.css';

export type OverlayType = 'files' | 'restore' | 'analytics' | 'terminal' | null;
export type DateFilter = 'all' | '7days' | '30days' | '90days' | 'year';

export interface TimeMachineSnapshot extends Snapshot {
  jobId: string;
  jobName: string;
}

interface TimeMachineProps {
  /** Pre-selected job ID (from navigation) */
  initialJobId?: string;
  /** Live sync state from parent context */
  isRunning?: boolean;
  progress?: RsyncProgressData | null;
  logs?: LogEntry[];
}

export function TimeMachinePage({
  initialJobId,
  isRunning = false,
  progress = null,
  logs = [],
}: TimeMachineProps) {
  const { jobs, runSync, stopSync, persistJob, deleteJob } = useJobs();
  const { activeJobId, setActiveJobId, setView, navigateBack } = useUI();

  // Current job
  const [currentJobId, setCurrentJobId] = useState<string | null>(
    initialJobId || activeJobId || null
  );

  // Sync currentJobId when navigating to TimeMachine with different job (component stays mounted)
  useEffect(() => {
    if (initialJobId && initialJobId !== currentJobId) {
      setCurrentJobId(initialJobId);
    }
  }, [initialJobId]);

  const currentJob = useMemo(
    () => jobs.find((j: SyncJob) => j.id === currentJobId) || null,
    [jobs, currentJobId]
  );

  // Snapshots for current job - use in-memory data immediately for instant render
  const [snapshots, setSnapshots] = useState<TimeMachineSnapshot[]>(() => {
    // Initialize from in-memory job data for instant render
    const job = jobs.find((j: SyncJob) => j.id === (initialJobId || activeJobId));
    if (job?.snapshots?.length) {
      return job.snapshots
        .map(s => ({ ...s, jobId: job.id, jobName: job.name }))
        .sort((a, b) => a.timestamp - b.timestamp);
    }
    return [];
  });
  const [loading, setLoading] = useState(false); // Start as false since we have in-memory data

  // Date filter state (TIM-151)
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  // Timeline state - initialize to latest snapshot for instant render
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(() => {
    const job = jobs.find((j: SyncJob) => j.id === (initialJobId || activeJobId));
    if (job?.snapshots?.length) {
      const sorted = [...job.snapshots].sort((a, b) => a.timestamp - b.timestamp);
      return sorted[sorted.length - 1].timestamp;
    }
    return null;
  });

  // Filtered snapshots based on date range (TIM-151)
  const filteredSnapshots = useMemo(() => {
    if (dateFilter === 'all' || !snapshots.length) return snapshots;

    const now = Date.now();
    const cutoffs: Record<DateFilter, number> = {
      all: 0,
      '7days': 7 * 24 * 60 * 60 * 1000,
      '30days': 30 * 24 * 60 * 60 * 1000,
      '90days': 90 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };

    const cutoff = now - cutoffs[dateFilter];
    return snapshots.filter(s => s.timestamp >= cutoff);
  }, [snapshots, dateFilter]);

  // Create a Map for O(1) snapshot lookup instead of Array.find()
  const snapshotMap = useMemo(() => {
    const map = new Map<number, TimeMachineSnapshot>();
    filteredSnapshots.forEach(s => map.set(s.timestamp, s));
    return map;
  }, [filteredSnapshots]);

  const selectedSnapshot = useMemo(
    () => (selectedTimestamp ? snapshotMap.get(selectedTimestamp) || null : null),
    [snapshotMap, selectedTimestamp]
  );

  // Overlay state
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null);
  const [fileBrowserPath, setFileBrowserPath] = useState<string | null>(null);
  const [showEditPanel, setShowEditPanel] = useState(false);

  // Comparison state (TIM-150)
  const [compareMode, setCompareMode] = useState(false);
  const [compareSnapshot, setCompareSnapshot] = useState<TimeMachineSnapshot | null>(null);

  // Sync snapshots from in-memory job data (instant, no loading state)
  useEffect(() => {
    if (!currentJob) {
      setSnapshots([]);
      return;
    }

    // Use in-memory snapshots directly - no API call needed for instant render
    const jobSnapshots = currentJob.snapshots ?? [];
    const enriched: TimeMachineSnapshot[] = jobSnapshots
      .map(s => ({
        ...s,
        jobId: currentJob.id,
        jobName: currentJob.name,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    setSnapshots(enriched);

    // Auto-select latest snapshot if none selected
    if (enriched.length > 0 && !selectedTimestamp) {
      setSelectedTimestamp(enriched[enriched.length - 1].timestamp);
    }
  }, [currentJob, currentJob?.snapshots?.length]);

  // Background refresh from API (optional, non-blocking)
  useEffect(() => {
    if (!currentJob) return;

    const refreshFromApi = async () => {
      try {
        const snapshotList = await api.listSnapshots(currentJob.id, currentJob.destPath);
        // Only update if we got more snapshots than in-memory
        if (snapshotList.length > (currentJob.snapshots?.length ?? 0)) {
          const enriched: TimeMachineSnapshot[] = snapshotList
            .map(s => ({
              ...s,
              jobId: currentJob.id,
              jobName: currentJob.name,
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
          setSnapshots(enriched);
        }
      } catch (error) {
        // Silently fail - we already have in-memory data
        console.debug('Background snapshot refresh failed:', error);
      }
    };

    // Delay API call to not block initial render
    const timer = setTimeout(refreshFromApi, 500);
    return () => clearTimeout(timer);
  }, [currentJob?.id]);

  // Sync active job with context
  useEffect(() => {
    if (currentJobId && currentJobId !== activeJobId) {
      setActiveJobId(currentJobId);
    }
  }, [currentJobId, activeJobId, setActiveJobId]);

  // Handler needs to be declared before keyboard useEffect that uses it
  const handleBrowseFiles = useCallback(() => {
    if (selectedSnapshot?.path) {
      setFileBrowserPath(selectedSnapshot.path);
      setActiveOverlay('files');
    }
  }, [selectedSnapshot]);

  // Keyboard navigation (TIM-149)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Don't handle if any overlay is open (except Escape)
      if (activeOverlay && e.key !== 'Escape') {
        return;
      }

      // Don't handle if edit panel is open (except Escape)
      if (showEditPanel && e.key !== 'Escape') {
        return;
      }

      const currentIndex = filteredSnapshots.findIndex(s => s.timestamp === selectedTimestamp);

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          // Navigate to previous snapshot
          if (filteredSnapshots.length > 0 && currentIndex > 0) {
            setSelectedTimestamp(filteredSnapshots[currentIndex - 1].timestamp);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          // Navigate to next snapshot
          if (filteredSnapshots.length > 0 && currentIndex < filteredSnapshots.length - 1) {
            setSelectedTimestamp(filteredSnapshots[currentIndex + 1].timestamp);
          }
          break;
        case 'Escape':
          e.preventDefault();
          // Close any open panel/overlay
          if (showEditPanel) {
            setShowEditPanel(false);
          } else if (activeOverlay) {
            setActiveOverlay(null);
            setFileBrowserPath(null);
          }
          break;
        case 'Enter':
          e.preventDefault();
          // Open file explorer for current snapshot
          if (selectedSnapshot && !activeOverlay && !showEditPanel) {
            handleBrowseFiles();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    filteredSnapshots,
    selectedTimestamp,
    showEditPanel,
    activeOverlay,
    selectedSnapshot,
    handleBrowseFiles,
  ]);

  // Handlers
  const handleJobSwitch = useCallback((jobId: string) => {
    setCurrentJobId(jobId);
    setSelectedTimestamp(null);
    setActiveOverlay(null);
    setDateFilter('all'); // Reset filter when switching jobs
  }, []);

  const handleBack = useCallback(() => {
    navigateBack();
  }, [navigateBack]);

  const handleSelectSnapshot = useCallback((timestamp: number) => {
    setSelectedTimestamp(timestamp);
  }, []);

  const handleRestore = useCallback(() => {
    setActiveOverlay('restore');
  }, []);

  const handleViewAnalytics = useCallback(() => {
    setActiveOverlay('analytics');
  }, []);

  const handleExpandTerminal = useCallback(() => {
    setActiveOverlay('terminal');
  }, []);

  const handleCloseOverlay = useCallback(() => {
    setActiveOverlay(null);
    setFileBrowserPath(null);
  }, []);

  const handleCompare = useCallback(() => {
    setCompareMode(true);
  }, []);

  const handleCloseCompare = useCallback(() => {
    setCompareMode(false);
    setCompareSnapshot(null);
  }, []);

  const handleRunBackup = useCallback(() => {
    if (currentJobId) {
      runSync(currentJobId);
    }
  }, [currentJobId, runSync]);

  const handleStopBackup = useCallback(() => {
    if (currentJobId) {
      stopSync(currentJobId);
    }
  }, [currentJobId, stopSync]);

  const handleEditJob = useCallback(() => {
    if (currentJobId) {
      setShowEditPanel(true);
    }
  }, [currentJobId]);

  const handleNewJob = useCallback(() => {
    setActiveJobId(null);
    setView('JOB_EDITOR');
  }, [setActiveJobId, setView]);

  const handleSaveJobEdit = useCallback(
    async (updatedJob: SyncJob) => {
      try {
        await persistJob(updatedJob);
        setShowEditPanel(false);
      } catch (error) {
        console.error('Failed to save job:', error);
      }
    },
    [persistJob]
  );

  const handleDeleteJob = useCallback(async () => {
    if (!currentJobId) return;
    try {
      await deleteJob(currentJobId);
      setShowEditPanel(false);
      // Navigate back to dashboard after deleting current job
      setView('DASHBOARD');
    } catch (error) {
      console.error('Failed to delete job:', error);
    }
  }, [currentJobId, deleteJob, setView]);

  // Calculate time range from filtered snapshots (TIM-151)
  const timeRange = useMemo(() => {
    if (filteredSnapshots.length === 0) {
      const now = Date.now();
      return { start: now - 30 * 24 * 60 * 60 * 1000, end: now };
    }
    const timestamps = filteredSnapshots.map(s => s.timestamp);
    return {
      start: Math.min(...timestamps),
      end: Date.now(),
    };
  }, [filteredSnapshots]);

  // No job selected state
  if (!currentJob) {
    return (
      <PageContainer width="full" noPadding scrollable>
        <div className="tm-container flex flex-col min-h-full">
          <TimeMachineHeader
            job={null}
            jobs={jobs}
            isRunning={false}
            progress={null}
            onJobSwitch={handleJobSwitch}
            onBack={handleBack}
            onRunBackup={handleRunBackup}
            onStopBackup={handleStopBackup}
            onEditJob={handleEditJob}
          />
          <EmptyState type="no-job" onAction={handleBack} actionLabel="Go to Dashboard" />
        </div>
      </PageContainer>
    );
  }

  // No snapshots state
  if (!loading && snapshots.length === 0) {
    return (
      <PageContainer width="full" noPadding scrollable>
        <div className="tm-container flex flex-col min-h-full">
          <TimeMachineHeader
            job={currentJob}
            jobs={jobs}
            isRunning={isRunning}
            progress={progress}
            onJobSwitch={handleJobSwitch}
            onBack={handleBack}
            onRunBackup={handleRunBackup}
            onStopBackup={handleStopBackup}
            onEditJob={handleEditJob}
          />
          <EmptyState
            type="no-snapshots"
            onAction={handleRunBackup}
            actionLabel="Run First Backup"
          />
          <LiveActivityBar
            isRunning={isRunning}
            progress={progress}
            logs={logs}
            onExpand={handleExpandTerminal}
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="full" noPadding scrollable>
      <div className="tm-container flex flex-col min-h-full">
        {/* Header with job switcher and controls (TIM-138, TIM-151) */}
        <TimeMachineHeader
          job={currentJob}
          jobs={jobs}
          isRunning={isRunning}
          progress={progress}
          onJobSwitch={handleJobSwitch}
          onBack={handleBack}
          onRunBackup={handleRunBackup}
          onStopBackup={handleStopBackup}
          onEditJob={handleEditJob}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          snapshotCount={filteredSnapshots.length}
          totalSnapshotCount={snapshots.length}
        />

        {/* Timeline - THE primary navigation (TIM-151: uses filtered snapshots) */}
        <TimelineRuler
          snapshots={filteredSnapshots}
          selectedTimestamp={selectedTimestamp}
          timeRange={timeRange}
          onSelectSnapshot={handleSelectSnapshot}
          loading={loading}
        />

        {/* Snapshot Focus - Central content */}
        <SnapshotFocus
          snapshot={selectedSnapshot}
          job={currentJob}
          onBrowseFiles={handleBrowseFiles}
          onRestore={handleRestore}
          onViewAnalytics={handleViewAnalytics}
          onRunBackup={handleRunBackup}
          onCompare={handleCompare}
          isRunning={isRunning}
        />

        {/* Live Activity Bar - Fixed at bottom during sync */}
        <LiveActivityBar
          isRunning={isRunning}
          progress={progress}
          logs={logs}
          onExpand={handleExpandTerminal}
        />

        {/* Overlays */}
        <FileExplorerOverlay
          isOpen={activeOverlay === 'files'}
          path={fileBrowserPath}
          jobId={currentJobId}
          snapshotTimestamp={selectedTimestamp}
          destPath={currentJob.destPath}
          onClose={handleCloseOverlay}
        />

        <RestoreOverlay
          isOpen={activeOverlay === 'restore'}
          job={currentJob}
          snapshot={selectedSnapshot}
          snapshots={filteredSnapshots}
          onClose={handleCloseOverlay}
        />

        <AnalyticsOverlay
          isOpen={activeOverlay === 'analytics'}
          job={currentJob}
          snapshot={selectedSnapshot}
          onClose={handleCloseOverlay}
        />

        <TerminalOverlay
          isOpen={activeOverlay === 'terminal'}
          logs={logs}
          progress={progress}
          isRunning={isRunning}
          onClose={handleCloseOverlay}
          onStop={handleStopBackup}
        />

        {/* Edit Job Panel */}
        <SlidePanel
          isOpen={showEditPanel}
          onClose={() => setShowEditPanel(false)}
          title="Edit Job Settings"
          width="lg"
        >
          {currentJob && (
            <EditJobPanel
              job={currentJob}
              onSave={handleSaveJobEdit}
              onDelete={handleDeleteJob}
              onClose={() => setShowEditPanel(false)}
            />
          )}
        </SlidePanel>

        {/* Compare Snapshots Panel (TIM-150) */}
        <SlidePanel
          isOpen={compareMode}
          onClose={handleCloseCompare}
          title="Compare Snapshots"
          width="lg"
        >
          <div className="p-4">
            <h3 className="text-sm font-medium text-text-primary mb-4">
              Select a snapshot to compare with{' '}
              {selectedSnapshot?.timestamp
                ? new Date(selectedSnapshot.timestamp).toLocaleDateString()
                : 'current'}
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredSnapshots
                .filter(s => s.id !== selectedSnapshot?.id)
                .map(snapshot => (
                  <button
                    key={snapshot.id}
                    onClick={() => setCompareSnapshot(snapshot)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      compareSnapshot?.id === snapshot.id
                        ? 'border-accent-primary bg-accent-primary/10'
                        : 'border-border-base hover:bg-layer-2'
                    }`}
                  >
                    <div className="font-medium text-text-primary">
                      {new Date(snapshot.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {new Date(snapshot.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-text-tertiary">
                      <span className="flex items-center gap-1">
                        <Icons.File size={12} />
                        {snapshot.fileCount?.toLocaleString() ?? '—'} files
                      </span>
                      <span className="flex items-center gap-1">
                        <Icons.HardDrive size={12} />
                        {formatBytes(snapshot.sizeBytes ?? 0)}
                      </span>
                    </div>
                  </button>
                ))}
            </div>

            {compareSnapshot && selectedSnapshot && (
              <div className="mt-6 p-4 bg-layer-2 rounded-lg">
                <h4 className="font-medium text-text-primary mb-4">Comparison Summary</h4>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-text-secondary">Original</div>
                      <div className="text-xs text-text-tertiary">
                        {new Date(selectedSnapshot.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <Icons.ArrowRight className="text-text-tertiary mt-1" size={16} />
                    <div className="text-right">
                      <div className="text-sm font-medium text-text-secondary">Compared</div>
                      <div className="text-xs text-text-tertiary">
                        {new Date(compareSnapshot.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border-base pt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">File count difference</span>
                      <span
                        className={`font-mono ${
                          (compareSnapshot.fileCount ?? 0) - (selectedSnapshot.fileCount ?? 0) > 0
                            ? 'text-[var(--color-success)]'
                            : (compareSnapshot.fileCount ?? 0) - (selectedSnapshot.fileCount ?? 0) <
                                0
                              ? 'text-[var(--color-error)]'
                              : 'text-text-tertiary'
                        }`}
                      >
                        {(compareSnapshot.fileCount ?? 0) - (selectedSnapshot.fileCount ?? 0) > 0
                          ? '+'
                          : ''}
                        {(
                          (compareSnapshot.fileCount ?? 0) - (selectedSnapshot.fileCount ?? 0)
                        ).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">Size difference</span>
                      <span
                        className={`font-mono ${
                          (compareSnapshot.sizeBytes ?? 0) - (selectedSnapshot.sizeBytes ?? 0) > 0
                            ? 'text-[var(--color-success)]'
                            : (compareSnapshot.sizeBytes ?? 0) - (selectedSnapshot.sizeBytes ?? 0) <
                                0
                              ? 'text-[var(--color-error)]'
                              : 'text-text-tertiary'
                        }`}
                      >
                        {(compareSnapshot.sizeBytes ?? 0) - (selectedSnapshot.sizeBytes ?? 0) > 0
                          ? '+'
                          : ''}
                        {formatBytes(
                          Math.abs(
                            (compareSnapshot.sizeBytes ?? 0) - (selectedSnapshot.sizeBytes ?? 0)
                          )
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">Time elapsed</span>
                      <span className="font-mono text-text-primary">
                        {Math.abs(
                          Math.round(
                            (compareSnapshot.timestamp - selectedSnapshot.timestamp) /
                              (1000 * 60 * 60 * 24)
                          )
                        )}{' '}
                        day(s)
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-text-tertiary mt-4 pt-4 border-t border-border-base">
                  Detailed file-by-file comparison coming soon...
                </p>
              </div>
            )}
          </div>
        </SlidePanel>
      </div>
    </PageContainer>
  );
}

export default TimeMachinePage;
