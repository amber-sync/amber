import { useState, useEffect } from 'react';
import { SyncJob, Snapshot } from '../../../types';
import { api } from '../../../api';
import { Icons } from '../../IconComponents';
import { Button, IconButton, Select } from '../../ui';
import { formatBytes } from '../../../utils';

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

  // Convert snapshots to Select options
  const snapshotOptions = snapshots.map(s => ({
    value: s.id,
    label: `${new Date(s.timestamp).toLocaleString()} (${s.fileCount} files)`,
  }));

  return (
    <div className="flex h-full flex-col">
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {success ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-[var(--color-success-subtle)] p-4">
              <Icons.Check className="h-8 w-8 text-[var(--color-success)]" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-text-primary">Restore Complete</h3>
            <p className="mb-4 text-sm text-text-secondary">Files have been restored to:</p>
            <code className="mb-4 rounded bg-layer-3 px-3 py-1 text-sm text-text-primary">
              {targetPath}
            </code>
            <Button onClick={handleOpenTarget} icon={<Icons.FolderOpen className="h-4 w-4" />}>
              Open in Finder
            </Button>
          </div>
        ) : (
          <>
            {/* Snapshot Selection */}
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-text-primary">
                Snapshot to Restore
              </label>
              <Select
                value={snapshot?.id || ''}
                onChange={e => {
                  const selected = snapshots.find(s => s.id === e.target.value);
                  setSnapshot(selected || null);
                }}
                options={snapshotOptions}
                placeholder="Select a snapshot..."
                disabled={restoring}
              />
            </div>

            {/* Snapshot Info */}
            {snapshot && (
              <div className="mb-4 rounded-lg border border-border-base bg-layer-2 p-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-text-tertiary">Date:</span>
                    <span className="ml-2 font-medium text-text-primary">
                      {new Date(snapshot.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Time:</span>
                    <span className="ml-2 font-medium text-text-primary">
                      {new Date(snapshot.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Files:</span>
                    <span className="ml-2 font-medium text-text-primary">
                      {snapshot.fileCount?.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Size:</span>
                    <span className="ml-2 font-medium text-text-primary">
                      {formatBytes(snapshot.sizeBytes)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Target Path */}
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-text-primary">Restore To</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetPath}
                  onChange={e => setTargetPath(e.target.value)}
                  className="flex-1 rounded-lg border border-border-base bg-layer-2 px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-border-highlight focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
                  placeholder="/Users/you/Desktop"
                  disabled={restoring}
                />
                <IconButton
                  label="Browse"
                  variant="default"
                  size="md"
                  onClick={handleSelectTarget}
                  disabled={restoring}
                >
                  <Icons.FolderOpen className="h-4 w-4" />
                </IconButton>
              </div>
            </div>

            {/* Progress */}
            {progress && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--color-info-subtle)] px-3 py-2 text-sm text-[var(--color-info)]">
                <Icons.RefreshCw className="h-4 w-4 animate-spin" />
                {progress}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-lg bg-[var(--color-error-subtle)] px-3 py-2 text-sm text-[var(--color-error)]">
                {error}
              </div>
            )}

            {/* Info */}
            <div className="rounded-lg bg-layer-2 p-3 text-sm text-text-secondary">
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
      <div className="border-t border-border-base p-4">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {success ? 'Close' : 'Cancel'}
          </Button>
          {!success && (
            <Button
              onClick={handleRestore}
              disabled={restoring || !snapshot || !targetPath}
              loading={restoring}
            >
              Restore Snapshot
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RestorePanel;
