import React, { useState, useEffect, useCallback, useRef } from 'react';
import { List } from 'react-window';
import { Icons } from './IconComponents';
import { formatBytes } from '../utils/formatters';
import { FilePreview } from './FilePreview';
import { api } from '../api';
import { logger } from '../utils/logger';
import { isDirectory } from '../types';

const ROW_HEIGHT = 40;

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

interface FileBrowserProps {
  initialPath: string;
  selectable?: boolean;
  selectedFiles?: Set<string>;
  onSelectionChange?: (path: string, selected: boolean) => void;
  // TIM-46: Optional props for indexed snapshot browsing
  jobId?: string;
  snapshotTimestamp?: number;
  // TIM-127: Destination path for destination-based index
  destPath?: string;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  initialPath,
  selectable = false,
  selectedFiles = new Set(),
  onSelectionChange,
  jobId,
  snapshotTimestamp,
  destPath,
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<FileEntry | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  // TIM-46: Indexed browsing state
  const [isIndexed, setIsIndexed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Container height for scrollable list
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);

  // Measure container height for scrollable list
  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setListHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    // Initial measurement
    setListHeight(container.clientHeight);

    return () => resizeObserver.disconnect();
  }, []);

  // Check if snapshot is indexed (TIM-127: use destination-based index)
  useEffect(() => {
    if (destPath && jobId && snapshotTimestamp) {
      api
        .isIndexedOnDestination(destPath, jobId, snapshotTimestamp)
        .then(indexed => {
          setIsIndexed(indexed);
          if (indexed) {
            logger.debug('Using destination-based indexed snapshot queries', {
              destPath,
              snapshotTimestamp,
            });
          }
        })
        .catch(() => setIsIndexed(false));
    } else {
      setIsIndexed(false);
    }
  }, [destPath, jobId, snapshotTimestamp]);

  // Load directory contents (TIM-127: use destination-based index)
  const loadDirectory = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      setSearchResults(null);
      setSearchQuery('');

      try {
        let formatted: FileEntry[];

        if (isIndexed && destPath && jobId && snapshotTimestamp) {
          // TIM-127: Use fast SQLite query from destination index
          // Convert current absolute path to relative path for SQLite query
          const relativePath = path === initialPath ? '' : path.replace(initialPath + '/', '');
          const result = await api.getDirectoryFromDestination(
            destPath,
            jobId,
            snapshotTimestamp,
            relativePath
          );

          formatted = result.map((item: any) => ({
            name: item.name,
            // SQLite stores RELATIVE paths (e.g., "Projects/webapp")
            // Convert to absolute path for navigation by prepending initialPath
            path: `${initialPath}/${item.path}`,
            // Use centralized isDirectory() from types.ts - matches Rust file_type module
            isDirectory: isDirectory(item.type),
            size: item.size,
            modified: new Date(item.modified),
          }));
        } else {
          // Fallback to filesystem read
          const result = await api.readDir(path);
          formatted = result.map((item: any) => ({
            name: item.name,
            path: item.path,
            isDirectory: item.isDirectory,
            size: item.size,
            modified: new Date(item.modified),
          }));
        }

        // Sort: Folders first, then files
        formatted.sort((a, b) => {
          if (a.isDirectory === b.isDirectory) {
            return a.name.localeCompare(b.name);
          }
          return a.isDirectory ? -1 : 1;
        });

        setEntries(formatted);
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    },
    [isIndexed, destPath, jobId, snapshotTimestamp, initialPath]
  );

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  // Reset to initial path if it changes (e.g. snapshot switch)
  useEffect(() => {
    setCurrentPath(initialPath);
    setSelectedFileForPreview(null);
    setSearchQuery('');
    setSearchResults(null);
  }, [initialPath]);

  // TIM-127: Search functionality (destination-based)
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);

      if (!query.trim()) {
        setSearchResults(null);
        return;
      }

      if (!isIndexed || !destPath || !jobId || !snapshotTimestamp) {
        // Search not available without index
        return;
      }

      setIsSearching(true);
      try {
        const results = await api.searchFilesOnDestination(
          destPath,
          jobId,
          snapshotTimestamp,
          query,
          100
        );
        const formatted: FileEntry[] = results.map((item: any) => ({
          name: item.name,
          // SQLite stores RELATIVE paths - convert to absolute for navigation
          path: `${initialPath}/${item.path}`,
          // Use centralized isDirectory() from types.ts - matches Rust file_type module
          isDirectory: isDirectory(item.type),
          size: item.size,
          modified: new Date(item.modified),
        }));
        setSearchResults(formatted);
      } catch (err) {
        logger.error('Search failed', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [isIndexed, destPath, jobId, snapshotTimestamp, initialPath]
  );

  const handleNavigateUp = () => {
    if (currentPath === initialPath) return;
    const parent = currentPath.split('/').slice(0, -1).join('/');
    setCurrentPath(parent);
  };

  const handleEntryClick = useCallback((entry: FileEntry) => {
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
      setSelectedFileForPreview(null);
      setSearchResults(null);
      setSearchQuery('');
    } else {
      setSelectedFileForPreview(entry);
    }
  }, []);

  const toggleSelection = useCallback((e: React.MouseEvent | null, path: string) => {
    e?.stopPropagation();
    if (onSelectionChange) {
      onSelectionChange(path, !selectedFiles.has(path));
    }
  }, [onSelectionChange, selectedFiles]);

  // Breadcrumbs
  const relativePath = currentPath.replace(initialPath, '');
  const parts = relativePath.split('/').filter(Boolean);

  // Determine which entries to display (virtualization handles large lists)
  const displayEntries = searchResults !== null ? searchResults : entries;

  // Memoized row component for virtualization performance
  const FileRow = useCallback(
    ({
      ariaAttributes,
      index,
      style,
    }: {
      ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
      index: number;
      style: React.CSSProperties;
    }) => {
      const entry = displayEntries[index];
      const isSelected = selectedFiles.has(entry.path);
      const isPreviewSelected = selectedFileForPreview?.path === entry.path;

      return (
        <div
          {...ariaAttributes}
          style={style}
          onClick={() => handleEntryClick(entry)}
          className={`grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 items-center hover:bg-layer-2 cursor-pointer border-b border-border-base transition-colors ${
            isPreviewSelected ? 'bg-[var(--color-info-subtle)]' : ''
          }`}
        >
          {/* Checkbox */}
          <div className="flex items-center">
            {selectable && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelection(null, entry.path)}
                onClick={e => e.stopPropagation()}
                className="w-4 h-4 rounded border-border-base"
              />
            )}
          </div>

          {/* Name */}
          <div className="flex items-center gap-2 min-w-0">
            {entry.isDirectory ? (
              <Icons.Folder size={16} className="text-[var(--color-info)] flex-shrink-0" />
            ) : (
              <Icons.File size={16} className="text-text-tertiary flex-shrink-0" />
            )}
            <span className="truncate text-text-secondary">{entry.name}</span>
          </div>

          {/* Size */}
          <div className="text-right text-text-tertiary tabular-nums text-sm">
            {!entry.isDirectory && formatBytes(entry.size)}
          </div>

          {/* Modified */}
          <div className="text-right text-text-tertiary tabular-nums text-xs">
            {entry.modified.toLocaleDateString()}
          </div>
        </div>
      );
    },
    [displayEntries, selectedFiles, selectedFileForPreview, selectable, handleEntryClick, toggleSelection]
  );

  return (
    <div className="flex h-full bg-layer-1">
      {/* File Browser Panel */}
      <div
        className={`flex flex-col ${showPreview && selectedFileForPreview ? 'w-1/2' : 'w-full'} transition-all duration-200`}
      >
        {/* Toolbar / Breadcrumbs */}
        <div className="flex items-center gap-2 p-3 border-b border-border-base bg-layer-2/50">
          <button
            onClick={handleNavigateUp}
            disabled={currentPath === initialPath || searchResults !== null}
            className="p-1.5 rounded-md hover:bg-layer-3 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Icons.ArrowRight className="rotate-180 w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 text-text-secondary overflow-hidden flex-1">
            {searchResults !== null ? (
              <span className="flex items-center gap-2">
                <Icons.Search size={14} />
                Search results for "{searchQuery}"
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                  }}
                  className="ml-2 text-xs text-[var(--color-info)] hover:text-[var(--color-info)]"
                >
                  Clear
                </button>
              </span>
            ) : (
              <>
                <span
                  className="cursor-pointer hover:text-[var(--color-info)] transition-colors flex items-center gap-1"
                  onClick={() => setCurrentPath(initialPath)}
                >
                  <Icons.HardDrive size={14} />
                  Root
                </span>
                {parts.map((part, i) => {
                  const pathSoFar = initialPath + '/' + parts.slice(0, i + 1).join('/');
                  return (
                    <React.Fragment key={pathSoFar}>
                      <span className="text-text-quaternary">/</span>
                      <span
                        className="cursor-pointer hover:text-[var(--color-info)] transition-colors truncate max-w-[150px]"
                        onClick={() => setCurrentPath(pathSoFar)}
                      >
                        {part}
                      </span>
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </div>

          {/* TIM-46: Search Input (only when indexed) */}
          {isIndexed && (
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search files..."
                className="w-48 px-3 py-1.5 pl-8 text-sm rounded-md border border-border-base bg-layer-1 focus:outline-none focus:ring-2 focus:ring-accent-primary text-text-primary"
              />
              <Icons.Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
              />
              {isSearching && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <div className="w-3 h-3 border-2 border-[var(--color-info)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* Indexed indicator */}
          {isIndexed && (
            <div className="px-2 py-0.5 text-xs bg-[var(--color-success-subtle)] text-[var(--color-success)] rounded-full flex items-center gap-1">
              <Icons.Zap size={10} />
              Fast
            </div>
          )}

          {/* Preview Toggle */}
          {selectedFileForPreview && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-1.5 rounded-md hover:bg-layer-3 transition-colors"
              title={showPreview ? 'Hide Preview' : 'Show Preview'}
            >
              {showPreview ? (
                <Icons.Eye size={16} className="text-[var(--color-info)]" />
              ) : (
                <Icons.EyeOff size={16} className="text-text-tertiary" />
              )}
            </button>
          )}
        </div>

        {/* File List Header */}
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2 border-b border-border-base bg-layer-2 text-xs font-medium text-text-tertiary uppercase tracking-wider">
          <div className="w-5"></div>
          <div>Name</div>
          <div className="text-right">Size</div>
          <div className="text-right">Modified</div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-hidden" ref={listContainerRef}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-text-tertiary">Loading...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-[var(--color-error)]">Error: {error}</div>
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
              <Icons.Search size={48} className="mb-2 opacity-20" />
              <div>{searchResults !== null ? 'No files found' : 'Empty directory'}</div>
            </div>
          ) : (
            <List
              defaultHeight={listHeight}
              rowComponent={FileRow}
              rowCount={displayEntries.length}
              rowHeight={ROW_HEIGHT}
              rowProps={{}}
              overscanCount={5}
            />
          )}
        </div>
      </div>

      {/* Preview Panel */}
      {showPreview && selectedFileForPreview && (
        <div className="w-1/2 border-l border-border-base">
          <FilePreview
            filePath={selectedFileForPreview.path}
            fileName={selectedFileForPreview.name}
            fileSize={selectedFileForPreview.size}
          />
        </div>
      )}
    </div>
  );
};
