import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import type { FileNode } from '../types';

export interface VolumeInfo {
  name: string;
  path: string;
  totalBytes: number;
  freeBytes: number;
  isExternal: boolean;
}

interface SearchResult {
  file: FileNode;
  scope: 'snapshot' | 'volume';
  volumeName?: string;
  fullPath: string;
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Format timestamp to relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp * 1000; // Convert to ms

  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface FileSearchPaletteProps {
  // Optional: pre-select a snapshot to search in
  jobId?: string | null;
  snapshotTimestamp?: number | null;
  snapshotPath?: string | null;
}

export const FileSearchPalette: React.FC<FileSearchPaletteProps> = ({
  jobId,
  snapshotTimestamp,
  snapshotPath,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [snapshotResults, setSnapshotResults] = useState<SearchResult[]>([]);
  const [volumeResults, setVolumeResults] = useState<SearchResult[]>([]);
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [activeScope, setActiveScope] = useState<'all' | 'snapshot' | 'volumes'>('all');

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  const { jobs, activeJobId, setView, setActiveJobId } = useApp();

  // Get active job snapshot info
  const activeJob = useMemo(() => {
    const id = jobId || activeJobId;
    return id ? jobs.find(j => j.id === id) : null;
  }, [jobs, jobId, activeJobId]);

  const latestSnapshot = useMemo(() => {
    if (!activeJob?.snapshots?.length) return null;
    return activeJob.snapshots[activeJob.snapshots.length - 1];
  }, [activeJob]);

  const effectiveTimestamp = snapshotTimestamp || latestSnapshot?.timestamp;
  const effectivePath = snapshotPath || latestSnapshot?.path;

  // Load mounted volumes on open
  useEffect(() => {
    if (isOpen) {
      api
        .listVolumes()
        .then(setVolumes)
        .catch(() => setVolumes([]));
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setSnapshotResults([]);
      setVolumeResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(async () => {
      setIsLoading(true);

      try {
        const promises: Promise<void>[] = [];

        // Search in snapshot (if available)
        if (
          activeJob?.id &&
          effectiveTimestamp &&
          (activeScope === 'all' || activeScope === 'snapshot')
        ) {
          promises.push(
            api
              .searchSnapshotFiles(activeJob.id, effectiveTimestamp, query, 25)
              .then(files => {
                setSnapshotResults(
                  files.map(file => ({
                    file,
                    scope: 'snapshot',
                    fullPath: effectivePath ? `${effectivePath}/${file.name}` : file.name,
                  }))
                );
              })
              .catch(() => setSnapshotResults([]))
          );
        }

        // Search in volumes
        if (volumes.length > 0 && (activeScope === 'all' || activeScope === 'volumes')) {
          const volumeSearches = volumes
            .filter(v => v.isExternal)
            .slice(0, 3) // Limit to 3 volumes for performance
            .map(volume =>
              api
                .searchVolume(volume.path, query, 10)
                .then(files =>
                  files.map((file: FileNode) => ({
                    file,
                    scope: 'volume' as const,
                    volumeName: volume.name,
                    fullPath: `${volume.path}/${file.name}`,
                  }))
                )
                .catch(() => [] as SearchResult[])
            );

          if (volumeSearches.length > 0) {
            promises.push(
              Promise.all(volumeSearches).then(results => {
                setVolumeResults(results.flat());
              })
            );
          }
        }

        await Promise.all(promises);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, isOpen, activeJob, effectiveTimestamp, effectivePath, volumes, activeScope]);

  // Combined and filtered results
  const allResults = useMemo(() => {
    const results: SearchResult[] = [];

    if (activeScope === 'all' || activeScope === 'snapshot') {
      results.push(...snapshotResults);
    }
    if (activeScope === 'all' || activeScope === 'volumes') {
      results.push(...volumeResults);
    }

    return results.slice(0, 50);
  }, [snapshotResults, volumeResults, activeScope]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Open palette with Cmd+P
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setQuery('');
        setSelectedIndex(0);
        setSnapshotResults([]);
        setVolumeResults([]);
        return;
      }

      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (allResults[selectedIndex]) {
            handleSelect(allResults[selectedIndex], e.metaKey);
          }
          break;
        case 'Tab':
          e.preventDefault();
          // Cycle through scopes
          setActiveScope(prev => {
            if (prev === 'all') return 'snapshot';
            if (prev === 'snapshot') return 'volumes';
            return 'all';
          });
          break;
      }
    },
    [isOpen, allResults, selectedIndex]
  );

  // Handle selection
  const handleSelect = useCallback(
    async (result: SearchResult, showInFinder: boolean = false) => {
      setIsOpen(false);

      if (showInFinder) {
        // Cmd+Enter: Show in Finder
        try {
          await api.showItemInFolder(result.fullPath);
        } catch (e) {
          console.error('Failed to show in Finder:', e);
        }
      } else {
        // Enter: Open file or navigate
        if (result.file.type === 'FOLDER') {
          // For folders in snapshots, navigate to them in the file browser
          if (result.scope === 'snapshot' && activeJob) {
            setActiveJobId(activeJob.id);
            setView('DETAIL');
            // Note: The FileBrowser would need to support path navigation
          }
        } else {
          // Open file in default app
          try {
            await api.openPath(result.fullPath);
          } catch (e) {
            console.error('Failed to open file:', e);
          }
        }
      }
    },
    [activeJob, setActiveJobId, setView]
  );

  // Global keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allResults.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const hasSnapshot = activeJob && effectiveTimestamp;
  const hasVolumes = volumes.filter(v => v.isExternal).length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-modal-backdrop animate-fade-in"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div className="fixed inset-0 z-modal flex items-start justify-center pt-[12vh]">
        <div className="w-full max-w-2xl bg-layer-1 rounded-xl shadow-2xl border border-border-base overflow-hidden animate-scale-in">
          {/* Search Input */}
          <div className="flex items-center px-4 border-b border-border-base">
            <SearchIcon className="w-5 h-5 text-text-tertiary flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search files..."
              className="flex-1 px-3 py-4 bg-transparent text-text-primary placeholder-text-tertiary focus:outline-none text-base"
            />
            {isLoading && (
              <div className="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
            )}
            <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-layer-2 text-text-tertiary text-xs font-mono ml-2">
              ESC
            </kbd>
          </div>

          {/* Scope Tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border-base bg-layer-2/30">
            <ScopeTab
              label="All"
              active={activeScope === 'all'}
              onClick={() => setActiveScope('all')}
            />
            {hasSnapshot && (
              <ScopeTab
                label="Snapshot"
                badge={snapshotResults.length > 0 ? snapshotResults.length.toString() : undefined}
                active={activeScope === 'snapshot'}
                onClick={() => setActiveScope('snapshot')}
              />
            )}
            {hasVolumes && (
              <ScopeTab
                label="Volumes"
                badge={volumeResults.length > 0 ? volumeResults.length.toString() : undefined}
                active={activeScope === 'volumes'}
                onClick={() => setActiveScope('volumes')}
              />
            )}
            <span className="ml-auto text-xs text-text-tertiary">
              Press <kbd className="px-1 py-0.5 rounded bg-layer-3 font-mono">Tab</kbd> to switch
            </span>
          </div>

          {/* Results List */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
            {!query.trim() && (
              <div className="px-4 py-8 text-center text-text-tertiary">
                <p className="text-sm">Type to search files</p>
                {hasSnapshot && (
                  <p className="text-xs mt-2 text-text-quaternary">
                    Searching in: {activeJob?.name} snapshot
                  </p>
                )}
                {hasVolumes && (
                  <p className="text-xs mt-1 text-text-quaternary">
                    {volumes.filter(v => v.isExternal).length} external volume(s) available
                  </p>
                )}
              </div>
            )}

            {query.trim() && allResults.length === 0 && !isLoading && (
              <div className="px-4 py-8 text-center text-text-tertiary">
                No files found for "{query}"
              </div>
            )}

            {/* Snapshot Results */}
            {snapshotResults.length > 0 &&
              (activeScope === 'all' || activeScope === 'snapshot') && (
                <ResultSection title={`Snapshot: ${activeJob?.name}`} icon={<SnapshotIcon />}>
                  {snapshotResults.map((result, idx) => {
                    const globalIndex = idx;
                    return (
                      <ResultItem
                        key={`snap-${result.file.id}`}
                        result={result}
                        isSelected={selectedIndex === globalIndex}
                        onSelect={() => handleSelect(result, false)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      />
                    );
                  })}
                </ResultSection>
              )}

            {/* Volume Results */}
            {volumeResults.length > 0 && (activeScope === 'all' || activeScope === 'volumes') && (
              <ResultSection title="External Volumes" icon={<VolumeIcon />}>
                {volumeResults.map((result, idx) => {
                  const globalIndex = snapshotResults.length + idx;
                  return (
                    <ResultItem
                      key={`vol-${result.file.id}-${idx}`}
                      result={result}
                      isSelected={selectedIndex === globalIndex}
                      onSelect={() => handleSelect(result, false)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    />
                  );
                })}
              </ResultSection>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border-base bg-layer-2/50 flex items-center gap-4 text-xs text-text-tertiary">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-layer-3 font-mono">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-layer-3 font-mono">↵</kbd>
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-layer-3 font-mono">⌘↵</kbd>
              Finder
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-layer-3 font-mono">esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

// Sub-components

const ScopeTab: React.FC<{
  label: string;
  badge?: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, badge, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
      active ? 'bg-accent-primary/20 text-accent-primary' : 'text-text-secondary hover:bg-layer-2'
    }`}
  >
    {label}
    {badge && (
      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-layer-3 text-[10px]">{badge}</span>
    )}
  </button>
);

const ResultSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div>
    <div className="px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider bg-layer-2/50 flex items-center gap-2">
      <span className="w-4 h-4 text-text-quaternary">{icon}</span>
      {title}
    </div>
    {children}
  </div>
);

const ResultItem: React.FC<{
  result: SearchResult;
  isSelected: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
}> = ({ result, isSelected, onSelect, onMouseEnter }) => {
  const isFolder = result.file.type === 'FOLDER';

  return (
    <button
      data-selected={isSelected}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isSelected ? 'bg-accent-secondary/30' : 'hover:bg-layer-2'
      }`}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-text-secondary">
        {isFolder ? <FolderIcon /> : <FileIcon />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">{result.file.name}</div>
        <div className="text-xs text-text-tertiary truncate">
          {result.volumeName && <span className="text-accent-primary">{result.volumeName}</span>}
          {result.volumeName && ' · '}
          {result.fullPath}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-xs text-text-tertiary">{formatBytes(result.file.size)}</div>
        {result.file.modified > 0 && (
          <div className="text-[10px] text-text-quaternary">
            {formatRelativeTime(result.file.modified)}
          </div>
        )}
      </div>
    </button>
  );
};

// Icons
const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const FileIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
    />
  </svg>
);

const FolderIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
    />
  </svg>
);

const SnapshotIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const VolumeIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z"
    />
  </svg>
);

export default FileSearchPalette;
