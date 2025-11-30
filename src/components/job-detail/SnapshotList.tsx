import React, { useState } from 'react';
import { Icons } from '../IconComponents';
import { SyncJob } from '../../types';
import { formatBytes } from '../../utils/formatters';

export type SnapshotGrouping = 'ALL' | 'DAY' | 'MONTH' | 'YEAR';

interface SnapshotListProps {
  job: SyncJob;
  snapshots: { group: string; label: string | null; snaps: SyncJob['snapshots'] }[];
  snapshotGrouping: SnapshotGrouping;
  onGroupingChange: (grouping: SnapshotGrouping) => void;
  sortBy: 'date' | 'size';
  onSortChange: (sort: 'date' | 'size') => void;
  onOpenSnapshot: (timestamp: number) => void;
  onBrowseSnapshot: (timestamp: number) => void;
}

export const SnapshotList: React.FC<SnapshotListProps> = ({
  snapshots,
  snapshotGrouping,
  onGroupingChange,
  sortBy,
  onSortChange,
  onOpenSnapshot,
  onBrowseSnapshot,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Icons.Clock size={18} className="text-indigo-500" /> Snapshots
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex bg-layer-2 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => onSortChange('date')}
              className={`px-3 py-1.5 rounded-md transition-all ${sortBy === 'date' ? 'bg-white dark:bg-gray-700 shadow text-text-primary' : 'text-text-secondary hover:text-gray-900 dark:hover:text-gray-200'}`}
            >
              Date
            </button>
            <button
              onClick={() => onSortChange('size')}
              className={`px-3 py-1.5 rounded-md transition-all ${sortBy === 'size' ? 'bg-white dark:bg-gray-700 shadow text-text-primary' : 'text-text-secondary hover:text-gray-900 dark:hover:text-gray-200'}`}
            >
              Size
            </button>
          </div>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
          <div className="flex bg-layer-2 p-1 rounded-lg text-xs font-medium">
            {(['ALL', 'DAY', 'MONTH', 'YEAR'] as SnapshotGrouping[]).map(group => (
              <button
                key={group}
                onClick={() => onGroupingChange(group)}
                className={`px-3 py-1.5 rounded-md transition-all ${snapshotGrouping === group ? 'bg-white dark:bg-gray-700 shadow text-text-primary' : 'text-text-secondary hover:text-gray-900 dark:hover:text-gray-200'}`}
              >
                {group.charAt(0) + group.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {snapshots.length === 0 && (
        <div className="w-full h-32 bg-white/80 dark:bg-gray-800/80 border border-border-base rounded-xl flex items-center justify-center text-gray-400 text-sm">
          No snapshots yet. Run a sync to create one.
        </div>
      )}

      {snapshots.map(({ group, label, snaps }) => (
        <SnapshotGroup
          key={group}
          label={label}
          snaps={snaps}
          showHeader={snapshotGrouping !== 'ALL'}
          isCollapsed={collapsedGroups.has(group)}
          onToggle={() => toggleGroup(group)}
          onOpenSnapshot={onOpenSnapshot}
          onBrowseSnapshot={onBrowseSnapshot}
        />
      ))}
    </div>
  );
};

interface SnapshotGroupProps {
  snaps: SyncJob['snapshots'];
  label: string | null;
  showHeader: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  onOpenSnapshot: (timestamp: number) => void;
  onBrowseSnapshot: (timestamp: number) => void;
}

const SnapshotGroup: React.FC<SnapshotGroupProps> = ({
  snaps,
  label,
  showHeader,
  isCollapsed,
  onToggle,
  onOpenSnapshot,
  onBrowseSnapshot,
}) => (
  <div className={showHeader ? 'space-y-2' : ''}>
    {showHeader && (
      <button
        onClick={onToggle}
        className="w-full py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-layer-2 rounded-lg text-xs font-bold text-text-secondary uppercase tracking-wider cursor-pointer select-none flex items-center gap-2 transition-all outline-none border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
      >
        <Icons.ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
        />
        {label}
        <span className="ml-auto text-2xs font-medium bg-gray-200 dark:bg-gray-700 px-2.5 py-1 rounded-full text-text-secondary">
          {snaps.length}
        </span>
      </button>
    )}

    <div
      className={`overflow-hidden transition-all duration-300 ease-out ${
        showHeader && isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
      }`}
    >
      <div
        className={
          showHeader ? 'space-y-2 pl-3 border-l-2 border-border-base ml-2 mt-2' : 'space-y-2'
        }
      >
        {snaps.map(snap => (
          <div
            key={snap.id}
            className="flex items-center justify-between p-4 bg-layer-1 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full text-green-600 dark:text-green-400">
                <Icons.CheckCircle size={14} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  {new Date(snap.timestamp).toLocaleString()}
                  {snap.restored && (
                    <span className="text-2xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-wide">
                      Restored
                    </span>
                  )}
                </p>
                <p className="text-xs text-text-secondary">
                  {snap.fileCount} files • {snap.changesCount} changed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-text-secondary bg-layer-2 px-2 py-1 rounded">
                {formatBytes(snap.sizeBytes)}
              </span>
              <button
                onClick={() => onBrowseSnapshot(snap.timestamp)}
                className="p-2 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                title="Browse Files"
              >
                <Icons.Eye size={16} />
              </button>
              <button
                onClick={() => onOpenSnapshot(snap.timestamp)}
                className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="Open in Finder"
              >
                <Icons.FolderOpen size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
