import React, { useState, useCallback, useMemo } from 'react';
import { SyncJob, LogEntry, RsyncProgressData } from '../../types';
import { Icons } from '../../components/IconComponents';
import { formatBytes } from '../../utils';
import { BackupCalendar } from './components/BackupCalendar';
import { format } from 'date-fns';
import { Button, Card, StatusDot, IconButton, Title, Body, Caption } from '../../components/ui';
import { PageContainer, PageSection } from '../../components/layout';
import { JobCard } from './components/JobCard';
import { ImportBackupModal } from './components/ImportBackupModal';

interface JobMountInfo {
  mounted: boolean;
  isExternal: boolean;
  volumeName?: string;
}

interface DayBackup {
  jobId: string;
  jobName: string;
  status: 'success' | 'warning' | 'failed';
  timestamp: number;
}

export interface DashboardPageProps {
  jobs: SyncJob[];
  /** Mount status for each job, keyed by job ID */
  mountStatus?: Record<string, JobMountInfo>;
  /** Currently active/running job ID */
  activeJobId?: string | null;
  /** Logs for the active job */
  logs?: LogEntry[];
  /** Progress for the active job */
  progress?: RsyncProgressData | null;
  onSelectJob: (jobId: string) => void;
  onCreateJob: () => void;
  onRunBackup?: (jobId: string) => void;
  onEditSettings?: (jobId: string) => void;
  onImportJob?: (job: SyncJob) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  jobs,
  mountStatus,
  activeJobId,
  logs = [],
  progress = null,
  onSelectJob,
  onCreateJob,
  onRunBackup,
  onEditSettings,
  onImportJob,
}) => {
  const [selectedDay, setSelectedDay] = useState<{ date: Date; backups: DayBackup[] } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const knownJobIds = useMemo(() => jobs.map(j => j.id), [jobs]);

  const handleImportJob = useCallback(
    (job: SyncJob) => {
      onImportJob?.(job);
      setShowImportModal(false);
    },
    [onImportJob]
  );

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
              <div className="page-stat-icon page-stat-icon--success">
                <Icons.Shield size={18} />
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

        <div className="flex items-center gap-2 no-drag">
          <Button
            variant="secondary"
            onClick={() => setShowImportModal(true)}
            icon={<Icons.DownloadCloud size={18} />}
          >
            Import
          </Button>
          <Button onClick={onCreateJob} icon={<Icons.Plus size={18} />}>
            New Job
          </Button>
        </div>
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
              logs={job.id === activeJobId ? logs : undefined}
              progress={job.id === activeJobId ? progress : undefined}
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
                      <StatusDot
                        status={
                          backup.status === 'success'
                            ? 'success'
                            : backup.status === 'warning'
                              ? 'warning'
                              : 'error'
                        }
                      />
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

      {/* Import Backup Modal */}
      {showImportModal && (
        <ImportBackupModal
          knownJobIds={knownJobIds}
          onImport={handleImportJob}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </PageContainer>
  );
};
