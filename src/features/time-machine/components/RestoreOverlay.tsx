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
import { Title, Body, Caption, Code, FormLabel, StatusMessage } from '../../../components/ui';

type RestoreMode = 'merge' | 'mirror';
type RestoreStep = 'configure' | 'confirm';

interface RestoreOverlayProps {
  isOpen: boolean;
  job: SyncJob;
  snapshot: TimeMachineSnapshot | null;
  snapshots: TimeMachineSnapshot[];
  onClose: () => void;
  /** Enable immersive full-screen mode with depth layers */
  immersive?: boolean;
}

function RestoreOverlayComponent({
  isOpen,
  job,
  snapshot,
  snapshots,
  onClose,
  immersive = false,
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

  const overlayClasses = [
    'tm-overlay',
    isOpen && 'tm-overlay--visible',
    immersive && 'tm-overlay--immersive',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={overlayClasses}>
      {/* Backdrop - absolute in immersive mode, flex in standard */}
      <div className={immersive ? 'absolute inset-0 z-0' : 'flex-1'} onClick={onClose} />

      {/* Panel */}
      <div className="tm-overlay-panel" style={immersive ? undefined : { width: '480px' }}>
        {/* Header */}
        <div className="tm-overlay-header">
          <Title level={3} className="tm-overlay-title">
            Restore Files
          </Title>
          <button onClick={onClose} className="tm-overlay-close">
            <Icons.X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="tm-overlay-content">
          {success ? (
            <div className="flex flex-col items-center justify-center text-center py-8">
              <div className="w-16 h-16 rounded-full bg-success-subtle flex items-center justify-center mb-4">
                <Icons.Check size={32} className="text-success" />
              </div>
              <Title level={3} className="mb-2">
                Restore Complete
              </Title>
              <Body size="sm" color="tertiary" className="mb-4">
                Files have been restored to:
              </Body>
              <Code className="px-3 py-1.5 bg-layer-3 rounded-lg mb-6">{targetPath}</Code>
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
                <FormLabel>Snapshot to Restore</FormLabel>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Caption color="tertiary" as="span">
                        Date:
                      </Caption>
                      <Body size="sm" as="span" className="ml-2">
                        {new Date(selectedSnapshot.timestamp).toLocaleDateString()}
                      </Body>
                    </div>
                    <div>
                      <Caption color="tertiary" as="span">
                        Time:
                      </Caption>
                      <Body size="sm" as="span" className="ml-2">
                        {new Date(selectedSnapshot.timestamp).toLocaleTimeString()}
                      </Body>
                    </div>
                    <div>
                      <Caption color="tertiary" as="span">
                        Files:
                      </Caption>
                      <Body size="sm" as="span" className="ml-2">
                        {selectedSnapshot.fileCount?.toLocaleString()}
                      </Body>
                    </div>
                    <div>
                      <Caption color="tertiary" as="span">
                        Size:
                      </Caption>
                      <Body size="sm" as="span" className="ml-2">
                        {formatBytes(selectedSnapshot.sizeBytes ?? 0)}
                      </Body>
                    </div>
                  </div>
                </div>
              )}

              {/* Target Path */}
              <div>
                <FormLabel>Restore To</FormLabel>
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
                <FormLabel className="mb-3">Restore Mode</FormLabel>
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
                      <Body size="sm" weight="medium">
                        Merge (Safe)
                      </Body>
                      <Caption size="sm" color="tertiary" className="mt-0.5">
                        Copy files from snapshot. Updates existing files but keeps any extra files
                        in the destination.
                      </Caption>
                    </div>
                  </label>

                  {/* Mirror Option */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      restoreMode === 'mirror'
                        ? 'bg-error-subtle border-error'
                        : 'bg-layer-2 border-border-base hover:border-border-highlight'
                    }`}
                  >
                    <input
                      type="radio"
                      name="restoreMode"
                      value="mirror"
                      checked={restoreMode === 'mirror'}
                      onChange={() => setRestoreMode('mirror')}
                      className="mt-0.5 accent-error"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Body size="sm" weight="medium" as="span">
                          Mirror (Exact)
                        </Body>
                        <Caption
                          size="sm"
                          className="px-1.5 py-0.5 bg-error-subtle text-error rounded font-semibold uppercase"
                        >
                          DESTRUCTIVE
                        </Caption>
                      </div>
                      <Caption size="sm" color="tertiary" className="mt-0.5">
                        Make destination an exact copy. Files not in the snapshot will be{' '}
                        <strong className="text-error">deleted</strong>.
                      </Caption>
                    </div>
                  </label>
                </div>
              </div>

              {/* Error */}
              {error && (
                <StatusMessage variant="error" size="sm">
                  {error}
                </StatusMessage>
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
                <StatusMessage variant="error" className="flex items-start gap-3 p-4">
                  <Icons.AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <Body size="sm" weight="semibold">
                      Warning: Mirror Mode
                    </Body>
                    <Caption size="sm" color="tertiary" className="mt-1">
                      This will delete any files in the destination that are not in the snapshot.
                      This action cannot be undone.
                    </Caption>
                  </div>
                </StatusMessage>
              )}

              {/* Summary */}
              <div className="p-4 bg-layer-2 border border-border-base rounded-lg space-y-3">
                <Title level={4}>Restore Summary</Title>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Caption color="tertiary" as="span">
                      Snapshot:
                    </Caption>
                    <Body size="sm" as="span">
                      {selectedSnapshot && new Date(selectedSnapshot.timestamp).toLocaleString()}
                    </Body>
                  </div>
                  <div className="flex justify-between">
                    <Caption color="tertiary" as="span">
                      Files:
                    </Caption>
                    <Body size="sm" as="span">
                      {selectedSnapshot?.fileCount?.toLocaleString()}
                    </Body>
                  </div>
                  <div className="flex justify-between">
                    <Caption color="tertiary" as="span">
                      Size:
                    </Caption>
                    <Body size="sm" as="span">
                      {formatBytes(selectedSnapshot?.sizeBytes ?? 0)}
                    </Body>
                  </div>
                  <div className="flex justify-between">
                    <Caption color="tertiary" as="span">
                      Mode:
                    </Caption>
                    <Body
                      size="sm"
                      as="span"
                      weight={restoreMode === 'mirror' ? 'medium' : 'normal'}
                      color={restoreMode === 'mirror' ? 'error' : 'primary'}
                    >
                      {restoreMode === 'merge' ? 'Merge (Safe)' : 'Mirror (Exact)'}
                    </Body>
                  </div>
                  <div className="pt-2 border-t border-border-base">
                    <Caption color="tertiary" as="span">
                      Destination:
                    </Caption>
                    <Code size="sm" className="block mt-1 px-2 py-1 bg-layer-3 rounded break-all">
                      {targetPath}
                    </Code>
                  </div>
                </div>
              </div>

              {/* Progress */}
              {progress && (
                <div className="flex items-center gap-2 px-3 py-2 bg-accent-secondary rounded-lg">
                  <Icons.RefreshCw size={16} className="animate-spin text-accent-primary" />
                  <Body size="sm" className="text-accent-primary">
                    {progress}
                  </Body>
                </div>
              )}

              {/* Error */}
              {error && (
                <StatusMessage variant="error" size="sm">
                  {error}
                </StatusMessage>
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
