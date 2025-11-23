import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../components/IconComponents';
import { Terminal } from '../components/Terminal';
import { LogEntry, RsyncProgressData, SyncJob, SyncMode } from '../types';
import { formatBytes, formatSchedule } from '../utils/formatters';

type SnapshotGrouping = 'ALL' | 'DAY' | 'MONTH' | 'YEAR';

interface JobDetailProps {
  job: SyncJob;
  isRunning: boolean;
  progress: RsyncProgressData | null;
  logs: LogEntry[];
  onBack: () => void;
  onRun: (jobId: string) => void;
  onStop: (jobId: string) => void;
  onOpenSettings: () => void;
  onDelete: (jobId: string) => void;
}

interface JobAnalytics {
  fileTypes: { name: string; value: number }[];
  largestFiles: { name: string; size: number; path: string }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

export const JobDetail: React.FC<JobDetailProps> = ({
  job,
  isRunning,
  progress,
  logs,
  onBack,
  onRun,
  onStop,
  onOpenSettings,
  onDelete,
}) => {
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
  const [snapshotGrouping, setSnapshotGrouping] = useState<SnapshotGrouping>('ALL');

  useEffect(() => {
    // Reset view-specific UI when switching jobs
    setSnapshotGrouping('ALL');
    setIsTerminalExpanded(false);
  }, [job.id]);

  const chartData = useMemo(() => job.snapshots.map((s, i, arr) => {
    const prevSize = i > 0 ? arr[i - 1].sizeBytes : 0;
    const dataAdded = Math.max(0, s.sizeBytes - prevSize);
    return {
      name: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      size: s.sizeBytes / (1024 * 1024),
      dataAdded: dataAdded / (1024 * 1024),
      changes: s.changesCount,
      timestamp: s.timestamp,
    };
  }), [job.snapshots]);

  const latestSnapshot = job.snapshots[job.snapshots.length - 1];

  const analytics = useMemo<JobAnalytics | null>(() => {
    if (!latestSnapshot) return null;
    return calculateJobStats(latestSnapshot.root);
  }, [latestSnapshot]);

  const groupedSnapshots = useMemo(() => {
    const reversedSnapshots = job.snapshots.slice().reverse();

    if (snapshotGrouping === 'ALL') {
      return reversedSnapshots.map(snap => ({ group: snap.id, label: null, snaps: [snap] }));
    }

    const groups: Record<string, typeof reversedSnapshots> = {};
    reversedSnapshots.forEach(snap => {
      const date = new Date(snap.timestamp);
      let key = '';
      if (snapshotGrouping === 'DAY') {
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const snapDate = date.toDateString();
        if (snapDate === today) key = 'Today';
        else if (snapDate === yesterday) key = 'Yesterday';
        else key = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      } else if (snapshotGrouping === 'MONTH') {
        key = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      } else if (snapshotGrouping === 'YEAR') {
        key = date.getFullYear().toString();
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(snap);
    });

    return Object.entries(groups).map(([label, snaps]) => ({
      group: label,
      label,
      snaps,
    }));
  }, [job.snapshots, snapshotGrouping]);

  const handleOpenSnapshot = (timestamp: number) => {
    if (!window.electronAPI || !job.destPath) return;
    const folderName = buildSnapshotFolderName(timestamp);
    const fullPath = job.mode === SyncMode.TIME_MACHINE ? `${job.destPath}/${folderName}` : job.destPath;
    window.electronAPI.openPath(fullPath);
  };

  const handleShowFile = (path: string) => {
    if (!window.electronAPI || !job.destPath || !latestSnapshot) return;
    const folderName = buildSnapshotFolderName(latestSnapshot.timestamp);
    const basePath = job.mode === SyncMode.TIME_MACHINE ? `${job.destPath}/${folderName}` : job.destPath;
    window.electronAPI.showItemInFolder(`${basePath}${path}`);
  };

  return (
    <div className="h-screen flex flex-col relative z-10">
      <Header
        job={job}
        isRunning={isRunning}
        onBack={onBack}
        onRun={onRun}
        onStop={onStop}
        onOpenSettings={onOpenSettings}
        onDelete={onDelete}
      />

      <div className="flex-1 overflow-auto p-8 space-y-8">
        <StatsGrid job={job} />

        <div className={`transition-all duration-500 ${isTerminalExpanded ? 'fixed inset-0 z-50 bg-black/90 p-8 overflow-auto' : 'grid grid-cols-1 lg:grid-cols-5 gap-8'}`}>
          {isTerminalExpanded && (
            <button
              onClick={() => setIsTerminalExpanded(false)}
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full"
            >
              <Icons.XCircle size={24} />
            </button>
          )}

          <div className={`${isTerminalExpanded ? 'hidden' : 'lg:col-span-3 space-y-6'}`}>
            <StorageHistory chartData={chartData} />
            {analytics && (
              <AnalyticsSection analytics={analytics} onShowFile={handleShowFile} />
            )}
            <SnapshotsSection
              job={job}
              snapshots={groupedSnapshots}
              snapshotGrouping={snapshotGrouping}
              onGroupingChange={setSnapshotGrouping}
              onOpenSnapshot={handleOpenSnapshot}
            />
          </div>

          <LiveActivity
            job={job}
            isRunning={isRunning}
            progress={progress}
            logs={logs}
            latestSnapshot={latestSnapshot}
            analytics={analytics}
            isTerminalExpanded={isTerminalExpanded}
            onExpand={() => setIsTerminalExpanded(true)}
            onShowFile={handleShowFile}
          />
        </div>
      </div>
    </div>
  );
};

const Header: React.FC<{
  job: SyncJob;
  isRunning: boolean;
  onBack: () => void;
  onRun: (jobId: string) => void;
  onStop: (jobId: string) => void;
  onOpenSettings: () => void;
  onDelete: (jobId: string) => void;
}> = ({ job, isRunning, onBack, onRun, onStop, onOpenSettings, onDelete }) => (
  <div className="px-8 py-6 pt-10 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-10 text-gray-900 dark:text-white titlebar-drag">
    {isRunning && (
      <div className="absolute top-0 left-0 w-full h-1 z-20 overflow-hidden">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-progress-pulse opacity-80" />
      </div>
    )}
    <div className="flex items-center gap-4 no-drag">
      <button
        onClick={onBack}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
      >
        <Icons.ArrowRight className="rotate-180 text-gray-500 dark:text-gray-400" />
      </button>
      <div>
        <h2 className="text-2xl font-bold">{job.name}</h2>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Icons.Server size={14} /> {job.sourcePath}
          <Icons.ArrowRight size={14} />
          <Icons.HardDrive size={14} /> {job.destPath}
        </div>
      </div>
    </div>
    <div className="flex gap-3 no-drag">
      <button
        onClick={() => onDelete(job.id)}
        className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
        title="Delete Job"
      >
        <Icons.Trash2 size={18} />
      </button>
      <div className="w-px h-8 bg-gray-200 dark:bg-gray-800 self-center mx-1"></div>
      <button
        onClick={onOpenSettings}
        className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
      >
        Settings
      </button>
      {isRunning ? (
        <button
          onClick={() => onStop(job.id)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex items-center gap-2 shadow-sm transition-all animate-pulse"
        >
          <Icons.XCircle size={16} /> Stop Sync
        </button>
      ) : (
        <button
          onClick={() => onRun(job.id)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 hover:shadow-teal-500/20 flex items-center gap-2 shadow-sm transition-all"
        >
          <Icons.Play size={16} /> Sync Now
        </button>
      )}
    </div>
  </div>
);

const StatsGrid: React.FC<{ job: SyncJob }> = ({ job }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <StatCard
      icon={<Icons.Database size={18} />}
      label="Total Size"
      value={formatBytes(job.snapshots[job.snapshots.length - 1]?.sizeBytes || 0)}
    />
    <StatCard
      icon={<Icons.Clock size={18} />}
      label="Last Sync"
      value={job.lastRun ? new Date(job.lastRun).toLocaleTimeString() : 'Never'}
    />
    <StatCard
      icon={<Icons.Clock size={18} />}
      label="Schedule"
      value={formatSchedule(job.scheduleInterval)}
    />
    <StatCard
      icon={<Icons.Shield size={18} />}
      label="Mode"
      value={job.mode.replace('_', ' ').toLowerCase()}
    />
  </div>
);

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-gray-700">
    <div className="flex items-center gap-3 mb-2 text-gray-500 dark:text-gray-400">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
    <p className="text-xl lg:text-3xl font-bold text-gray-900 dark:text-white truncate">{value}</p>
  </div>
);

const StorageHistory: React.FC<{ chartData: { name: string; dataAdded: number }[] }> = ({ chartData }) => (
  <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
    <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
      <Icons.BarChart2 size={20} /> Storage History (Data Added)
    </h3>
    <div className="h-64 w-full flex items-end justify-between gap-1">
      {(() => {
        const maxAdded = Math.max(...chartData.map(d => d.dataAdded), 0.1);
        return chartData.slice(-20).map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center group relative">
            <div
              className="w-full mx-0.5 bg-indigo-500/80 dark:bg-indigo-600 rounded-t transition-all hover:bg-indigo-400"
              style={{ height: `${(d.dataAdded / maxAdded) * 100}%`, minHeight: '4px' }}
            ></div>
            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
              {d.name}: +{d.dataAdded.toFixed(2)} MB
            </div>
          </div>
        ));
      })()}
      {chartData.length === 0 && (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
          No snapshots yet.
        </div>
      )}
    </div>
  </div>
);

const AnalyticsSection: React.FC<{ analytics: JobAnalytics; onShowFile: (path: string) => void }> = ({ analytics, onShowFile }) => (
  <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
    <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
      <Icons.Activity size={20} /> Analytics
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="flex flex-col items-center">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">File Types</h4>
        <div
          className="relative w-48 h-48 rounded-full"
          style={{
            background: `conic-gradient(${
              analytics.fileTypes.reduce((acc, type, i, arr) => {
                const total = analytics.fileTypes.reduce((sum, t) => sum + t.value, 0);
                const prevDeg = i === 0 ? 0 : (analytics.fileTypes.slice(0, i).reduce((sum, t) => sum + t.value, 0) / total) * 360;
                const currentDeg = ((type.value / total) * 360) + prevDeg;
                const color = COLORS[i % COLORS.length];
                return acc + `${color} ${prevDeg}deg ${currentDeg}deg${i === arr.length - 1 ? '' : ', '}`;
              }, '')
            })`,
          }}
        >
          <div className="absolute inset-0 m-auto w-32 h-32 bg-white dark:bg-gray-800 rounded-full flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {analytics.fileTypes.reduce((acc, curr) => acc + curr.value, 0)}
            </span>
            <span className="text-xs text-gray-500">Files</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          {analytics.fileTypes.map((type, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-xs text-gray-600 dark:text-gray-300">{type.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Largest Files</h4>
        <div className="space-y-3">
          {analytics.largestFiles.map((file, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-lg text-teal-600 dark:text-teal-400 shrink-0">
                  <Icons.File size={16} />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                  {file.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-100 dark:border-gray-700 shrink-0 ml-2">
                  {formatBytes(file.size)}
                </span>
                <button
                  onClick={() => onShowFile(file.path)}
                  className="opacity-60 hover:opacity-100 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all text-gray-400 hover:text-blue-500"
                  title="Show in Finder"
                >
                  <Icons.Search size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const SnapshotsSection: React.FC<{
  job: SyncJob;
  snapshots: { group: string; label: string | null; snaps: SyncJob['snapshots'] }[];
  snapshotGrouping: SnapshotGrouping;
  onGroupingChange: (grouping: SnapshotGrouping) => void;
  onOpenSnapshot: (timestamp: number) => void;
}> = ({ job, snapshots, snapshotGrouping, onGroupingChange, onOpenSnapshot }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Snapshots</h3>
      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg text-xs font-medium">
        {(['ALL', 'DAY', 'MONTH', 'YEAR'] as SnapshotGrouping[]).map(group => (
          <button
            key={group}
            onClick={() => onGroupingChange(group)}
            className={`px-3 py-1.5 rounded-md transition-all ${snapshotGrouping === group ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
          >
            {group.charAt(0) + group.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
    </div>

    {snapshots.length === 0 && (
      <div className="w-full h-32 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center text-gray-400">
        No snapshots yet.
      </div>
    )}

    {snapshots.map(({ group, label, snaps }) => (
      <SnapshotGroup
        key={group}
        label={label}
        job={job}
        snaps={snaps}
        showHeader={snapshotGrouping !== 'ALL'}
        onOpenSnapshot={onOpenSnapshot}
      />
    ))}
  </div>
);

const SnapshotGroup: React.FC<{
  job: SyncJob;
  snaps: SyncJob['snapshots'];
  label: string | null;
  showHeader: boolean;
  onOpenSnapshot: (timestamp: number) => void;
}> = ({ job, snaps, label, showHeader, onOpenSnapshot }) => (
  <div className={showHeader ? 'group/details space-y-3' : ''}>
    {showHeader && (
      <div className="py-2 bg-[#f5f5f7] dark:bg-[#0f0f10] text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none flex items-center gap-2 transition-colors outline-none">
        <Icons.ChevronDown className="w-4 h-4 -rotate-90" />
        {label}
        <span className="ml-auto text-[10px] font-normal bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400">{snaps.length}</span>
      </div>
    )}

    <div className={showHeader ? 'space-y-3 pl-2 border-l-2 border-gray-200 dark:border-gray-800 ml-2' : 'space-y-3'}>
      {snaps.map(snap => (
        <div key={snap.id} className="flex items-center justify-between p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full text-green-600 dark:text-green-400">
              <Icons.CheckCircle size={16} />
            </div>
            <div>
              <p className="font-semibold text-gray-800 dark:text-gray-200">{new Date(snap.timestamp).toLocaleString()}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{snap.fileCount} files • {snap.changesCount} changed</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {formatBytes(snap.sizeBytes)}
            </span>
            <button
              onClick={() => onOpenSnapshot(snap.timestamp)}
              className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="Open in Finder"
            >
              <Icons.FolderOpen size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const LiveActivity: React.FC<{
  job: SyncJob;
  isRunning: boolean;
  progress: RsyncProgressData | null;
  logs: LogEntry[];
  latestSnapshot?: SyncJob['snapshots'][number];
  analytics: JobAnalytics | null;
  isTerminalExpanded: boolean;
  onShowFile: (path: string) => void;
  onExpand: () => void;
}> = ({ job, isRunning, progress, logs, latestSnapshot, analytics, isTerminalExpanded, onShowFile, onExpand }) => (
  <div className={`${isTerminalExpanded ? 'w-full h-full flex flex-col' : 'lg:col-span-2'}`}>
    <h3 className={`text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2 ${isTerminalExpanded ? 'text-white' : ''}`}>
      Live Activity
      {isRunning && <span className="inline-flex w-2 h-2 bg-indigo-500 rounded-full animate-ping" />}
      {!isTerminalExpanded && (
        <button onClick={onExpand} className="ml-auto text-xs text-gray-400 hover:text-indigo-500">Expand</button>
      )}
    </h3>

    {isRunning && progress && (
      <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
          <span>{progress.percentage > 0 ? `${progress.percentage}% Complete` : 'Syncing...'}</span>
          <span>
            {progress.speed}
            {progress.eta ? ` • ETA: ${progress.eta}` : ''}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative">
          {progress.percentage > 0 ? (
            <div
              className="h-full bg-indigo-500 transition-all duration-300 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
          ) : (
            <div className="h-full bg-indigo-500/50 w-1/3 absolute top-0 animate-progress-pulse rounded-full" />
          )}
        </div>
        <div className="mt-2 text-xs text-gray-400 truncate">
          {progress.currentFile ? `File: ${progress.currentFile}` : `Transferred: ${progress.transferred}`}
        </div>
      </div>
    )}

    <div className={isTerminalExpanded ? 'flex-1' : ''}>
      <Terminal logs={logs} isRunning={isRunning} />
    </div>

    {!isTerminalExpanded && (
      <div className="mt-6 p-4 bg-blue-50/90 dark:bg-blue-900/10 backdrop-blur-sm rounded-xl border border-blue-100 dark:border-blue-900/30">
        <div className="flex items-start gap-3">
          <Icons.Zap className="text-blue-500 dark:text-blue-400 mt-1" size={20} />
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-300">Config Insight</h4>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1 leading-relaxed">
              {job.mode === SyncMode.TIME_MACHINE
                ? 'Time Machine mode is active. Files are hard-linked to the previous snapshot, meaning only changed files consume new disk space.'
                : 'Standard mirror mode. Destination is an exact copy of source.'}
              <br />
              {job.scheduleInterval
                ? `Automation active: Running ${formatSchedule(job.scheduleInterval).toLowerCase()}.`
                : 'Automation disabled: Manual sync only.'}
            </p>
          </div>
        </div>
      </div>
    )}

    {!isTerminalExpanded && latestSnapshot && (
      <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Icons.Activity size={16} /> Job Analytics
        </h4>
        <div className="space-y-4">
          <div>
            <h5 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">Largest Files</h5>
            <div className="space-y-2">
              {analytics?.largestFiles.slice(0, 3).map((file, i) => (
                <div key={i} className="flex justify-between items-center text-xs group">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-gray-700 dark:text-gray-300 truncate" title={file.name}>{file.name}</span>
                    <button
                      onClick={() => onShowFile(file.path)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all text-gray-400 hover:text-blue-500"
                      title="Show in Finder"
                    >
                      <Icons.Search size={12} />
                    </button>
                  </div>
                  <span className="font-mono text-gray-500 shrink-0 ml-2">{formatBytes(file.size)}</span>
                </div>
              ))}
              {(!analytics || analytics.largestFiles.length === 0) && <span className="text-xs text-gray-400">No files found.</span>}
            </div>
          </div>
          <div>
            <h5 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">File Types</h5>
            <div className="flex flex-wrap gap-2">
              {analytics?.fileTypes.slice(0, 5).map((type, i) => (
                <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-300">
                  {type.name} ({type.value})
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);

const buildSnapshotFolderName = (timestamp: number) => {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}${min}${s}`;
};

const calculateJobStats = (fileNodes: SyncJob['snapshots'][number]['root']): JobAnalytics => {
  const typesMap = new Map<string, number>();
  const allFiles: { name: string; size: number; path: string }[] = [];

  const traverse = (nodes: SyncJob['snapshots'][number]['root'], currentPath: string) => {
    for (const node of nodes) {
      if (node.type === 'FILE') {
        const ext = node.name.includes('.') ? node.name.split('.').pop()?.toLowerCase() || 'unknown' : 'no-ext';
        typesMap.set(ext, (typesMap.get(ext) || 0) + 1);
        allFiles.push({ name: node.name, size: node.size, path: `${currentPath}/${node.name}` });
      } else if (node.children) {
        traverse(node.children, `${currentPath}/${node.name}`);
      }
    }
  };

  traverse(fileNodes, '');

  const fileTypes = Array.from(typesMap.entries())
    .map(([name, value]) => ({ name: `.${name}`, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const largestFiles = allFiles
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  return { fileTypes, largestFiles };
};
