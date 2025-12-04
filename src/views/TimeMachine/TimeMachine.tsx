/**
 * TimeMachine - Unified Backup Time Travel Experience
 *
 * Replaces TimeExplorer, TimelineView, and JobDetail with a single
 * immersive interface centered on timeline navigation.
 *
 * @see docs/UNIFIED_TIME_MACHINE_DESIGN.md
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api';
import { Snapshot, SyncJob, LogEntry, RsyncProgressData } from '../../types';
import { Icons } from '../../components/IconComponents';

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

// Styles
import './timemachine.css';

export type OverlayType = 'files' | 'restore' | 'analytics' | 'terminal' | null;

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

export function TimeMachine({
  initialJobId,
  isRunning = false,
  progress = null,
  logs = [],
}: TimeMachineProps) {
  const { jobs, activeJobId, setActiveJobId, setView, runSync, stopSync } = useApp();

  // Current job
  const [currentJobId, setCurrentJobId] = useState<string | null>(
    initialJobId || activeJobId || null
  );
  const currentJob = useMemo(
    () => jobs.find((j: SyncJob) => j.id === currentJobId) || null,
    [jobs, currentJobId]
  );

  // Snapshots for current job
  const [snapshots, setSnapshots] = useState<TimeMachineSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  // Timeline state
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
  const selectedSnapshot = useMemo(
    () => snapshots.find(s => s.timestamp === selectedTimestamp) || null,
    [snapshots, selectedTimestamp]
  );

  // Overlay state
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null);
  const [fileBrowserPath, setFileBrowserPath] = useState<string | null>(null);

  // Load snapshots when job changes
  useEffect(() => {
    if (!currentJob) {
      setSnapshots([]);
      setLoading(false);
      return;
    }

    const loadSnapshots = async () => {
      setLoading(true);
      try {
        const snapshotList = await api.listSnapshots(currentJob.id, currentJob.destPath);
        const enriched: TimeMachineSnapshot[] = snapshotList.map(s => ({
          ...s,
          jobId: currentJob.id,
          jobName: currentJob.name,
        }));
        setSnapshots(enriched);

        // Auto-select latest snapshot if none selected
        if (enriched.length > 0 && !selectedTimestamp) {
          setSelectedTimestamp(enriched[enriched.length - 1].timestamp);
        }
      } catch (error) {
        console.error('Failed to load snapshots:', error);
        setSnapshots([]);
      } finally {
        setLoading(false);
      }
    };

    loadSnapshots();
  }, [currentJob]);

  // Sync active job with context
  useEffect(() => {
    if (currentJobId && currentJobId !== activeJobId) {
      setActiveJobId(currentJobId);
    }
  }, [currentJobId, activeJobId, setActiveJobId]);

  // Handlers
  const handleJobSwitch = useCallback((jobId: string) => {
    setCurrentJobId(jobId);
    setSelectedTimestamp(null);
    setActiveOverlay(null);
  }, []);

  const handleBack = useCallback(() => {
    setView('DASHBOARD');
  }, [setView]);

  const handleSelectSnapshot = useCallback((timestamp: number) => {
    setSelectedTimestamp(timestamp);
  }, []);

  const handleBrowseFiles = useCallback(() => {
    if (selectedSnapshot?.path) {
      setFileBrowserPath(selectedSnapshot.path);
      setActiveOverlay('files');
    }
  }, [selectedSnapshot]);

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
      setActiveJobId(currentJobId);
      setView('JOB_EDITOR');
    }
  }, [currentJobId, setActiveJobId, setView]);

  // Calculate time range from snapshots
  const timeRange = useMemo(() => {
    if (snapshots.length === 0) {
      const now = Date.now();
      return { start: now - 30 * 24 * 60 * 60 * 1000, end: now };
    }
    const timestamps = snapshots.map(s => s.timestamp);
    return {
      start: Math.min(...timestamps),
      end: Date.now(),
    };
  }, [snapshots]);

  // No job selected state
  if (!currentJob) {
    return (
      <div className="tm-container flex flex-col h-screen">
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
    );
  }

  // No snapshots state
  if (!loading && snapshots.length === 0) {
    return (
      <div className="tm-container flex flex-col h-screen">
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
        <EmptyState type="no-snapshots" onAction={handleRunBackup} actionLabel="Run First Backup" />
        <LiveActivityBar
          isRunning={isRunning}
          progress={progress}
          logs={logs}
          onExpand={handleExpandTerminal}
        />
      </div>
    );
  }

  return (
    <div className="tm-container flex flex-col h-screen">
      {/* Header with job switcher and controls (TIM-138) */}
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

      {/* Timeline - THE primary navigation */}
      <TimelineRuler
        snapshots={snapshots}
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
        snapshots={snapshots}
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
    </div>
  );
}

export default TimeMachine;
