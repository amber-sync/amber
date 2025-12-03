import { useState, useEffect } from 'react';
import { SyncJob, Snapshot } from '../../../types';
import { api } from '../../../api';
import { Icons } from '../../IconComponents';

interface RestorePanelProps {
  job: SyncJob;
  selectedSnapshot: Snapshot | null;
  snapshots: Snapshot[];
  onClose: () => void;
}

/**
 * RestorePanel - Slide-out panel for restoring files from snapshots (TIM-136)
 *
 * Simplified restore workflow:
 * 1. Select a snapshot (pre-selected if one was chosen in main view)
 * 2. Choose restore target
 * 3. Restore entire snapshot or specific files
 */
export function RestorePanel({ job, selectedSnapshot, snapshots, onClose }: RestorePanelProps) {
  // State
  const [snapshot, setSnapshot] = useState<Snapshot | null>(selectedSnapshot);
  const [targetPath, setTargetPath] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Set default target to Desktop (use job dest as fallback)
  useEffect(() => {
    // Default to a subdirectory in the job destination
    setTargetPath(`${job.destPath}/restored`);
  }, [job.destPath]);

  // Update snapshot when prop changes
  useEffect(() => {
    if (selectedSnapshot) {
      setSnapshot(selectedSnapshot);
    }
  }, [selectedSnapshot]);

  const handleSelectTarget = async () => {
    const path = await api.selectDirectory();
    if (path) {
      setTargetPath(path);
    }
  };

  const handleRestore = async () => {
    if (!snapshot?.path) {
      setError('No snapshot selected');
      return;
    }

    setRestoring(true);
    setError(null);
    setProgress('Preparing restore...');

    try {
      // Restore the entire snapshot
      const result = await api.restoreFiles(job, snapshot.path, [], targetPath);

      if (result.success) {
        setSuccess(true);
        setProgress(null);
      } else {
        setError(result.error || 'Restore failed');
        setProgress(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
      setProgress(null);
    } finally {
      setRestoring(false);
    }
  };

  const handleOpenTarget = () => {
    if (targetPath) {
      api.openPath(targetPath);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {success ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-green-100 p-4 dark:bg-green-900/30">
              <Icons.Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Restore Complete</h3>
            <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
              Files have been restored to:
            </p>
            <code className="mb-4 rounded bg-stone-100 px-3 py-1 text-sm dark:bg-stone-800">
              {targetPath}
            </code>
            <button
              onClick={handleOpenTarget}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              <Icons.FolderOpen className="h-4 w-4" />
              Open in Finder
            </button>
          </div>
        ) : (
          <>
            {/* Snapshot Selection */}
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Snapshot to Restore
              </label>
              <select
                value={snapshot?.id || ''}
                onChange={e => {
                  const selected = snapshots.find(s => s.id === e.target.value);
                  setSnapshot(selected || null);
                }}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-800"
                disabled={restoring}
              >
                <option value="">Select a snapshot...</option>
                {snapshots.map(s => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.timestamp).toLocaleString()} ({s.fileCount} files)
                  </option>
                ))}
              </select>
            </div>

            {/* Snapshot Info */}
            {snapshot && (
              <div className="mb-4 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-stone-500 dark:text-stone-400">Date:</span>
                    <span className="ml-2 font-medium">
                      {new Date(snapshot.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 dark:text-stone-400">Time:</span>
                    <span className="ml-2 font-medium">
                      {new Date(snapshot.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 dark:text-stone-400">Files:</span>
                    <span className="ml-2 font-medium">{snapshot.fileCount?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 dark:text-stone-400">Size:</span>
                    <span className="ml-2 font-medium">{formatBytes(snapshot.sizeBytes)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Target Path */}
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Restore To
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetPath}
                  onChange={e => setTargetPath(e.target.value)}
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-800"
                  placeholder="/Users/you/Desktop"
                  disabled={restoring}
                />
                <button
                  onClick={handleSelectTarget}
                  disabled={restoring}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:hover:bg-stone-700"
                >
                  <Icons.FolderOpen className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Progress */}
            {progress && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <Icons.RefreshCw className="h-4 w-4 animate-spin" />
                {progress}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Info */}
            <div className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600 dark:bg-stone-800/50 dark:text-stone-400">
              <p className="flex items-start gap-2">
                <Icons.Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  Files will be restored to the selected destination. Existing files will not be
                  overwritten.
                </span>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-stone-200 p-4 dark:border-stone-700">
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            {success ? 'Close' : 'Cancel'}
          </button>
          {!success && (
            <button
              onClick={handleRestore}
              disabled={restoring || !snapshot || !targetPath}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {restoring ? 'Restoring...' : 'Restore Snapshot'}
            </button>
          )}
        </div>
      </div>
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

export default RestorePanel;
