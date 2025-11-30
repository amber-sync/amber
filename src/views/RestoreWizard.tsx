import React, { useEffect, useState, useMemo } from 'react';
import { Icons } from '../components/IconComponents';
import { FileBrowser } from '../components/FileBrowser';
import { SyncJob, Snapshot } from '../types';
import { formatBytes } from '../utils/formatters';
import { api } from '../api';
import { logger } from '../utils/logger';

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
    return [...job.snapshots].sort((a, b) => {
      if (sortBy === 'date') {
        return b.timestamp - a.timestamp; // Newest first
      } else {
        return b.sizeBytes - a.sizeBytes; // Largest first
      }
    });
  }, [job.snapshots, sortBy]);

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
    <div className="h-screen flex flex-col bg-[#f5f5f7] dark:bg-[#0f0f10] text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="px-8 py-6 pt-10 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-10 titlebar-drag">
        <div className="flex items-center gap-4 no-drag">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <Icons.ArrowRight className="rotate-180 text-gray-500 dark:text-gray-400" />
          </button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Icons.RotateCcw className="text-blue-500" /> Restore Files
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a snapshot and files to restore
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 no-drag">
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleRestoreFull}
            disabled={isRestoring || !activeSnapshot}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isRestoring || !activeSnapshot
                ? 'text-gray-400 bg-gray-200 dark:bg-gray-800 cursor-not-allowed'
                : 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20'
            }`}
          >
            Restore Full Snapshot
          </button>

          <button
            onClick={handleRestore}
            disabled={selectedFiles.size === 0 || isRestoring}
            className={`px-6 py-2 text-sm font-medium text-white rounded-lg shadow-lg shadow-blue-500/20 transition-all ${
              selectedFiles.size === 0 || isRestoring
                ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed shadow-none'
                : 'bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {isRestoring ? 'Restoring...' : `Restore ${selectedFiles.size} Items`}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Snapshots Timeline */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <span className="font-medium text-sm text-gray-500 dark:text-gray-400">
              Snapshots ({sortedSnapshots.length})
            </span>
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setSortBy('date')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  sortBy === 'date'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
                title="Sort by Date"
              >
                Date
              </button>
              <button
                onClick={() => setSortBy('size')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  sortBy === 'size'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
                title="Sort by Size"
              >
                Size
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
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'
                }`}
              >
                <div
                  className={`p-2 rounded-full ${selectedSnapshotId === snap.id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}
                >
                  <Icons.Clock size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium ${selectedSnapshotId === snap.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-200'}`}
                  >
                    {new Date(snap.timestamp).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                    <span>{snap.fileCount} files</span>
                    <span>•</span>
                    <span>{formatBytes(snap.sizeBytes)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content: File Browser */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900/50 p-6">
          {activeSnapshot && snapshotPath ? (
            <div className="h-full flex flex-col gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg p-3 flex items-start gap-3 text-sm text-blue-800 dark:text-blue-300">
                <Icons.Info size={18} className="shrink-0 mt-0.5" />
                <div>
                  Viewing snapshot from{' '}
                  <strong>{new Date(activeSnapshot.timestamp).toLocaleString()}</strong>. Select
                  files to restore them to the original location.
                </div>
              </div>

              <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <FileBrowser
                  initialPath={snapshotPath}
                  selectable={true}
                  selectedFiles={selectedFiles}
                  onSelectionChange={handleFileSelection}
                  jobId={job.id}
                  snapshotTimestamp={activeSnapshot.timestamp}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a snapshot to view files
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
