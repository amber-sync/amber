/**
 * RestoreOverlay - Restore workflow in overlay
 *
 * Wraps the RestorePanel component with Observatory styling.
 */

import { useState, useEffect, useMemo, memo } from 'react';
import { SyncJob, Snapshot } from '../../../types';
import { api } from '../../../api';
import { Icons } from '../../../components/IconComponents';
import { formatBytes } from '../../../utils';
import { TimeMachineSnapshot } from '../TimeMachinePage';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';

type RestoreMode = 'merge' | 'mirror';
type RestoreStep = 'configure' | 'confirm';

interface RestoreOverlayProps {
  isOpen: boolean;
  job: SyncJob;
  snapshot: TimeMachineSnapshot | null;
  snapshots: TimeMachineSnapshot[];
  onClose: () => void;
}

function RestoreOverlayComponent({
  isOpen,
  job,
  snapshot,
  snapshots,
  onClose,
}: RestoreOverlayProps) {
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
              <div className="w-16 h-16 rounded-full bg-success-subtle flex items-center justify-center mb-4">
                <Icons.Check size={32} className="text-[var(--color-success)]" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Restore Complete</h3>
              <p className="text-sm text-text-tertiary mb-4">Files have been restored to:</p>
              <code className="px-3 py-1.5 bg-layer-3 rounded-lg text-sm text-text-secondary font-mono mb-6">
                {targetPath}
              </code>
              <Button
                variant="primary"
                onClick={handleOpenTarget}
                icon={<Icons.FolderOpen size={16} />}
              >
                Open in Finder
              </Button>
            </div>
          ) : step === 'configure' ? (
            <div className="space-y-6">
              {/* Snapshot Selection */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Snapshot to Restore
                </label>
                <Select
                  value={selectedSnapshot?.id || ''}
                  onChange={e => {
                    const snap = snapshots.find(s => s.id === e.target.value);
                    setSelectedSnapshot(snap || null);
                  }}
                  options={snapshots.map(s => ({
                    value: s.id,
                    label: `${new Date(s.timestamp).toLocaleString()} (${s.fileCount} files)`,
                  }))}
                  placeholder="Select a snapshot..."
                  disabled={restoring}
                />
              </div>

              {/* Snapshot Info */}
              {selectedSnapshot && (
                <div className="p-4 bg-layer-2 border border-border-base rounded-lg">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-text-tertiary">Date:</span>
                      <span className="ml-2 text-text-primary">
                        {new Date(selectedSnapshot.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Time:</span>
                      <span className="ml-2 text-text-primary">
                        {new Date(selectedSnapshot.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Files:</span>
                      <span className="ml-2 text-text-primary">
                        {selectedSnapshot.fileCount?.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Size:</span>
                      <span className="ml-2 text-text-primary">
                        {formatBytes(selectedSnapshot.sizeBytes ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Target Path */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Restore To
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetPath}
                    onChange={e => setTargetPath(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-layer-2 border border-border-base rounded-lg text-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-border-highlight transition-all"
                    placeholder="/Users/you/Desktop"
                    disabled={restoring}
                  />
                  <IconButton
                    onClick={handleSelectTarget}
                    disabled={restoring}
                    label="Browse folder"
                  >
                    <Icons.FolderOpen size={18} />
                  </IconButton>
                </div>
              </div>

              {/* Restore Mode */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-3">
                  Restore Mode
                </label>
                <div className="space-y-3">
                  {/* Merge Option */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      restoreMode === 'merge'
                        ? 'bg-accent-secondary/50 border-accent-primary'
                        : 'bg-layer-2 border-border-base hover:border-border-highlight'
                    }`}
                  >
                    <input
                      type="radio"
                      name="restoreMode"
                      value="merge"
                      checked={restoreMode === 'merge'}
                      onChange={() => setRestoreMode('merge')}
                      className="mt-0.5 accent-accent-primary"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-text-primary">Merge (Safe)</div>
                      <div className="text-xs text-text-tertiary mt-0.5">
                        Copy files from snapshot. Updates existing files but keeps any extra files
                        in the destination.
                      </div>
                    </div>
                  </label>

                  {/* Mirror Option */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      restoreMode === 'mirror'
                        ? 'bg-error-subtle border-[var(--color-error)]'
                        : 'bg-layer-2 border-border-base hover:border-border-highlight'
                    }`}
                  >
                    <input
                      type="radio"
                      name="restoreMode"
                      value="mirror"
                      checked={restoreMode === 'mirror'}
                      onChange={() => setRestoreMode('mirror')}
                      className="mt-0.5 accent-[var(--color-error)]"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-text-primary flex items-center gap-2">
                        Mirror (Exact)
                        <span className="text-[10px] px-1.5 py-0.5 bg-error-subtle text-[var(--color-error)] rounded font-semibold">
                          DESTRUCTIVE
                        </span>
                      </div>
                      <div className="text-xs text-text-tertiary mt-0.5">
                        Make destination an exact copy. Files not in the snapshot will be{' '}
                        <strong className="text-[var(--color-error)]">deleted</strong>.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="px-3 py-2 bg-error-subtle border border-[var(--color-error)]/30 rounded-lg text-sm text-[var(--color-error)]">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border-base">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setStep('confirm')}
                  disabled={!selectedSnapshot || !targetPath}
                  icon={<Icons.ChevronRight size={16} />}
                >
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            /* Confirmation Step */
            <div className="space-y-6">
              {/* Warning for Mirror mode */}
              {restoreMode === 'mirror' && (
                <div className="flex items-start gap-3 p-4 bg-error-subtle border border-[var(--color-error)]/30 rounded-lg">
                  <Icons.AlertTriangle
                    size={20}
                    className="text-[var(--color-error)] flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <div className="font-semibold text-sm text-[var(--color-error)]">
                      Warning: Mirror Mode
                    </div>
                    <div className="text-xs text-text-tertiary mt-1">
                      This will delete any files in the destination that are not in the snapshot.
                      This action cannot be undone.
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-layer-2 border border-border-base rounded-lg space-y-3">
                <h4 className="text-sm font-semibold text-text-primary">Restore Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Snapshot:</span>
                    <span className="text-text-primary">
                      {selectedSnapshot && new Date(selectedSnapshot.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Files:</span>
                    <span className="text-text-primary">
                      {selectedSnapshot?.fileCount?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Size:</span>
                    <span className="text-text-primary">
                      {formatBytes(selectedSnapshot?.sizeBytes ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Mode:</span>
                    <span
                      className={
                        restoreMode === 'mirror'
                          ? 'text-[var(--color-error)] font-medium'
                          : 'text-text-primary'
                      }
                    >
                      {restoreMode === 'merge' ? 'Merge (Safe)' : 'Mirror (Exact)'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border-base">
                    <span className="text-text-tertiary">Destination:</span>
                    <code className="block mt-1 px-2 py-1 bg-layer-3 rounded text-xs text-text-secondary font-mono break-all">
                      {targetPath}
                    </code>
                  </div>
                </div>
              </div>

              {/* Progress */}
              {progress && (
                <div className="flex items-center gap-2 px-3 py-2 bg-accent-secondary rounded-lg text-sm text-accent-primary">
                  <Icons.RefreshCw size={16} className="animate-spin" />
                  {progress}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="px-3 py-2 bg-error-subtle border border-[var(--color-error)]/30 rounded-lg text-sm text-[var(--color-error)]">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between gap-3 pt-4 border-t border-border-base">
                <Button
                  variant="secondary"
                  onClick={() => setStep('configure')}
                  disabled={restoring}
                  icon={<Icons.ChevronLeft size={16} />}
                >
                  Back
                </Button>
                <Button
                  variant={restoreMode === 'mirror' ? 'danger' : 'primary'}
                  onClick={handleRestore}
                  disabled={restoring}
                  loading={restoring}
                  icon={!restoring ? <Icons.RotateCcw size={16} /> : undefined}
                >
                  {restoreMode === 'mirror' ? 'Mirror Restore' : 'Restore Files'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const RestoreOverlay = memo(RestoreOverlayComponent);
RestoreOverlay.displayName = 'RestoreOverlay';

export default RestoreOverlay;
