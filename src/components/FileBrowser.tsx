/**
 * TIM-188: FileBrowser component refactored to use useFileBrowser hook
 * Logic extracted for better separation of concerns
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { Icons } from './IconComponents';
import { formatBytes } from '../utils/formatters';
import { FilePreview } from './FilePreview';
import { useFileBrowser, type FileEntry } from '../hooks/useFileBrowser';

const ROW_HEIGHT = 40;

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

// Row props passed via react-window v2 rowProps
interface FileRowProps {
  entries: FileEntry[];
  selectedFiles: Set<string>;
  selectedFileForPreview: FileEntry | null;
  selectable: boolean;
  onEntryClick: (entry: FileEntry) => void;
  onToggleSelection: (e: React.MouseEvent | null, path: string) => void;
}

// FileRow component defined OUTSIDE FileBrowser for stable reference
// This is critical for react-window v2 performance
function FileRow({
  index,
  style,
  ariaAttributes,
  entries,
  selectedFiles,
  selectedFileForPreview,
  selectable,
  onEntryClick,
  onToggleSelection,
}: RowComponentProps<FileRowProps>) {
  const entry = entries[index];
  if (!entry) return <div style={style} {...ariaAttributes} />;

  const isSelected = selectedFiles.has(entry.path);
  const isPreviewSelected = selectedFileForPreview?.path === entry.path;

  return (
    <div
      {...ariaAttributes}
      style={style}
      onClick={() => onEntryClick(entry)}
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
            onChange={() => onToggleSelection(null, entry.path)}
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
  // Use custom hook for file browsing logic
  const {
    currentPath,
    displayEntries,
    loading,
    error,
    isIndexed,
    searchQuery,
    searchResults,
    isSearching,
    breadcrumbParts,
    navigateTo,
    navigateUp,
    search,
    clearSearch,
  } = useFileBrowser({ initialPath, jobId, snapshotTimestamp, destPath });

  // Local UI state
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<FileEntry | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  // Container height for scrollable list
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);

  // Measure container height for scrollable list
  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(resizeEntries => {
      for (const entry of resizeEntries) {
        setListHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    // Initial measurement
    setListHeight(container.clientHeight);

    return () => resizeObserver.disconnect();
  }, []);

  // Reset preview selection when path changes
  useEffect(() => {
    setSelectedFileForPreview(null);
  }, [initialPath]);

  const handleEntryClick = useCallback(
    (entry: FileEntry) => {
      if (entry.isDirectory) {
        navigateTo(entry.path);
        setSelectedFileForPreview(null);
      } else {
        setSelectedFileForPreview(entry);
      }
    },
    [navigateTo]
  );

  const toggleSelection = useCallback(
    (e: React.MouseEvent | null, path: string) => {
      e?.stopPropagation();
      if (onSelectionChange) {
        onSelectionChange(path, !selectedFiles.has(path));
      }
    },
    [onSelectionChange, selectedFiles]
  );

  // Memoize rowProps to prevent unnecessary re-renders
  const rowProps = useMemo<FileRowProps>(
    () => ({
      entries: displayEntries,
      selectedFiles,
      selectedFileForPreview,
      selectable,
      onEntryClick: handleEntryClick,
      onToggleSelection: toggleSelection,
    }),
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
            onClick={navigateUp}
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
                  onClick={clearSearch}
                  className="ml-2 text-xs text-[var(--color-info)] hover:text-[var(--color-info)]"
                >
                  Clear
                </button>
              </span>
            ) : (
              <>
                <span
                  className="cursor-pointer hover:text-[var(--color-info)] transition-colors flex items-center gap-1"
                  onClick={() => navigateTo(initialPath)}
                >
                  <Icons.HardDrive size={14} />
                  Root
                </span>
                {breadcrumbParts.map((part, i) => {
                  const pathSoFar = initialPath + '/' + breadcrumbParts.slice(0, i + 1).join('/');
                  return (
                    <React.Fragment key={pathSoFar}>
                      <span className="text-text-quaternary">/</span>
                      <span
                        className="cursor-pointer hover:text-[var(--color-info)] transition-colors truncate max-w-[150px]"
                        onClick={() => navigateTo(pathSoFar)}
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
                onChange={e => search(e.target.value)}
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
              rowProps={rowProps}
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
