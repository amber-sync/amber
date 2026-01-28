/**
 * TIM-202: Refactored to use Palette base component
 * TIM-203: Uses Icons from IconComponents
 * TIM-205: Uses specific context hooks for better performance
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useJobs } from '@/features/jobs/context/JobsContext';
import { useUI } from '../context/UIContext';
import { api } from '../api';
import { FILE_TYPE, type FileNode } from '../types';
import { logger } from '../utils/logger';
import { joinPaths } from '../utils/paths';
import { formatBytes, formatRelativeTime } from '../utils';
import { Icons } from './IconComponents';
import { Palette, PaletteSection, PaletteEmpty, type KeyboardHint } from './ui/Palette';

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

// Helper to format mtime (which is in seconds, needs conversion to ms)
function formatMtime(mtimeSeconds: number): string {
  return formatRelativeTime(mtimeSeconds * 1000);
}

interface FileSearchPaletteProps {
  jobId?: string | null;
  snapshotTimestamp?: number | null;
  snapshotPath?: string | null;
}

const KEYBOARD_HINTS: KeyboardHint[] = [
  { keys: ['↑↓'], label: 'Navigate' },
  { keys: ['↵'], label: 'Open' },
  { keys: ['⌘↵'], label: 'Finder' },
  { keys: ['esc'], label: 'Close' },
];

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

  const listRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  const { jobs } = useJobs();
  const { activeJobId, setView, setActiveJobId } = useUI();

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
                    fullPath: effectivePath ? joinPaths(effectivePath, file.name) : file.name,
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
            .slice(0, 3)
            .map(volume =>
              api
                .searchVolume(volume.path, query, 10)
                .then(files =>
                  files.map((file: FileNode) => ({
                    file,
                    scope: 'volume' as const,
                    volumeName: volume.name,
                    fullPath: joinPaths(volume.path, file.name),
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

  // Handle selection
  const handleSelect = useCallback(
    async (result: SearchResult, showInFinder: boolean = false) => {
      setIsOpen(false);

      if (showInFinder) {
        try {
          await api.showItemInFolder(result.fullPath);
        } catch (e) {
          logger.error('Failed to show in Finder', e);
        }
      } else {
        if (result.file.type === FILE_TYPE.DIR) {
          if (result.scope === 'snapshot' && activeJob) {
            setActiveJobId(activeJob.id);
            setView('TIME_MACHINE');
          }
        } else {
          try {
            await api.openPath(result.fullPath);
          } catch (e) {
            logger.error('Failed to open file', e);
          }
        }
      }
    },
    [activeJob, setActiveJobId, setView]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
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
          setActiveScope(prev => {
            if (prev === 'all') return 'snapshot';
            if (prev === 'snapshot') return 'volumes';
            return 'all';
          });
          break;
      }
    },
    [isOpen, allResults, selectedIndex, handleSelect]
  );

  // Global keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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

  const hasSnapshot = activeJob && effectiveTimestamp;
  const hasVolumes = volumes.filter(v => v.isExternal).length > 0;

  // Scope tabs header
  const scopeHeader = (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-border-base bg-layer-2/30">
      <ScopeTab label="All" active={activeScope === 'all'} onClick={() => setActiveScope('all')} />
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
  );

  return (
    <Palette
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      placeholder="Search files..."
      query={query}
      onQueryChange={setQuery}
      isLoading={isLoading}
      size="lg"
      keyboardHints={KEYBOARD_HINTS}
      header={scopeHeader}
      listRef={listRef}
    >
      {/* Empty state when no query */}
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

      {/* No results */}
      {query.trim() && allResults.length === 0 && !isLoading && (
        <PaletteEmpty message={`No files found for "${query}"`} />
      )}

      {/* Snapshot Results */}
      {snapshotResults.length > 0 && (activeScope === 'all' || activeScope === 'snapshot') && (
        <PaletteSection
          title={`Snapshot: ${activeJob?.name}`}
          icon={<Icons.Clock className="w-4 h-4" />}
        >
          {snapshotResults.map((result, idx) => (
            <ResultItem
              key={`snap-${result.file.id}`}
              result={result}
              isSelected={selectedIndex === idx}
              onSelect={() => handleSelect(result, false)}
              onMouseEnter={() => setSelectedIndex(idx)}
            />
          ))}
        </PaletteSection>
      )}

      {/* Volume Results */}
      {volumeResults.length > 0 && (activeScope === 'all' || activeScope === 'volumes') && (
        <PaletteSection title="External Volumes" icon={<Icons.HardDrive className="w-4 h-4" />}>
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
        </PaletteSection>
      )}
    </Palette>
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

const ResultItem: React.FC<{
  result: SearchResult;
  isSelected: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
}> = ({ result, isSelected, onSelect, onMouseEnter }) => {
  const isFolder = result.file.type === FILE_TYPE.DIR;

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
        {isFolder ? <Icons.Folder className="w-4 h-4" /> : <Icons.File className="w-4 h-4" />}
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
            {formatMtime(result.file.modified)}
          </div>
        )}
      </div>
    </button>
  );
};

export default FileSearchPalette;
