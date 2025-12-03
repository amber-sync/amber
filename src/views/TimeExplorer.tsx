import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Snapshot, JobAggregateStats, SnapshotDensity, SyncJob } from '../types';
import { api } from '../api';
import { Icons } from '../components/IconComponents';
import { TimeExplorerHeader } from '../components/explorer/TimeExplorerHeader';
import { ActionBar } from '../components/explorer/ActionBar';
import { StatsSummary } from '../components/explorer/StatsSummary';
import { DateNavigator } from '../components/explorer/DateNavigator';
import { SlidePanel } from '../components/explorer/panels/SlidePanel';
import { EditJobPanel } from '../components/explorer/panels/EditJobPanel';
import { RestorePanel } from '../components/explorer/panels/RestorePanel';
import { useJobStats } from '../hooks/useJobStats';

/**
 * TimeExplorer - Unified backup browsing experience (TIM-129)
 *
 * Replaces JobDetail and TimelineView with a single, focused view
 * for exploring backups of a single job.
 */
export function TimeExplorer() {
  const { activeJobId, jobs, setView, setActiveJobId, runSync, stopSync, persistJob, deleteJob } =
    useApp();
  const job = jobs.find((j: SyncJob) => j.id === activeJobId);

  // Handle job switching from the header dropdown
  const handleJobSwitch = (jobId: string) => {
    setActiveJobId(jobId);
  };

  // Check if this job is running (from job status or context)
  const isRunning = job?.status === 'RUNNING';

  // Date filtering state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Snapshot state
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(true);

  // Panel state
  const [activePanel, setActivePanel] = useState<'edit' | 'restore' | 'detail' | null>(null);

  // Use the useJobStats hook for stats and density (TIM-132)
  const { stats, density, loading: statsLoading } = useJobStats(job?.destPath, job?.id, 'month');

  // File browser state
  const [browserPath, setBrowserPath] = useState<string | null>(null);
  const [browserTimestamp, setBrowserTimestamp] = useState<number | null>(null);

  // Load snapshots when job changes
  useEffect(() => {
    if (!job) return;

    const loadSnapshots = async () => {
      setSnapshotsLoading(true);
      try {
        const snapshotList = await api.listSnapshots(job.id, job.destPath);
        setSnapshots(snapshotList);
      } catch (error) {
        console.error('Failed to load snapshots:', error);
      } finally {
        setSnapshotsLoading(false);
      }
    };

    loadSnapshots();
  }, [job]);

  // Handle back navigation
  const handleBack = () => {
    setView('DASHBOARD');
  };

  if (!job) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Icons.AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h2 className="text-lg font-medium">No job selected</h2>
          <p className="mt-2 text-sm text-stone-500">
            Select a job from the dashboard to explore its backups.
          </p>
          <button
            onClick={handleBack}
            className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-white hover:bg-amber-600"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header - TIM-130 */}
      <TimeExplorerHeader
        job={job}
        jobs={jobs}
        onJobSwitch={handleJobSwitch}
        onBack={handleBack}
        onSettingsClick={() => setActivePanel('edit')}
      />

      {/* Action Bar - TIM-131 */}
      <ActionBar
        job={job}
        isRunning={isRunning}
        progress={null}
        onRunBackup={() => runSync(job.id)}
        onStopBackup={() => stopSync(job.id)}
        onRestore={() => setActivePanel('restore')}
        onEdit={() => setActivePanel('edit')}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Stats + Date Navigator + Snapshot List */}
        <div className="flex w-80 flex-col border-r border-stone-200 dark:border-stone-700">
          {/* Stats Summary - TIM-132 */}
          <StatsSummary stats={stats} loading={statsLoading} />

          {/* Date Navigator - TIM-133 */}
          <DateNavigator
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            density={density}
            loading={statsLoading}
          />

          {/* Snapshot List */}
          <div className="flex-1 overflow-auto">
            {snapshotsLoading ? (
              <div className="p-4">
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-lg bg-stone-100 dark:bg-stone-800" />
                  ))}
                </div>
              </div>
            ) : snapshots.length === 0 ? (
              <div className="flex h-full items-center justify-center p-4">
                <div className="text-center text-sm text-stone-500">
                  <Icons.Archive className="mx-auto mb-2 h-8 w-8 text-stone-400" />
                  No backups yet
                </div>
              </div>
            ) : (
              <div className="p-2">
                {snapshots.map(snapshot => (
                  <button
                    key={snapshot.timestamp}
                    onClick={() => setSelectedSnapshot(snapshot)}
                    className={`mb-1 w-full rounded-lg p-3 text-left transition ${
                      selectedSnapshot?.timestamp === snapshot.timestamp
                        ? 'bg-amber-50 ring-2 ring-amber-500 dark:bg-amber-900/20'
                        : 'hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {new Date(snapshot.timestamp).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="text-xs text-stone-500">
                        {new Date(snapshot.timestamp).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-stone-500">
                      <span>{snapshot.fileCount?.toLocaleString() ?? '?'} files</span>
                      <span>{formatBytes(snapshot.sizeBytes ?? 0)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: File Browser / Snapshot Details */}
        <div className="flex-1 bg-stone-50 dark:bg-stone-900/50">
          {selectedSnapshot ? (
            <div className="flex h-full flex-col p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {new Date(selectedSnapshot.timestamp).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setBrowserPath(selectedSnapshot.path ?? null);
                      setBrowserTimestamp(selectedSnapshot.timestamp);
                    }}
                    className="flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
                  >
                    <Icons.FolderOpen className="h-4 w-4" />
                    Browse Files
                  </button>
                  <button
                    onClick={() => selectedSnapshot.path && api.openPath(selectedSnapshot.path)}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700"
                  >
                    Open in Finder
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-stone-500 dark:text-stone-400">Files</div>
                    <div className="text-lg font-semibold">
                      {selectedSnapshot.fileCount?.toLocaleString() ?? 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-stone-500 dark:text-stone-400">Size</div>
                    <div className="text-lg font-semibold">
                      {formatBytes(selectedSnapshot.sizeBytes ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-stone-500 dark:text-stone-400">Status</div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          selectedSnapshot.status === 'Complete'
                            ? 'bg-green-500'
                            : selectedSnapshot.status === 'Partial'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                      />
                      <span className="text-lg font-semibold">{selectedSnapshot.status}</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Placeholder for file browser */}
              {browserPath && browserTimestamp && (
                <div className="mt-4 flex-1 rounded-lg border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
                  <div className="flex h-full items-center justify-center text-sm text-stone-500">
                    File browser will be integrated here (TIM-130+)
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-stone-500">
                <Icons.Archive className="mx-auto mb-4 h-12 w-12 text-stone-400" />
                <p className="text-lg font-medium">Select a snapshot</p>
                <p className="mt-1 text-sm">Choose a backup from the list to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Job Panel - TIM-135 */}
      <SlidePanel
        isOpen={activePanel === 'edit'}
        onClose={() => setActivePanel(null)}
        title="Edit Job"
        width="lg"
      >
        <EditJobPanel
          job={job}
          onSave={async updatedJob => {
            await persistJob(updatedJob);
            setActivePanel(null);
          }}
          onDelete={async () => {
            await deleteJob(job.id);
            setView('DASHBOARD');
          }}
          onClose={() => setActivePanel(null)}
        />
      </SlidePanel>

      {/* Restore Panel - TIM-136 */}
      <SlidePanel
        isOpen={activePanel === 'restore'}
        onClose={() => setActivePanel(null)}
        title="Restore Files"
        width="lg"
      >
        <RestorePanel
          job={job}
          selectedSnapshot={selectedSnapshot}
          snapshots={snapshots}
          onClose={() => setActivePanel(null)}
        />
      </SlidePanel>

      {/* Snapshot Detail Panel */}
      <SlidePanel
        isOpen={activePanel === 'detail'}
        onClose={() => setActivePanel(null)}
        title="Snapshot Details"
        width="md"
      >
        <div className="p-4">
          <p className="text-sm text-stone-500">Snapshot details panel content</p>
        </div>
      </SlidePanel>
    </div>
  );
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default TimeExplorer;
