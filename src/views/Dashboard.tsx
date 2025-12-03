import React, { useState } from 'react';
import { SyncJob, JobStatus, DiskStats } from '../types';
import { Icons } from '../components/IconComponents';
import { formatBytes, formatSchedule, truncateMiddle } from '../utils/formatters';
import { BackupCalendar, StorageProjection } from '../components/analytics';
import { ConnectionDot, OfflineBadge } from '../components/ConnectionStatus';
import { format } from 'date-fns';

interface JobMountInfo {
  mounted: boolean;
  isExternal: boolean;
  volumeName?: string;
}

interface DashboardProps {
  jobs: SyncJob[];
  diskStats: Record<string, DiskStats>;
  /** Mount status for each job, keyed by job ID */
  mountStatus?: Record<string, JobMountInfo>;
  onSelectJob: (jobId: string) => void;
  onCreateJob: () => void;
}

interface DayBackup {
  jobId: string;
  jobName: string;
  status: 'success' | 'failed';
  timestamp: number;
}

export const Dashboard: React.FC<DashboardProps> = ({
  jobs,
  diskStats,
  mountStatus,
  onSelectJob,
  onCreateJob,
}) => {
  const [selectedDay, setSelectedDay] = useState<{ date: Date; backups: DayBackup[] } | null>(null);

  const totalProtectedSize = jobs.reduce((acc, job) => {
    const snapshots = job.snapshots ?? [];
    const latest = snapshots[snapshots.length - 1];
    return acc + (latest?.sizeBytes || 0);
  }, 0);

  const totalSnapshots = jobs.reduce((acc, job) => acc + (job.snapshots ?? []).length, 0);

  const handleDayClick = (date: Date, backups: DayBackup[]) => {
    if (backups.length > 0) {
      setSelectedDay({ date, backups });
    } else {
      setSelectedDay(null);
    }
  };

  return (
    <div className="p-8 space-y-6 relative z-10 max-w-7xl mx-auto">
      {/* Header & Compact Stats */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
        <div className="no-drag">
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Amber</h1>
          <p className="text-text-secondary mt-1">Rsync and Time Machine</p>
        </div>

        <div className="flex items-center gap-6 bg-layer-1/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-border-base shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
              <Icons.Database size={18} />
            </div>
            <div>
              <div className="text-xs text-text-tertiary font-medium uppercase tracking-wider">
                Protected
              </div>
              <div className="text-lg font-bold text-text-primary leading-none">
                {formatBytes(totalProtectedSize)}
              </div>
            </div>
          </div>
          <div className="w-px h-8 bg-border-base" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Icons.Activity size={18} />
            </div>
            <div>
              <div className="text-xs text-text-tertiary font-medium uppercase tracking-wider">
                Active Jobs
              </div>
              <div className="text-lg font-bold text-text-primary leading-none">{jobs.length}</div>
            </div>
          </div>
          <div className="w-px h-8 bg-border-base" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
              <Icons.Archive size={18} />
            </div>
            <div>
              <div className="text-xs text-text-tertiary font-medium uppercase tracking-wider">
                Snapshots
              </div>
              <div className="text-lg font-bold text-text-primary leading-none">
                {totalSnapshots}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onCreateJob}
          className="flex items-center gap-2 bg-accent-primary text-accent-text px-5 py-2.5 rounded-full font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95 no-drag"
        >
          <Icons.Plus size={18} /> New Job
        </button>
      </div>

      {/* Jobs List - Primary Content */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-4 text-xs font-medium text-text-tertiary uppercase tracking-wider">
          <div className="w-1/3">Job Name</div>
          <div className="w-1/3">Source & Destination</div>
          <div className="w-1/6 text-right">Schedule</div>
          <div className="w-1/6 text-right">Last Run</div>
        </div>

        <div className="space-y-3">
          {jobs.map(job => (
            <JobRow
              key={job.id}
              job={job}
              mountInfo={mountStatus?.[job.id]}
              onSelect={() => onSelectJob(job.id)}
            />
          ))}

          {jobs.length === 0 && (
            <div className="py-16 text-center text-text-tertiary bg-layer-1/50 rounded-2xl border border-dashed border-border-base">
              <Icons.HardDrive className="mx-auto mb-4 opacity-20" size={48} />
              <p>No sync jobs configured yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Section */}
      {jobs.length > 0 && (
        <div className="pt-6 border-t border-border-base">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Analytics</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BackupCalendar jobs={jobs} onDayClick={handleDayClick} />
            <StorageProjection jobs={jobs} diskStats={diskStats} />
          </div>

          {/* Selected Day Details */}
          {selectedDay && (
            <div className="mt-4 bg-layer-1 rounded-xl border border-border-base p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-text-primary">
                  Backups on {format(selectedDay.date, 'MMMM d, yyyy')}
                </h3>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1 hover:bg-layer-2 rounded-lg text-text-tertiary"
                >
                  <Icons.X size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {selectedDay.backups.map((backup, index) => (
                  <div
                    key={`${backup.jobId}-${index}`}
                    onClick={() => onSelectJob(backup.jobId)}
                    className="flex items-center justify-between p-2 hover:bg-layer-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${backup.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
                      />
                      <span className="text-sm text-text-primary">{backup.jobName}</span>
                    </div>
                    <span className="text-xs text-text-tertiary">
                      {format(new Date(backup.timestamp), 'h:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const JobRow: React.FC<{
  job: SyncJob;
  mountInfo?: JobMountInfo;
  onSelect: () => void;
}> = ({ job, mountInfo, onSelect }) => {
  const getPathName = (p: string) => p.split('/').pop() || p;
  const isRunning = job.status === JobStatus.RUNNING;
  const mounted = mountInfo?.mounted ?? true; // Default to mounted if no info

  return (
    <div
      onClick={onSelect}
      className="group bg-layer-1 hover:bg-layer-2 rounded-xl p-4 border border-border-base shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4"
    >
      {/* Status Icon with Connection Dot */}
      <div className="relative">
        <div
          className={`p-2.5 rounded-lg shrink-0 ${
            isRunning
              ? 'bg-accent-secondary/20 text-accent-primary animate-pulse'
              : job.status === JobStatus.SUCCESS
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-layer-3 text-text-tertiary'
          }`}
        >
          {isRunning ? (
            <Icons.RefreshCw size={20} className="animate-spin" />
          ) : (
            <Icons.Database size={20} />
          )}
        </div>
        {/* Connection status dot */}
        <div className="absolute -top-0.5 -right-0.5">
          <ConnectionDot mounted={mounted} isRunning={isRunning} />
        </div>
      </div>

      {/* Job Name & Mode */}
      <div className="w-1/3 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-text-primary truncate">{job.name}</h3>
          <ModePill mode={job.mode} />
          {!mounted && <OfflineBadge />}
        </div>
        <div className="text-xs text-text-secondary truncate">{job.status}</div>
      </div>

      {/* Paths */}
      <div className="w-1/3 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs text-text-secondary" title={job.sourcePath}>
          <Icons.Server size={14} className="text-accent-primary shrink-0" />
          <span className="truncate">
            <span className="font-bold">{getPathName(job.sourcePath)}</span>
            <span className="text-text-tertiary ml-1.5 font-mono text-[10px]">
              {truncateMiddle(job.sourcePath, 30)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-secondary" title={job.destPath}>
          <Icons.HardDrive size={14} className="text-orange-500 shrink-0" />
          <span className="truncate">
            <span className="font-bold">{getPathName(job.destPath)}</span>
            <span className="text-text-tertiary ml-1.5 font-mono text-[10px]">
              {truncateMiddle(job.destPath, 30)}
            </span>
          </span>
        </div>
      </div>

      {/* Schedule */}
      <div className="w-1/6 text-right text-sm text-text-secondary">
        <div className="flex items-center justify-end gap-1.5">
          <Icons.Clock size={14} className="opacity-70" />
          {formatSchedule(job.scheduleInterval)}
        </div>
      </div>

      {/* Last Run */}
      <div className="w-1/6 text-right">
        <div className="text-sm font-medium text-text-primary">
          {job.lastRun ? new Date(job.lastRun).toLocaleDateString() : 'Never'}
        </div>
        <div className="text-xs text-text-tertiary">
          {job.lastRun
            ? new Date(job.lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '--:--'}
        </div>
      </div>

      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary">
        <Icons.ArrowRight size={18} />
      </div>
    </div>
  );
};

const ModePill: React.FC<{ mode: SyncJob['mode'] }> = ({ mode }) => {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    MIRROR: {
      bg: 'bg-teal-100 dark:bg-teal-900/40',
      text: 'text-teal-700 dark:text-teal-300',
      label: 'Mirror',
    },
    ARCHIVE: {
      bg: 'bg-amber-100 dark:bg-amber-900/40',
      text: 'text-amber-800 dark:text-amber-200',
      label: 'Archive',
    },
    TIME_MACHINE: {
      bg: 'bg-indigo-100 dark:bg-indigo-900/40',
      text: 'text-indigo-800 dark:text-indigo-200',
      label: 'TM',
    },
  };
  const style = map[mode] || map.MIRROR;
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
};
