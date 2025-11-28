import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../components/IconComponents';
import { Terminal } from '../components/Terminal';
import { DiskStats, LogEntry, RsyncProgressData, SyncJob, SyncMode } from '../types';
import { formatBytes, formatSchedule } from '../utils/formatters';
import { FileBrowser } from '../components/FileBrowser';

type SnapshotGrouping = 'ALL' | 'DAY' | 'MONTH' | 'YEAR';

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
}

// ... (Analytics interfaces unchanged)

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
}) => {
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
  const [snapshotGrouping, setSnapshotGrouping] = useState<SnapshotGrouping>('ALL');
  const [activeBrowserPath, setActiveBrowserPath] = useState<string | null>(null);

  useEffect(() => {
    setSnapshotGrouping('ALL');
    setIsTerminalExpanded(false);
    setActiveBrowserPath(null);
  }, [job.id]);

  // ... (Chart Data & Analytics logic unchanged)

  // ... (groupedSnapshots logic unchanged)

  const handleOpenSnapshot = (timestamp: number) => {
    if (!window.electronAPI || !job.destPath) return;
    const folderName = buildSnapshotFolderName(timestamp);
    const fullPath = job.mode === SyncMode.TIME_MACHINE ? `${job.destPath}/${folderName}` : job.destPath;
    window.electronAPI.openPath(fullPath);
  };
  
  const handleBrowseSnapshot = (timestamp: number) => {
    if (!job.destPath) return;
    const folderName = buildSnapshotFolderName(timestamp);
    const fullPath = job.mode === SyncMode.TIME_MACHINE ? `${job.destPath}/${folderName}` : job.destPath;
    setActiveBrowserPath(fullPath);
  };

  // ... (rest of render)

  return (
    <div className="h-screen flex flex-col relative z-10">
      <Header
        job={job}
        isRunning={isRunning}
        onBack={activeBrowserPath ? () => setActiveBrowserPath(null) : onBack}
        onRun={onRun}
        onStop={onStop}
        onOpenSettings={onOpenSettings}
        onDelete={onDelete}
        titleOverride={activeBrowserPath ? 'File Browser' : undefined}
      />

      <div className="flex-1 overflow-auto p-8">
        {activeBrowserPath ? (
            <div className="h-full animate-fade-in">
                <FileBrowser initialPath={activeBrowserPath} />
            </div>
        ) : (
        <div className={`transition-all duration-500 ${isTerminalExpanded ? 'fixed inset-0 z-50 bg-black/90 p-8 overflow-auto' : 'grid grid-cols-1 lg:grid-cols-3 gap-8'}`}>
          {/* ... (Existing Grid Content) ... */}
          {/* LEFT COLUMN */}
          <div className={`${isTerminalExpanded ? 'w-full h-full' : 'lg:col-span-2 space-y-8'}`}>
            {!isTerminalExpanded && (
              <StorageUsage job={job} diskStats={diskStats} />
            )}

            <LiveActivity
              job={job}
              isRunning={isRunning}
              progress={progress}
              logs={logs}
              isTerminalExpanded={isTerminalExpanded}
              onExpand={() => setIsTerminalExpanded(true)}
            />

            {!isTerminalExpanded && (
              <SnapshotsSection
                job={job}
                snapshots={groupedSnapshots}
                snapshotGrouping={snapshotGrouping}
                onGroupingChange={setSnapshotGrouping}
                onOpenSnapshot={handleOpenSnapshot}
                onBrowseSnapshot={handleBrowseSnapshot}
              />
            )}
          </div>

          {/* RIGHT COLUMN */}
          {!isTerminalExpanded && (
            <div className="space-y-6">
              <StatsQuickView job={job} />
              <StorageHistory chartData={chartData} />
              {/* Analytics ... */}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

// Update SnapshotsSection to accept onBrowseSnapshot
// ... 


const Header: React.FC<{
  job: SyncJob;
  isRunning: boolean;
  onBack: () => void;
  onRun: (jobId: string) => void;
  onStop: (jobId: string) => void;
  onOpenSettings: () => void;
  onDelete: (jobId: string) => void;
  titleOverride?: string;
}> = ({ job, isRunning, onBack, onRun, onStop, onOpenSettings, onDelete, titleOverride }) => (
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
        <h2 className="text-2xl font-bold">{titleOverride || job.name}</h2>
        {!titleOverride && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Icons.Server size={14} /> {job.sourcePath}
          <Icons.ArrowRight size={14} />
          <Icons.HardDrive size={14} /> {job.destPath}
        </div>
        )}
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

// Compact Storage Usage Component
const StorageUsage: React.FC<{ job: SyncJob; diskStats: Record<string, DiskStats> }> = ({ job, diskStats }) => {
  const stat = diskStats[job.destPath];
  const isAvailable = stat?.status === 'AVAILABLE';
  const totalBytes = isAvailable ? stat.total : 0;
  const freeBytes = isAvailable ? stat.free : 0;
  const usedBytes = totalBytes - freeBytes;
  const jobSize = job.snapshots[job.snapshots.length - 1]?.sizeBytes || 0;
  
  const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  const jobPercent = totalBytes > 0 ? (jobSize / totalBytes) * 100 : 0;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Icons.HardDrive size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Storage Overview</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{job.destPath}</p>
          </div>
        </div>
        {isAvailable && (
          <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300">
            {usedPercent.toFixed(0)}% Used
          </span>
        )}
      </div>

      {isAvailable ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Capacity</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{formatBytes(totalBytes)}</div>
            </div>
            <div className="flex-1 border-l border-gray-100 dark:border-gray-700 pl-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Free</div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatBytes(freeBytes)}</div>
            </div>
            <div className="flex-1 border-l border-gray-100 dark:border-gray-700 pl-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">This Job</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatBytes(jobSize)}</div>
            </div>
          </div>

          <div className="relative h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="absolute h-full bg-gray-300 dark:bg-gray-600 transition-all"
              style={{ width: `${usedPercent}%` }}
            />
            <div 
              className="absolute h-full bg-blue-500 transition-all shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              style={{ width: `${jobPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
          Destination drive not connected
        </div>
      )}
    </div>
  );
};

// Quick Stats View
const StatsQuickView: React.FC<{ job: SyncJob }> = ({ job }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
      <Icons.Activity size={16} className="text-indigo-500" /> Quick Stats
    </h3>
    <div className="space-y-3">
      <div className="flex items-center justify-between group">
        <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">Last Sync</span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {job.lastRun ? new Date(job.lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
        </span>
      </div>
      <div className="flex items-center justify-between group">
        <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">Schedule</span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{formatSchedule(job.scheduleInterval)}</span>
      </div>
      <div className="flex items-center justify-between group">
        <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">Mode</span>
        <span className="text-sm font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">
          {job.mode.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700 group">
        <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">Total Snapshots</span>
        <span className="text-sm font-bold text-gray-900 dark:text-white">{job.snapshots.length}</span>
      </div>
    </div>
  </div>
);

const StorageHistory: React.FC<{ chartData: { name: string; dataAdded: number }[] }> = ({ chartData }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
    <h3 className="text-sm font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
      <Icons.BarChart2 size={16} className="text-indigo-500" /> Data Added
    </h3>
    <div className="h-32 w-full flex items-end justify-between gap-1">
      {(() => {
        const values = chartData.map(d => d.dataAdded);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const range = maxVal - minVal;
        
        return chartData.slice(-15).map((d, i) => {
          let heightPercent = 50;
          if (range > 0) {
            heightPercent = 10 + ((d.dataAdded - minVal) / range) * 80;
          } else if (maxVal > 0) {
            heightPercent = 50;
          } else {
            heightPercent = 2;
          }

          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative">
              <div
                className="w-full mx-0.5 bg-indigo-500/80 dark:bg-indigo-600 rounded-t transition-all hover:bg-indigo-400"
                style={{ height: `${heightPercent}%`, minHeight: '4px' }}
              ></div>
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20 shadow-lg">
                {d.name}: +{d.dataAdded.toFixed(2)} MB
              </div>
            </div>
          );
        });
      })()}
      {chartData.length === 0 && (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
          No history yet
        </div>
      )}
    </div>
  </div>
);

const AnalyticsSection: React.FC<{ analytics: JobAnalytics; onShowFile: (path: string) => void }> = ({ analytics, onShowFile }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm space-y-6">
    <div>
      <h3 className="text-sm font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
        <Icons.PieChart size={16} className="text-indigo-500" /> File Types
      </h3>
      <div className="flex items-center gap-4">
        <div
          className="relative w-20 h-20 rounded-full shrink-0"
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
          <div className="absolute inset-0 m-auto w-12 h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-gray-900 dark:text-white">
              {analytics.fileTypes.reduce((acc, curr) => acc + curr.value, 0)}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          {analytics.fileTypes.slice(0, 3).map((type, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-gray-600 dark:text-gray-300 truncate">{type.name}</span>
              <span className="text-gray-400 ml-auto">{type.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div>
      <h3 className="text-sm font-bold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
        <Icons.File size={16} className="text-indigo-500" /> Largest Files
      </h3>
      <div className="space-y-2">
        {analytics.largestFiles.slice(0, 3).map((file, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg group">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Icons.File size={12} className="text-gray-400 shrink-0" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate" title={file.name}>
                {file.name}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                {formatBytes(file.size)}
              </span>
              <button
                onClick={() => onShowFile(file.path)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-all text-gray-400 hover:text-blue-500"
                title="Show in Finder"
              >
                <Icons.Search size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const AnalyticsPlaceholder: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center h-48 text-center">
    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full mb-3">
      <Icons.BarChart2 className="text-gray-400 dark:text-gray-500" size={20} />
    </div>
    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">No Analytics</h3>
    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[150px]">
      Run a sync to see file stats.
    </p>
  </div>
);

const SnapshotsSection: React.FC<{
  job: SyncJob;
  snapshots: { group: string; label: string | null; snaps: SyncJob['snapshots'] }[];
  snapshotGrouping: SnapshotGrouping;
  onGroupingChange: (grouping: SnapshotGrouping) => void;
  onOpenSnapshot: (timestamp: number) => void;
  onBrowseSnapshot: (timestamp: number) => void;
}> = ({ job, snapshots, snapshotGrouping, onGroupingChange, onOpenSnapshot, onBrowseSnapshot }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Icons.Clock size={18} className="text-indigo-500" /> Snapshots
      </h3>
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
      <div className="w-full h-32 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center text-gray-400 text-sm">
        No snapshots yet. Run a sync to create one.
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
        onBrowseSnapshot={onBrowseSnapshot}
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
  onBrowseSnapshot: (timestamp: number) => void;
}> = ({ job, snaps, label, showHeader, onOpenSnapshot, onBrowseSnapshot }) => (
  <div className={showHeader ? 'group/details space-y-3' : ''}>
    {showHeader && (
      <div className="py-2 bg-[#f5f5f7] dark:bg-[#0f0f10] text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none flex items-center gap-2 transition-colors outline-none">
        <Icons.ChevronDown className="w-4 h-4 -rotate-90" />
        {label}
        <span className="ml-auto text-[10px] font-normal bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400">{snaps.length}</span>
      </div>
    )}

    <div className={showHeader ? 'space-y-2 pl-2 border-l-2 border-gray-200 dark:border-gray-800 ml-2' : 'space-y-2'}>
      {snaps.map(snap => (
        <div key={snap.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full text-green-600 dark:text-green-400">
              <Icons.CheckCircle size={14} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{new Date(snap.timestamp).toLocaleString()}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{snap.fileCount} files • {snap.changesCount} changed</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {formatBytes(snap.sizeBytes)}
            </span>
            <button
              onClick={() => onBrowseSnapshot(snap.timestamp)}
              className="p-2 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
              title="Browse Files"
            >
              <Icons.Eye size={16} />
            </button>
            <button
              onClick={() => onOpenSnapshot(snap.timestamp)}
              className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="Open in Finder"
            >
              <Icons.FolderOpen size={16} />
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
  isTerminalExpanded: boolean;
  onExpand: () => void;
}> = ({ job, isRunning, progress, logs, isTerminalExpanded, onExpand }) => (
  <div className={`flex flex-col ${isTerminalExpanded ? 'h-full' : ''}`}>
    <div className="flex items-center justify-between mb-4">
      <h3 className={`text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 ${isTerminalExpanded ? 'text-white' : ''}`}>
        <Icons.Terminal size={18} className="text-indigo-500" /> Live Activity
        {isRunning && <span className="inline-flex w-2 h-2 bg-indigo-500 rounded-full animate-ping" />}
      </h3>
      {!isTerminalExpanded && (
        <button onClick={onExpand} className="text-xs font-medium text-gray-500 hover:text-indigo-500 flex items-center gap-1 transition-colors">
          <Icons.Maximize2 size={12} /> Expand
        </button>
      )}
    </div>

    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col transition-colors duration-300">
      {/* Terminal Header */}
      <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
          <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
        </div>
        <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <Icons.Cpu size={10} />
          rsync process
        </div>
      </div>

      {/* Progress Bar (Inside Terminal Look) */}
      {isRunning && progress && (
        <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <div className="flex justify-between text-xs font-mono text-gray-600 dark:text-gray-300 mb-2">
            <span>{progress.percentage > 0 ? `${progress.percentage}%` : 'Calculating...'}</span>
            <span>{progress.speed} • ETA: {progress.eta || '--:--'}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            {progress.percentage > 0 ? (
              <div
                className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                style={{ width: `${progress.percentage}%` }}
              />
            ) : (
              <div className="h-full bg-indigo-500/50 w-1/3 animate-progress-pulse rounded-full" />
            )}
          </div>
          <div className="mt-2 text-[10px] font-mono text-gray-500 truncate">
            {progress.currentFile ? `> ${progress.currentFile}` : `> Transferred: ${progress.transferred}`}
          </div>
        </div>
      )}

      {/* Terminal Output */}
      <div className={isTerminalExpanded ? 'flex-1' : 'h-64'}>
        <Terminal logs={logs} isRunning={isRunning} variant="embedded" />
      </div>
    </div>
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
    if (!nodes) return;
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
