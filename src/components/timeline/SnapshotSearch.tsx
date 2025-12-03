import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Icons } from '../IconComponents';
import { api } from '../../api';
import { TimelineSnapshot } from '../../hooks/useTimeline';
import { formatBytes } from '../../utils/formatters';
import { format } from 'date-fns';
import type { GlobalSearchResult } from '../../types';

interface SearchResult {
  file: GlobalSearchResult['file'];
  jobId: string;
  jobName: string;
  snapshotTimestamp: number;
  rank: number;
}

interface SnapshotSearchProps {
  snapshots: TimelineSnapshot[];
  onSelectSnapshot: (snapshot: TimelineSnapshot) => void;
}

export const SnapshotSearch: React.FC<SnapshotSearchProps> = ({ snapshots, onSelectSnapshot }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchTime, setSearchTime] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  // Build a map from jobId+timestamp to snapshot for quick lookup
  const snapshotMap = useRef<Map<string, TimelineSnapshot>>(new Map());
  useEffect(() => {
    const map = new Map<string, TimelineSnapshot>();
    snapshots.forEach(s => {
      if (s.timestamp) {
        map.set(`${s.jobId}-${s.timestamp}`, s);
      }
    });
    snapshotMap.current = map;
  }, [snapshots]);

  // Build job name map
  const jobNameMap = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const map = new Map<string, string>();
    snapshots.forEach(s => {
      if (s.jobName && !map.has(s.jobId)) {
        map.set(s.jobId, s.jobName);
      }
    });
    jobNameMap.current = map;
  }, [snapshots]);

  // Debounced search using FTS5 global search (blazing fast!)
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setSearchTime(null);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(async () => {
      setIsLoading(true);
      const startTime = performance.now();

      try {
        // Single FTS5 query across ALL snapshots - sub-millisecond!
        const globalResults = await api.searchFilesGlobal(query, undefined, 30);

        const mappedResults: SearchResult[] = globalResults.map(r => ({
          file: r.file,
          jobId: r.job_id,
          jobName: r.job_name || jobNameMap.current.get(r.job_id) || r.job_id,
          snapshotTimestamp: r.snapshot_timestamp,
          rank: r.rank,
        }));

        // Results are already sorted by relevance (rank) from FTS5
        setResults(mappedResults);
        setSelectedIndex(0);
        setSearchTime(performance.now() - startTime);
      } catch (err) {
        console.error('FTS search failed:', err);
        setResults([]);
        setSearchTime(null);
      } finally {
        setIsLoading(false);
      }
    }, 100); // Reduced debounce since FTS5 is so fast

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  // Handle result selection
  const handleSelect = useCallback(
    (result: SearchResult) => {
      // Find the matching snapshot
      const key = `${result.jobId}-${result.snapshotTimestamp}`;
      const snapshot = snapshotMap.current.get(key);

      if (snapshot) {
        onSelectSnapshot(snapshot);
      } else {
        // Create a minimal snapshot object if not found in the map
        onSelectSnapshot({
          id: `${result.jobId}-${result.snapshotTimestamp}`,
          jobId: result.jobId,
          jobName: result.jobName,
          timestamp: result.snapshotTimestamp,
        } as TimelineSnapshot);
      }

      setIsExpanded(false);
      setQuery('');
      setResults([]);
    },
    [onSelectSnapshot]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isExpanded || results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsExpanded(false);
          setQuery('');
          setResults([]);
          inputRef.current?.blur();
          break;
      }
    },
    [isExpanded, results, selectedIndex, handleSelect]
  );

  // Scroll selected into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selected = resultsRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, results.length]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const hasResults = results.length > 0;
  const showDropdown = isExpanded && (hasResults || isLoading || (query.length >= 2 && !isLoading));

  return (
    <div className="relative">
      {/* Search Input */}
      <div
        className={`bg-layer-1 rounded-2xl border transition-all ${
          isExpanded ? 'border-accent-primary shadow-lg' : 'border-border-base'
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Icons.Search
            size={18}
            className={isExpanded ? 'text-accent-primary' : 'text-text-tertiary'}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setIsExpanded(true);
            }}
            onFocus={() => setIsExpanded(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search files across all snapshots (FTS5)..."
            className="flex-1 bg-transparent text-text-primary placeholder-text-tertiary outline-none text-sm"
          />
          {isLoading && (
            <div className="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
          )}
          {query && !isLoading && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
                inputRef.current?.focus();
              }}
              className="p-1 hover:bg-layer-2 rounded-lg text-text-tertiary"
            >
              <Icons.X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Results Dropdown */}
      {showDropdown && (
        <div
          ref={resultsRef}
          className="absolute top-full left-0 right-0 mt-2 bg-layer-1 rounded-xl border border-border-base shadow-xl overflow-hidden z-20 animate-scale-in origin-top"
        >
          {/* Results List */}
          {hasResults && (
            <div className="max-h-[300px] overflow-y-auto">
              {results.map((result, index) => (
                <button
                  key={`${result.jobId}-${result.snapshotTimestamp}-${result.file.path}-${index}`}
                  data-selected={selectedIndex === index}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 animate-fade-in ${
                    selectedIndex === index ? 'bg-accent-primary/10' : 'hover:bg-layer-2'
                  }`}
                  style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'backwards' }}
                >
                  {/* File Icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                      selectedIndex === index ? 'bg-accent-primary/20 scale-110' : 'bg-layer-2'
                    }`}
                  >
                    {result.file.type === 'dir' ? (
                      <Icons.Folder size={16} className="text-amber-500" />
                    ) : (
                      <Icons.File
                        size={16}
                        className={
                          selectedIndex === index ? 'text-accent-primary' : 'text-text-tertiary'
                        }
                      />
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {result.file.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-tertiary truncate">
                      <span className="text-accent-primary font-medium">{result.jobName}</span>
                      <span>·</span>
                      <span>{format(new Date(result.snapshotTimestamp), 'MMM d, yyyy')}</span>
                    </div>
                  </div>

                  {/* Size */}
                  <div className="text-xs text-text-tertiary flex-shrink-0 tabular-nums">
                    {formatBytes(result.file.size)}
                  </div>

                  {/* Arrow */}
                  <Icons.ChevronRight
                    size={14}
                    className={`flex-shrink-0 transition-transform duration-200 ${
                      selectedIndex === index
                        ? 'text-accent-primary translate-x-1'
                        : 'text-text-quaternary'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Loading State */}
          {isLoading && !hasResults && (
            <div className="px-4 py-8 text-center text-text-tertiary animate-fade-in">
              <div className="relative w-8 h-8 mx-auto mb-3">
                <div className="absolute inset-0 border-2 border-accent-primary/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm font-medium text-text-secondary">Searching with FTS5...</p>
              <p className="text-xs mt-1 text-text-tertiary">Instant full-text search</p>
            </div>
          )}

          {/* No Results */}
          {!isLoading && !hasResults && query.length >= 2 && (
            <div className="px-4 py-8 text-center text-text-tertiary animate-fade-in">
              <div className="w-12 h-12 rounded-xl bg-layer-2 flex items-center justify-center mx-auto mb-3">
                <Icons.Search size={20} className="text-text-quaternary" />
              </div>
              <p className="text-sm font-medium text-text-secondary">No files found</p>
              <p className="text-xs mt-1">
                No matches for "<span className="text-text-primary">{query}</span>"
              </p>
            </div>
          )}

          {/* Hint */}
          {query.length < 2 && !isLoading && (
            <div className="px-4 py-6 text-center text-text-tertiary animate-fade-in">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Icons.Search size={14} className="text-text-quaternary" />
                <span className="text-sm">Type at least 2 characters to search</span>
              </div>
              <p className="text-xs">Instant FTS5 search across all indexed snapshots</p>
            </div>
          )}

          {/* Footer */}
          {hasResults && (
            <div className="px-4 py-2 border-t border-border-base bg-layer-2/50 flex items-center gap-4 text-[10px] text-text-tertiary">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-layer-3 font-mono">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-layer-3 font-mono">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-layer-3 font-mono">esc</kbd>
                Close
              </span>
              <span className="ml-auto flex items-center gap-2">
                <span>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </span>
                {searchTime !== null && (
                  <span className="text-green-500 font-medium">
                    {searchTime < 1 ? '<1' : Math.round(searchTime)}ms
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
