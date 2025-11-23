import React from 'react';
import { SyncJob, JobStatus, DiskStats } from '../types';
import { Icons } from '../components/IconComponents';
import { formatBytes, formatSchedule } from '../utils/formatters';

interface DashboardProps {
  jobs: SyncJob[];
  diskStats: Record<string, DiskStats>;
  onSelectJob: (jobId: string) => void;
  onCreateJob: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  jobs,
  diskStats,
  onSelectJob,
  onCreateJob
}) => {
  const totalProtectedSize = jobs.reduce((acc, job) => {
    const latest = job.snapshots[job.snapshots.length - 1];
    return acc + (latest?.sizeBytes || 0);
  }, 0);

  const uniqueDestinations = Array.from(new Set(jobs.map(j => j.destPath).filter(Boolean)));

  return (
    <div className="p-8 space-y-6 relative z-10">
      <header className="flex justify-between items-center mb-8 pt-4">
        <div className="no-drag">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Amber</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Rsync and Time Machine</p>
        </div>
        <div className="flex gap-3 no-drag">
          <button
            onClick={onCreateJob}
            className="flex items-center gap-2 bg-black dark:bg-white dark:text-black text-white px-5 py-2.5 rounded-full font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95"
          >
            <Icons.Plus size={18} /> New Job
          </button>
        </div>
      </header>

      {/* Global Stats Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Storage Destinations */}
        <StorageDestinations destinations={uniqueDestinations} stats={diskStats} />

        {/* Total Backed Up Summary */}
        <TotalBackedUpCard totalSize={totalProtectedSize} jobCount={jobs.length} />
      </div>

      {/* Jobs Grid */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Your Jobs</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map(job => (
          <JobCard key={job.id} job={job} onSelect={() => onSelectJob(job.id)} />
        ))}

        {jobs.length === 0 && (
          <div className="col-span-full py-20 text-center text-gray-400 dark:text-gray-600">
            <Icons.HardDrive className="mx-auto mb-4 opacity-20" size={64} />
            <p>No sync jobs configured yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-components
const StorageDestinations: React.FC<{
  destinations: string[];
  stats: Record<string, DiskStats>;
}> = ({ destinations, stats }) => (
  <div className="lg:col-span-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700 shadow-sm flex flex-col">
    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
      <Icons.HardDrive size={20} className="text-[#fc8d62]" /> Storage Destinations
    </h3>
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
      {destinations.map(path => {
        const stat = stats[path];
        const isAvailable = stat?.status === 'AVAILABLE';
        const percentUsed = isAvailable && stat.total > 0
          ? ((stat.total - stat.free) / stat.total) * 100
          : 0;

        return (
          <div key={path} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={`p-2 rounded-full shrink-0 ${isAvailable ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'}`}>
                <Icons.HardDrive size={18} />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[250px]" title={path}>
                  {path}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {!stat ? 'Checking...' :
                    isAvailable ? `${formatBytes(stat.free)} free of ${formatBytes(stat.total)}` :
                      'Not Connected'}
                </div>
              </div>
            </div>
            {isAvailable && (
              <div className="w-32 shrink-0 flex flex-col gap-1">
                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div className="h-full bg-[#fc8d62]" style={{ width: `${percentUsed}%` }} />
                </div>
                <div className="text-[10px] text-right text-gray-400">{Math.round(percentUsed)}% Used</div>
              </div>
            )}
          </div>
        );
      })}
      {destinations.length === 0 && (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500">
          <Icons.HardDrive size={32} className="mb-2 opacity-20" />
          <p className="text-sm">No destinations configured.</p>
        </div>
      )}
    </div>
  </div>
);

const TotalBackedUpCard: React.FC<{ totalSize: number; jobCount: number }> = ({ totalSize, jobCount }) => (
  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700 shadow-sm flex flex-col justify-between relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-10">
      <Icons.Database size={120} />
    </div>
    <div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Total Backed Up</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">Across all jobs</p>
    </div>
    <div className="flex items-end gap-2 mt-8">
      <span className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
        {formatBytes(totalSize)}
      </span>
    </div>
    <div className="mt-4">
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div className="bg-[#fc8d62] h-2.5 rounded-full" style={{ width: '100%' }}></div>
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-2">
        <span>Used Space</span>
        <span>{jobCount} Active Jobs</span>
      </div>
    </div>
  </div>
);

const JobCard: React.FC<{ job: SyncJob; onSelect: () => void }> = ({ job, onSelect }) => (
  <div
    onClick={onSelect}
    className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
  >
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />

    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl transition-all duration-500 ${job.status === JobStatus.RUNNING
          ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 animate-heartbeat shadow-[0_0_15px_rgba(245,158,11,0.4)]'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
        }`}>
        <Icons.Database size={24} />
      </div>
      <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${job.status === JobStatus.SUCCESS ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
          job.status === JobStatus.RUNNING ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 animate-pulse' :
            'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
        }`}>
        {job.status === JobStatus.RUNNING && <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />}
        {job.status}
      </div>
    </div>

    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">{job.name}</h3>
    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-4 gap-2">
      <span className="truncate max-w-[100px]">{job.sourcePath}</span>
      <Icons.ArrowRight size={12} />
      <span className="truncate max-w-[100px]">{job.destPath}</span>
    </div>
    <div className="flex items-center gap-2 mb-2">
      <ModePill mode={job.mode} />
    </div>

    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1">
        <Icons.Clock size={12} />
        {formatSchedule(job.scheduleInterval)}
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500">
        Last: {job.lastRun ? new Date(job.lastRun).toLocaleDateString() : 'Never'}
      </span>
    </div>
  </div>
);

const ModePill: React.FC<{ mode: SyncJob['mode'] }> = ({ mode }) => {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    MIRROR: { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-700 dark:text-teal-300', label: 'Mirror' },
    ARCHIVE: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-200', label: 'Archive' },
    TIME_MACHINE: { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-800 dark:text-indigo-200', label: 'Time Machine' },
  };
  const style = map[mode] || map.MIRROR;
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
};
