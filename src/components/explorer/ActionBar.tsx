import { SyncJob, JobStatus, RsyncProgressData } from '../../types';
import { Icons } from '../IconComponents';
import { api } from '../../api';

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
  // Format last run time
  const formatLastRun = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Get status display
  const getStatusDisplay = (): { text: string; color: string } => {
    if (isRunning) {
      return { text: 'Running', color: 'text-amber-600 dark:text-amber-400' };
    }

    switch (job.status) {
      case JobStatus.SUCCESS:
        return { text: 'Completed', color: 'text-green-600 dark:text-green-400' };
      case JobStatus.FAILED:
        return { text: 'Failed', color: 'text-red-600 dark:text-red-400' };
      case JobStatus.RUNNING:
        return { text: 'Running', color: 'text-amber-600 dark:text-amber-400' };
      default:
        return { text: 'Idle', color: 'text-stone-700 dark:text-stone-300' };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="border-b border-stone-200 bg-stone-50 px-6 py-3 dark:border-stone-700 dark:bg-stone-800/50">
      {/* Progress bar when running */}
      {isRunning && progress && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-stone-600 dark:text-stone-400">
              {progress.currentFile
                ? `Syncing: ${progress.currentFile}`
                : `${progress.transferred} transferred`}
            </span>
            <span className="font-medium text-amber-600">{progress.percentage}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-stone-500">
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
            <button
              onClick={onStopBackup}
              className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              <Icons.Square className="h-4 w-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={onRunBackup}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              <Icons.Play className="h-4 w-4" />
              Run Backup
            </button>
          )}

          {/* Open Destination */}
          <button
            onClick={() => api.openPath(job.destPath)}
            className="flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <Icons.FolderOpen className="h-4 w-4" />
            Open Destination
          </button>

          {/* Restore */}
          <button
            onClick={onRestore}
            className="flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <Icons.RotateCcw className="h-4 w-4" />
            Restore
          </button>

          {/* Edit */}
          <button
            onClick={onEdit}
            className="flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <Icons.Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>

        {/* Status line */}
        <div className="flex items-center gap-4 text-sm text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-2">
            <span>Status:</span>
            <span className={`font-medium ${status.color}`}>{status.text}</span>
          </div>
          <div className="h-4 w-px bg-stone-300 dark:bg-stone-600" />
          <div>
            Last run:{' '}
            <span className="font-medium text-stone-700 dark:text-stone-300">
              {formatLastRun(job.lastRun)}
            </span>
          </div>
          {job.scheduleInterval && job.scheduleInterval > 0 && (
            <>
              <div className="h-4 w-px bg-stone-300 dark:bg-stone-600" />
              <div>
                Interval:{' '}
                <span className="font-medium text-stone-700 dark:text-stone-300">
                  {formatInterval(job.scheduleInterval)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to format schedule interval
function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d`;
  return `${Math.floor(minutes / 10080)}w`;
}

export default ActionBar;
