/**
 * TIM-189: FileBrowser component using VirtualFileList for rendering
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icons } from '../../IconComponents';
import { FilePreview } from '../../FilePreview';
import { VirtualFileList, type FileEntry } from '../../data-display';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';
import { isDirectory } from '../../../types';

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

  // Use refs for values needed in loadDirectory to avoid dependency churn
  const isIndexedRef = useRef(isIndexed);
  const destPathRef = useRef(destPath);
  const jobIdRef = useRef(jobId);
  const snapshotTimestampRef = useRef(snapshotTimestamp);
  const initialPathRef = useRef(initialPath);

  // Keep refs in sync
  useEffect(() => {
    isIndexedRef.current = isIndexed;
  }, [isIndexed]);
  useEffect(() => {
    destPathRef.current = destPath;
  }, [destPath]);
  useEffect(() => {
    jobIdRef.current = jobId;
  }, [jobId]);
  useEffect(() => {
    snapshotTimestampRef.current = snapshotTimestamp;
  }, [snapshotTimestamp]);
  useEffect(() => {
    initialPathRef.current = initialPath;
  }, [initialPath]);

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

  // Load directory - stable function using refs to avoid dependency loop
  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setSearchResults(null);
    setSearchQuery('');

    try {
      let formatted: FileEntry[];
      const useIndex = isIndexedRef.current;
      const dest = destPathRef.current;
      const job = jobIdRef.current;
      const timestamp = snapshotTimestampRef.current;
      const initPath = initialPathRef.current;

      if (useIndex && dest && job && timestamp) {
        // TIM-127: Use fast SQLite query from destination index
        const relativePath = path === initPath ? '' : path.replace(initPath + '/', '');
        const result = await api.getDirectoryFromDestination(dest, job, timestamp, relativePath);

        formatted = result.map((item: any) => ({
          name: item.name,
          path: `${initPath}/${item.path}`,
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
  }, []);

  // Load directory when path changes OR when isIndexed status changes
  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory, isIndexed]);

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
          path: `${initialPath}/${item.path}`,
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

  const handleNavigateUp = useCallback(() => {
    if (currentPath === initialPath) return;
    const parent = currentPath.split('/').slice(0, -1).join('/');
    setCurrentPath(parent);
  }, [currentPath, initialPath]);

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

  // Breadcrumbs
  const relativePath = currentPath.replace(initialPath, '');
  const parts = relativePath.split('/').filter(Boolean);

  // Determine which entries to display
  const displayEntries = searchResults !== null ? searchResults : entries;

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

        {/* File List - TIM-189: Using VirtualFileList component */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-text-tertiary">Loading...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-[var(--color-error)]">Error: {error}</div>
            </div>
          ) : (
            <VirtualFileList
              items={displayEntries}
              onItemClick={handleEntryClick}
              selectable={selectable}
              selectedFiles={selectedFiles}
              onSelectionChange={onSelectionChange}
              highlightedItem={selectedFileForPreview}
              emptyMessage={searchResults !== null ? 'No files found' : 'Empty directory'}
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
