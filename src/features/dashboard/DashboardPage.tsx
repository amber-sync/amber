import React, { useState, useCallback, useMemo } from 'react';
import { SyncJob, DiskStats } from '../../types';
import { Icons } from '../../components/IconComponents';
import { formatBytes } from '../../utils';
import { BackupCalendar } from '../../components/analytics';
import { format } from 'date-fns';
import { Button, Card, StatusDot, IconButton, Title, Body, Caption } from '../../components/ui';
import { PageContainer, PageSection } from '../../components/layout';
import { JobCard } from './components/JobCard';

interface JobMountInfo {
  mounted: boolean;
  isExternal: boolean;
  volumeName?: string;
}

interface DayBackup {
  jobId: string;
  jobName: string;
  status: 'success' | 'failed';
  timestamp: number;
}

export interface DashboardPageProps {
  jobs: SyncJob[];
  diskStats: Record<string, DiskStats>;
  /** Mount status for each job, keyed by job ID */
  mountStatus?: Record<string, JobMountInfo>;
  onSelectJob: (jobId: string) => void;
  onCreateJob: () => void;
  onRunBackup?: (jobId: string) => void;
  onEditSettings?: (jobId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
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

  const handleDayClick = useCallback((date: Date, backups: DayBackup[]) => {
    if (backups.length > 0) {
      setSelectedDay({ date, backups });
    } else {
      setSelectedDay(null);
    }
  }, []);

  return (
    <PageContainer width="default" scrollable animate>
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
      <PageSection
        title="Backup Jobs"
        headerRight={<Caption color="quaternary">Click to expand details</Caption>}
      >
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
              <Body size="sm" as="p" color="tertiary">
                No sync jobs configured yet.
              </Body>
            </div>
          )}
        </div>
      </PageSection>

      {/* Analytics Section */}
      {jobs.length > 0 && (
        <PageSection title="Analytics" className="section-divider">
          <div className="grid grid-cols-1 gap-5">
            <BackupCalendar jobs={jobs} onDayClick={handleDayClick} />
          </div>

          {/* Selected Day Details */}
          {selectedDay && (
            <Card className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <Title level={3}>Backups on {format(selectedDay.date, 'MMMM d, yyyy')}</Title>
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
                      <Body size="sm">{backup.jobName}</Body>
                    </div>
                    <Caption color="tertiary">
                      {format(new Date(backup.timestamp), 'h:mm a')}
                    </Caption>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </PageSection>
      )}
    </PageContainer>
  );
};
