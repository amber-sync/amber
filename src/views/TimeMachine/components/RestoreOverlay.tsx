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

type RestoreMode = 'merge' | 'mirror';
type RestoreStep = 'configure' | 'confirm';

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
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
  const [step, setStep] = useState<RestoreStep>('configure');
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
      setStep('configure');
      setRestoreMode('merge');
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
    setProgress(restoreMode === 'mirror' ? 'Mirror restore in progress...' : 'Restoring files...');

    try {
      const result = await api.restoreSnapshot(
        job,
        selectedSnapshot.path,
        targetPath,
        restoreMode === 'mirror'
      );

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
          ) : step === 'configure' ? (
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
                  className="w-full px-3 py-2.5 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg text-sm text-[var(--tm-text-bright)] focus:outline-none focus:ring-2 focus:ring-[var(--tm-accent)]/30 focus:border-[var(--tm-accent)] cursor-pointer"
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
                    className="flex-1 px-3 py-2.5 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg text-sm text-[var(--tm-text-bright)] tm-font-mono focus:outline-none focus:ring-2 focus:ring-[var(--tm-accent)]/30 focus:border-[var(--tm-accent)]"
                    placeholder="/Users/you/Desktop"
                    disabled={restoring}
                  />
                  <button
                    onClick={handleSelectTarget}
                    className="px-3 py-2.5 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg text-[var(--tm-text-dim)] hover:text-[var(--tm-text-bright)] hover:border-[var(--tm-mist)] transition-colors"
                    disabled={restoring}
                  >
                    <Icons.FolderOpen size={18} />
                  </button>
                </div>
              </div>

              {/* Restore Mode */}
              <div>
                <label className="block text-sm font-medium text-[var(--tm-text-soft)] mb-3">
                  Restore Mode
                </label>
                <div className="space-y-3">
                  {/* Merge Option */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      restoreMode === 'merge'
                        ? 'bg-[var(--tm-accent-wash)] border-[var(--tm-accent)]'
                        : 'bg-[var(--tm-nebula)] border-[var(--tm-dust)] hover:border-[var(--tm-mist)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="restoreMode"
                      value="merge"
                      checked={restoreMode === 'merge'}
                      onChange={() => setRestoreMode('merge')}
                      className="mt-0.5 accent-[var(--tm-accent)]"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-[var(--tm-text-bright)]">
                        Merge (Safe)
                      </div>
                      <div className="text-xs text-[var(--tm-text-dim)] mt-0.5">
                        Copy files from snapshot. Updates existing files but keeps any extra files
                        in the destination.
                      </div>
                    </div>
                  </label>

                  {/* Mirror Option */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      restoreMode === 'mirror'
                        ? 'bg-[var(--tm-error)]/10 border-[var(--tm-error)]'
                        : 'bg-[var(--tm-nebula)] border-[var(--tm-dust)] hover:border-[var(--tm-mist)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="restoreMode"
                      value="mirror"
                      checked={restoreMode === 'mirror'}
                      onChange={() => setRestoreMode('mirror')}
                      className="mt-0.5 accent-[var(--tm-error)]"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-[var(--tm-text-bright)] flex items-center gap-2">
                        Mirror (Exact)
                        <span className="text-[10px] px-1.5 py-0.5 bg-[var(--tm-error)]/20 text-[var(--tm-error)] rounded font-semibold">
                          DESTRUCTIVE
                        </span>
                      </div>
                      <div className="text-xs text-[var(--tm-text-dim)] mt-0.5">
                        Make destination an exact copy. Files not in the snapshot will be{' '}
                        <strong className="text-[var(--tm-error)]">deleted</strong>.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="px-3 py-2 bg-[var(--tm-error)]/10 border border-[var(--tm-error)]/30 rounded-lg text-sm text-[var(--tm-error)]">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--tm-dust)]">
                <button onClick={onClose} className="tm-control-btn tm-control-btn--secondary">
                  Cancel
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!selectedSnapshot || !targetPath}
                  className={`tm-control-btn tm-control-btn--primary ${
                    !selectedSnapshot || !targetPath ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <span>Continue</span>
                  <Icons.ChevronRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            /* Confirmation Step */
            <div className="space-y-6">
              {/* Warning for Mirror mode */}
              {restoreMode === 'mirror' && (
                <div className="flex items-start gap-3 p-4 bg-[var(--tm-error)]/10 border border-[var(--tm-error)]/30 rounded-lg">
                  <Icons.AlertTriangle
                    size={20}
                    className="text-[var(--tm-error)] flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <div className="font-semibold text-sm text-[var(--tm-error)]">
                      Warning: Mirror Mode
                    </div>
                    <div className="text-xs text-[var(--tm-text-dim)] mt-1">
                      This will delete any files in the destination that are not in the snapshot.
                      This action cannot be undone.
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg space-y-3">
                <h4 className="text-sm font-semibold text-[var(--tm-text-bright)]">
                  Restore Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--tm-text-dim)]">Snapshot:</span>
                    <span className="text-[var(--tm-text-bright)]">
                      {selectedSnapshot && new Date(selectedSnapshot.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--tm-text-dim)]">Files:</span>
                    <span className="text-[var(--tm-text-bright)]">
                      {selectedSnapshot?.fileCount?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--tm-text-dim)]">Size:</span>
                    <span className="text-[var(--tm-text-bright)]">
                      {formatBytes(selectedSnapshot?.sizeBytes ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--tm-text-dim)]">Mode:</span>
                    <span
                      className={
                        restoreMode === 'mirror'
                          ? 'text-[var(--tm-error)] font-medium'
                          : 'text-[var(--tm-text-bright)]'
                      }
                    >
                      {restoreMode === 'merge' ? 'Merge (Safe)' : 'Mirror (Exact)'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[var(--tm-dust)]">
                    <span className="text-[var(--tm-text-dim)]">Destination:</span>
                    <code className="block mt-1 px-2 py-1 bg-[var(--tm-dust)] rounded text-xs text-[var(--tm-text-soft)] tm-font-mono break-all">
                      {targetPath}
                    </code>
                  </div>
                </div>
              </div>

              {/* Progress */}
              {progress && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--tm-accent-wash)] rounded-lg text-sm text-[var(--tm-accent)]">
                  <Icons.RefreshCw size={16} className="animate-spin" />
                  {progress}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="px-3 py-2 bg-[var(--tm-error)]/10 border border-[var(--tm-error)]/30 rounded-lg text-sm text-[var(--tm-error)]">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between gap-3 pt-4 border-t border-[var(--tm-dust)]">
                <button
                  onClick={() => setStep('configure')}
                  disabled={restoring}
                  className="tm-control-btn tm-control-btn--secondary"
                >
                  <Icons.ChevronLeft size={18} />
                  <span>Back</span>
                </button>
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className={`tm-control-btn ${
                    restoreMode === 'mirror' ? 'tm-control-btn--danger' : 'tm-control-btn--primary'
                  } ${restoring ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {restoring ? (
                    <Icons.RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Icons.RotateCcw size={18} />
                  )}
                  <span>{restoreMode === 'mirror' ? 'Mirror Restore' : 'Restore Files'}</span>
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
