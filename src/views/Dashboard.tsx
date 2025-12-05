import React, { useState, useMemo } from 'react';
import { SyncJob, DiskStats } from '../types';
import { Icons } from '../components/IconComponents';
import { formatBytes } from '../utils';
import { BackupCalendar } from '../components/analytics';
import { format } from 'date-fns';
import { Button, Card, StatusDot, IconButton } from '../components/ui';
import { JobCard } from '../components/JobCard';

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
  onRunBackup?: (jobId: string) => void;
  onEditSettings?: (jobId: string) => void;
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
  onRunBackup,
  onEditSettings,
}) => {
  const [selectedDay, setSelectedDay] = useState<{ date: Date; backups: DayBackup[] } | null>(null);

  // Memoize expensive calculations
  const totalProtectedSize = useMemo(() => {
    return jobs.reduce((acc, job) => {
      const snapshots = job.snapshots ?? [];
      const latest = snapshots[snapshots.length - 1];
      return acc + (latest?.sizeBytes || 0);
    }, 0);
  }, [jobs]);

  const totalSnapshots = useMemo(() => {
    return jobs.reduce((acc, job) => acc + (job.snapshots ?? []).length, 0);
  }, [jobs]);

  const handleDayClick = (date: Date, backups: DayBackup[]) => {
    if (backups.length > 0) {
      setSelectedDay({ date, backups });
    } else {
      setSelectedDay(null);
    }
  };

  return (
    <div className="page-content page-animate-in">
      {/* Stats Bar & New Job Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4 no-drag">
          <div className="page-stats">
            <div className="page-stat">
              <div className="page-stat-icon">
                <Icons.Database size={18} />
              </div>
              <div>
                <div className="page-stat-label">Protected</div>
                <div className="page-stat-value">{formatBytes(totalProtectedSize)}</div>
              </div>
            </div>
            <div className="page-stat-divider" />
            <div className="page-stat">
              <div className="page-stat-icon">
                <Icons.Activity size={18} />
              </div>
              <div>
                <div className="page-stat-label">Active Jobs</div>
                <div className="page-stat-value">{jobs.length}</div>
              </div>
            </div>
            <div className="page-stat-divider" />
            <div className="page-stat">
              <div className="page-stat-icon">
                <Icons.Archive size={18} />
              </div>
              <div>
                <div className="page-stat-label">Snapshots</div>
                <div className="page-stat-value">{totalSnapshots}</div>
              </div>
            </div>
          </div>
        </div>

        <Button onClick={onCreateJob} icon={<Icons.Plus size={18} />} className="no-drag">
          New Job
        </Button>
      </div>

      {/* Jobs List - Primary Content */}
      <div className="page-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider font-display">
            Backup Jobs
          </h2>
          <span className="text-xs text-text-quaternary">Click to expand details</span>
        </div>

        <div className="space-y-3">
          {jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              mountInfo={mountStatus?.[job.id]}
              onSelect={() => onSelectJob(job.id)}
              onRunBackup={onRunBackup}
              onEditSettings={onEditSettings}
            />
          ))}

          {jobs.length === 0 && (
            <div className="page-empty">
              <Icons.HardDrive className="page-empty-icon" size={48} />
              <p className="page-empty-text">No sync jobs configured yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Section */}
      {jobs.length > 0 && (
        <div className="page-section pt-6 border-t border-border-base">
          <h2 className="page-section-title font-display">Analytics</h2>

          <div className="grid grid-cols-1 gap-5">
            <BackupCalendar jobs={jobs} onDayClick={handleDayClick} />
          </div>

          {/* Selected Day Details */}
          {selectedDay && (
            <Card className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-text-primary">
                  Backups on {format(selectedDay.date, 'MMMM d, yyyy')}
                </h3>
                <IconButton
                  label="Close"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDay(null)}
                >
                  <Icons.X size={16} />
                </IconButton>
              </div>
              <div className="space-y-2">
                {selectedDay.backups.map((backup, index) => (
                  <div
                    key={`${backup.jobId}-${index}`}
                    onClick={() => onSelectJob(backup.jobId)}
                    className="flex items-center justify-between p-2 hover:bg-layer-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot status={backup.status === 'success' ? 'success' : 'error'} />
                      <span className="text-sm text-text-primary">{backup.jobName}</span>
                    </div>
                    <span className="text-xs text-text-tertiary">
                      {format(new Date(backup.timestamp), 'h:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
