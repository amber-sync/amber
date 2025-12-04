/**
 * RestoreOverlay - Restore workflow in overlay
 *
 * Wraps the RestorePanel component with Observatory styling.
 */

import { useState, useEffect } from 'react';
import { SyncJob, Snapshot } from '../../../types';
import { api } from '../../../api';
import { Icons } from '../../../components/IconComponents';
import { formatBytes } from '../../../utils';
import { TimeMachineSnapshot } from '../TimeMachine';

interface RestoreOverlayProps {
  isOpen: boolean;
  job: SyncJob;
  snapshot: TimeMachineSnapshot | null;
  snapshots: TimeMachineSnapshot[];
  onClose: () => void;
}

export function RestoreOverlay({ isOpen, job, snapshot, snapshots, onClose }: RestoreOverlayProps) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<TimeMachineSnapshot | null>(snapshot);
  const [targetPath, setTargetPath] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Set default target path
  useEffect(() => {
    setTargetPath(`${job.destPath}/restored`);
  }, [job.destPath]);

  // Update selected snapshot when prop changes
  useEffect(() => {
    if (snapshot) {
      setSelectedSnapshot(snapshot);
    }
  }, [snapshot]);

  // Reset state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);
      setProgress(null);
    }
  }, [isOpen]);

  const handleSelectTarget = async () => {
    const path = await api.selectDirectory();
    if (path) {
      setTargetPath(path);
    }
  };

  const handleRestore = async () => {
    if (!selectedSnapshot?.path) {
      setError('No snapshot selected');
      return;
    }

    setRestoring(true);
    setError(null);
    setProgress('Preparing restore...');

    try {
      const result = await api.restoreFiles(job, selectedSnapshot.path, [], targetPath);

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
    <div className={`tm-overlay ${isOpen ? 'tm-overlay--visible' : ''}`}>
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel */}
      <div className="tm-overlay-panel" style={{ width: '480px' }}>
        {/* Header */}
        <div className="tm-overlay-header">
          <h2 className="tm-overlay-title">Restore Files</h2>
          <button onClick={onClose} className="tm-overlay-close">
            <Icons.X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="tm-overlay-content">
          {success ? (
            <div className="flex flex-col items-center justify-center text-center py-8">
              <div className="w-16 h-16 rounded-full bg-[var(--tm-success)]/20 flex items-center justify-center mb-4">
                <Icons.Check size={32} className="text-[var(--tm-success)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--tm-text-bright)] mb-2">
                Restore Complete
              </h3>
              <p className="text-sm text-[var(--tm-text-dim)] mb-4">Files have been restored to:</p>
              <code className="px-3 py-1.5 bg-[var(--tm-dust)] rounded-lg text-sm text-[var(--tm-text-soft)] tm-font-mono mb-6">
                {targetPath}
              </code>
              <button onClick={handleOpenTarget} className="tm-action-btn tm-action-btn--primary">
                <Icons.FolderOpen size={18} />
                <span>Open in Finder</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Snapshot Selection */}
              <div>
                <label className="block text-sm font-medium text-[var(--tm-text-soft)] mb-2">
                  Snapshot to Restore
                </label>
                <select
                  value={selectedSnapshot?.id || ''}
                  onChange={e => {
                    const snap = snapshots.find(s => s.id === e.target.value);
                    setSelectedSnapshot(snap || null);
                  }}
                  className="w-full px-3 py-2 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg text-sm text-[var(--tm-text-bright)] focus:outline-none focus:border-[var(--tm-amber)]"
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
              {selectedSnapshot && (
                <div className="p-4 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-[var(--tm-text-dim)]">Date:</span>
                      <span className="ml-2 text-[var(--tm-text-bright)]">
                        {new Date(selectedSnapshot.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--tm-text-dim)]">Time:</span>
                      <span className="ml-2 text-[var(--tm-text-bright)]">
                        {new Date(selectedSnapshot.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--tm-text-dim)]">Files:</span>
                      <span className="ml-2 text-[var(--tm-text-bright)]">
                        {selectedSnapshot.fileCount?.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--tm-text-dim)]">Size:</span>
                      <span className="ml-2 text-[var(--tm-text-bright)]">
                        {formatBytes(selectedSnapshot.sizeBytes ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Target Path */}
              <div>
                <label className="block text-sm font-medium text-[var(--tm-text-soft)] mb-2">
                  Restore To
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetPath}
                    onChange={e => setTargetPath(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg text-sm text-[var(--tm-text-bright)] tm-font-mono focus:outline-none focus:border-[var(--tm-amber)]"
                    placeholder="/Users/you/Desktop"
                    disabled={restoring}
                  />
                  <button
                    onClick={handleSelectTarget}
                    className="px-3 py-2 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg text-[var(--tm-text-dim)] hover:text-[var(--tm-text-bright)] hover:border-[var(--tm-mist)] transition-colors"
                    disabled={restoring}
                  >
                    <Icons.FolderOpen size={18} />
                  </button>
                </div>
              </div>

              {/* Progress */}
              {progress && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--tm-amber-wash)] rounded-lg text-sm text-[var(--tm-amber)]">
                  <Icons.RefreshCw size={16} className="animate-spin" />
                  {progress}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="px-3 py-2 bg-[var(--tm-error)]/10 rounded-lg text-sm text-[var(--tm-error)]">
                  {error}
                </div>
              )}

              {/* Info */}
              <div className="flex items-start gap-2 p-3 bg-[var(--tm-nebula)] rounded-lg text-sm text-[var(--tm-text-dim)]">
                <Icons.Info size={16} className="mt-0.5 flex-shrink-0" />
                <span>
                  Files will be restored to the selected destination. Existing files will not be
                  overwritten.
                </span>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--tm-dust)]">
                <button onClick={onClose} className="tm-action-btn tm-action-btn--secondary">
                  Cancel
                </button>
                <button
                  onClick={handleRestore}
                  disabled={restoring || !selectedSnapshot || !targetPath}
                  className={`tm-action-btn tm-action-btn--primary ${
                    restoring || !selectedSnapshot || !targetPath
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {restoring ? (
                    <Icons.RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Icons.RotateCcw size={18} />
                  )}
                  <span>Restore Snapshot</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RestoreOverlay;
