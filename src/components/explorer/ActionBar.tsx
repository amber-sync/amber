import { SyncJob, JobStatus, RsyncProgressData } from '../../types';
import { Icons } from '../IconComponents';
import { api } from '../../api';
import { Button, Badge, StatusDot, ProgressBar } from '../ui';
import { formatRelativeTime, formatSchedule } from '../../utils';

interface ActionBarProps {
  job: SyncJob;
  isRunning: boolean;
  progress: RsyncProgressData | null;
  onRunBackup: () => void;
  onStopBackup: () => void;
  onRestore: () => void;
  onEdit: () => void;
}

/**
 * ActionBar - Primary actions for the Time Explorer view (TIM-131)
 *
 * Shows Run/Stop backup, Open Destination, Restore, and Edit buttons,
 * plus a status line with last run info and progress when running.
 */
export function ActionBar({
  job,
  isRunning,
  progress,
  onRunBackup,
  onStopBackup,
  onRestore,
  onEdit,
}: ActionBarProps) {
  // Get status info for display
  const getStatusInfo = (): {
    text: string;
    status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  } => {
    if (isRunning) {
      return { text: 'Running', status: 'info' };
    }

    switch (job.status) {
      case JobStatus.SUCCESS:
        return { text: 'Completed', status: 'success' };
      case JobStatus.FAILED:
        return { text: 'Failed', status: 'error' };
      case JobStatus.RUNNING:
        return { text: 'Running', status: 'info' };
      default:
        return { text: 'Idle', status: 'neutral' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="border-b border-border-base bg-layer-2 px-6 py-3">
      {/* Progress bar when running */}
      {isRunning && progress && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-text-secondary">
              {progress.currentFile
                ? `Syncing: ${progress.currentFile}`
                : `${progress.transferred} transferred`}
            </span>
            <span className="font-medium text-text-primary">{progress.percentage}%</span>
          </div>
          <ProgressBar progress={progress.percentage} size="sm" />
          <div className="mt-1 flex items-center justify-between text-xs text-text-tertiary">
            <span>{progress.speed}</span>
            {progress.eta && <span>ETA: {progress.eta}</span>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {/* Run/Stop button */}
          {isRunning ? (
            <Button
              variant="danger"
              onClick={onStopBackup}
              icon={<Icons.Square className="h-4 w-4" />}
            >
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={onRunBackup}
              icon={<Icons.Play className="h-4 w-4" />}
            >
              Run Backup
            </Button>
          )}

          {/* Open Destination */}
          <Button
            variant="secondary"
            onClick={() => api.openPath(job.destPath)}
            icon={<Icons.FolderOpen className="h-4 w-4" />}
          >
            Open Destination
          </Button>

          {/* Restore */}
          <Button
            variant="secondary"
            onClick={onRestore}
            icon={<Icons.RotateCcw className="h-4 w-4" />}
          >
            Restore
          </Button>

          {/* Edit */}
          <Button variant="secondary" onClick={onEdit} icon={<Icons.Pencil className="h-4 w-4" />}>
            Edit
          </Button>
        </div>

        {/* Status line */}
        <div className="flex items-center gap-4 text-sm text-text-secondary">
          <div className="flex items-center gap-2">
            <StatusDot status={statusInfo.status} pulse={isRunning} />
            <Badge status={statusInfo.status} size="sm">
              {statusInfo.text}
            </Badge>
          </div>
          <div className="h-4 w-px bg-border-base" />
          <div>
            Last run:{' '}
            <span className="font-medium text-text-primary">
              {job.lastRun ? formatRelativeTime(job.lastRun) : 'Never'}
            </span>
          </div>
          {job.scheduleInterval && job.scheduleInterval > 0 && (
            <>
              <div className="h-4 w-px bg-border-base" />
              <div>
                Schedule:{' '}
                <span className="font-medium text-text-primary">
                  {formatSchedule(job.scheduleInterval)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActionBar;
