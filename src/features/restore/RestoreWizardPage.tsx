import React, { useEffect, useState, useMemo } from 'react';
import { Icons } from '../../components/IconComponents';
import { FileBrowser } from '../../components/shared/FileBrowser';
import { Title, Body, Caption, StatusMessage } from '../../components/ui';
import { SyncJob, Snapshot } from '../../types';
import { formatBytes } from '../../utils/formatters';
import { api } from '../../api';
import { logger } from '../../utils/logger';

interface RestoreWizardProps {
  job: SyncJob;
  onBack: () => void;
  onRestore: (files: string[], targetPath: string, snapshot: Snapshot) => Promise<void>;
}

export const RestoreWizard: React.FC<RestoreWizardProps> = ({ job, onBack, onRestore }) => {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [restoreTarget, setRestoreTarget] = useState<string>(job.sourcePath); // Default to original source
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'size'>('date');

  // Sort snapshots
  const sortedSnapshots = useMemo(() => {
    return [...(job.snapshots ?? [])].sort((a, b) => {
      if (sortBy === 'date') {
        return b.timestamp - a.timestamp; // Newest first
      } else {
        return b.sizeBytes - a.sizeBytes; // Largest first
      }
    });
  }, [job.snapshots ?? [], sortBy]);

  // Select latest snapshot by default
  useEffect(() => {
    if (sortedSnapshots.length > 0 && !selectedSnapshotId) {
      setSelectedSnapshotId(sortedSnapshots[0].id);
    }
  }, [sortedSnapshots, selectedSnapshotId]);

  const activeSnapshot = useMemo(
    () => sortedSnapshots.find(s => s.id === selectedSnapshotId),
    [sortedSnapshots, selectedSnapshotId]
  );

  const handleSnapshotSelect = (id: string) => {
    setSelectedSnapshotId(id);
    setSelectedFiles(new Set()); // Clear selection on snapshot change
  };

  const handleFileSelection = (path: string, selected: boolean) => {
    const newSelection = new Set(selectedFiles);
    if (selected) {
      newSelection.add(path);
    } else {
      newSelection.delete(path);
    }
    setSelectedFiles(newSelection);
  };

  const handleRestore = async () => {
    if (!activeSnapshot) return;
    setIsRestoring(true);

    try {
      // For now, restore to a 'Restored' folder on Desktop
      // In real app, we might ask user for location or restore in-place
      const desktop = await api.getDesktopPath().catch(() => '/tmp');
      const targetPath = `${desktop}/Restored-${activeSnapshot.id}`;

      await onRestore(Array.from(selectedFiles), targetPath, activeSnapshot);
      alert(`Successfully restored ${selectedFiles.size} files to ${targetPath}`);
      onBack();
    } catch (err) {
      logger.error('Restore error', err);
      alert('Failed to restore files');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestoreFull = async () => {
    if (!activeSnapshot) return;
    if (
      !confirm(
        'Are you sure you want to restore the ENTIRE snapshot? This will copy all files to a "Restored" folder.'
      )
    )
      return;

    setIsRestoring(true);

    try {
      const desktop = await api.getDesktopPath().catch(() => '/tmp');
      const targetPath = `${desktop}/Restored-Full-${activeSnapshot.id}`;

      const result = await api.restoreSnapshot(
        job,
        snapshotPath, // Use snapshotPath as the source for the full snapshot
        targetPath
      );

      if (result.success) {
        alert(`Successfully restored full snapshot to ${targetPath}`);
        onBack();
      } else {
        alert(`Restore failed: ${result.error}`);
      }
    } catch (err) {
      logger.error('Restore error', err);
      alert('Failed to restore snapshot');
    } finally {
      setIsRestoring(false);
    }
  };

  const snapshotPath = useMemo(() => {
    if (!activeSnapshot) return '';
    if (activeSnapshot.path) return activeSnapshot.path;

    // Fallback for legacy snapshots or if path is missing
    const date = new Date(activeSnapshot.timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    const folderName = `${y}-${m}-${d}-${h}${min}${s}`;

    // Assuming Time Machine structure for snapshots
    return `${job.destPath}/${folderName}`;
  }, [activeSnapshot, job.destPath]);

  return (
    <div className="h-full flex flex-col bg-app text-text-primary">
      {/* Header */}
      <div className="px-8 py-6 pt-10 border-b border-border-base flex justify-between items-center bg-layer-1/95 backdrop-blur-sm z-10 titlebar-drag">
        <div className="flex items-center gap-4 no-drag">
          <button onClick={onBack} className="p-2 hover:bg-layer-2 rounded-full transition-colors">
            <Icons.ArrowRight className="rotate-180 text-text-tertiary" />
          </button>
          <div>
            <Title level={2} className="flex items-center gap-2">
              <Icons.RotateCcw className="text-[var(--color-info)]" /> Restore Files
            </Title>
            <Body size="sm" color="secondary">
              Select a snapshot and files to restore
            </Body>
          </div>
        </div>
        <div className="flex items-center gap-3 no-drag">
          <button
            onClick={onBack}
            className="px-4 py-2 hover:bg-layer-2 rounded-lg transition-colors"
          >
            <Body size="sm" weight="medium" color="secondary" className="hover:text-text-primary">
              Cancel
            </Body>
          </button>

          <button
            onClick={handleRestoreFull}
            disabled={isRestoring || !activeSnapshot}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isRestoring || !activeSnapshot
                ? 'bg-layer-2 cursor-not-allowed'
                : 'hover:bg-[var(--color-info-subtle)]'
            }`}
          >
            <Body
              size="sm"
              weight="medium"
              color={isRestoring || !activeSnapshot ? 'tertiary' : undefined}
              className={isRestoring || !activeSnapshot ? '' : 'text-[var(--color-info)]'}
            >
              Restore Full Snapshot
            </Body>
          </button>

          <button
            onClick={handleRestore}
            disabled={selectedFiles.size === 0 || isRestoring}
            className={`px-6 py-2 rounded-lg shadow-lg shadow-[var(--color-info)]/20 transition-all ${
              selectedFiles.size === 0 || isRestoring
                ? 'bg-layer-2 cursor-not-allowed shadow-none'
                : 'bg-[var(--color-info)] hover:bg-[var(--color-info)]/90 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <Body
              size="sm"
              weight="medium"
              className={
                selectedFiles.size === 0 || isRestoring ? 'text-text-tertiary' : 'text-white'
              }
            >
              {isRestoring ? 'Restoring...' : `Restore ${selectedFiles.size} Items`}
            </Body>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Snapshots Timeline */}
        <div className="w-80 bg-layer-1 border-r border-border-base flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border-base flex justify-between items-center">
            <Body size="sm" weight="medium" color="secondary">
              Snapshots ({sortedSnapshots.length})
            </Body>
            <div className="flex bg-layer-2 rounded-lg p-0.5">
              <button
                onClick={() => setSortBy('date')}
                className={`px-2 py-1 rounded-md transition-all ${
                  sortBy === 'date' ? 'bg-layer-1 shadow-sm' : 'hover:text-text-primary'
                }`}
                title="Sort by Date"
              >
                <Caption
                  color={sortBy === 'date' ? undefined : 'secondary'}
                  className={`font-weight-medium ${sortBy === 'date' ? 'text-[var(--color-info)]' : ''}`}
                >
                  Date
                </Caption>
              </button>
              <button
                onClick={() => setSortBy('size')}
                className={`px-2 py-1 rounded-md transition-all ${
                  sortBy === 'size' ? 'bg-layer-1 shadow-sm' : 'hover:text-text-primary'
                }`}
                title="Sort by Size"
              >
                <Caption
                  color={sortBy === 'size' ? undefined : 'secondary'}
                  className={`font-weight-medium ${sortBy === 'size' ? 'text-[var(--color-info)]' : ''}`}
                >
                  Size
                </Caption>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sortedSnapshots.map(snap => (
              <div
                key={snap.id}
                onClick={() => handleSnapshotSelect(snap.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${
                  selectedSnapshotId === snap.id
                    ? 'bg-[var(--color-info-subtle)] border border-[var(--color-info)]/30'
                    : 'hover:bg-layer-2 border border-transparent'
                }`}
              >
                <div
                  className={`p-2 rounded-full ${selectedSnapshotId === snap.id ? 'bg-[var(--color-info-subtle)] text-[var(--color-info)]' : 'bg-layer-2 text-text-tertiary'}`}
                >
                  <Icons.Clock size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <Body
                    size="sm"
                    weight="medium"
                    color={selectedSnapshotId === snap.id ? undefined : 'primary'}
                    className={selectedSnapshotId === snap.id ? 'text-[var(--color-info)]' : ''}
                  >
                    {new Date(snap.timestamp).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Body>
                  <Caption color="secondary" className="flex gap-2">
                    <span>{snap.fileCount} files</span>
                    <span>•</span>
                    <span>{formatBytes(snap.sizeBytes)}</span>
                  </Caption>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content: File Browser */}
        <div className="flex-1 flex flex-col overflow-hidden bg-layer-2 p-6">
          {activeSnapshot && snapshotPath ? (
            <div className="h-full flex flex-col gap-4">
              <StatusMessage variant="info">
                Viewing snapshot from{' '}
                <strong>{new Date(activeSnapshot.timestamp).toLocaleString()}</strong>. Select files
                to restore them to the original location.
              </StatusMessage>

              <div className="flex-1 bg-layer-1 rounded-xl border border-border-base shadow-sm overflow-hidden">
                <FileBrowser
                  initialPath={snapshotPath}
                  selectable={true}
                  selectedFiles={selectedFiles}
                  onSelectionChange={handleFileSelection}
                  jobId={job.id}
                  snapshotTimestamp={activeSnapshot.timestamp}
                  destPath={job.destPath}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Body color="tertiary">Select a snapshot to view files</Body>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
