/**
 * TIM-189: Virtualized file list component
 * Extracted from FileBrowser for reuse with react-window
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { Icons } from '../IconComponents';
import { formatBytes } from '../../utils/formatters';

const DEFAULT_ROW_HEIGHT = 40;

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

export interface VirtualFileListProps {
  /** Items to display in the list */
  items: FileEntry[];
  /** Called when an item is clicked */
  onItemClick: (item: FileEntry) => void;
  /** Height of each row in pixels */
  rowHeight?: number;
  /** Enable checkbox selection */
  selectable?: boolean;
  /** Set of selected file paths */
  selectedFiles?: Set<string>;
  /** Called when selection changes */
  onSelectionChange?: (path: string, selected: boolean) => void;
  /** Currently highlighted item for preview */
  highlightedItem?: FileEntry | null;
  /** Empty state message */
  emptyMessage?: string;
  /** Number of items to render outside visible area */
  overscanCount?: number;
}

// Internal row props for react-window
interface FileRowProps {
  items: FileEntry[];
  selectedFiles: Set<string>;
  highlightedItem: FileEntry | null;
  selectable: boolean;
  onItemClick: (item: FileEntry) => void;
  onToggleSelection: (e: React.MouseEvent | null, path: string) => void;
}

// FileRow component - defined outside for stable reference (critical for performance)
function FileRow({
  index,
  style,
  ariaAttributes,
  items,
  selectedFiles,
  highlightedItem,
  selectable,
  onItemClick,
  onToggleSelection,
}: RowComponentProps<FileRowProps>) {
  const item = items[index];
  if (!item) return <div style={style} {...ariaAttributes} />;

  const isSelected = selectedFiles.has(item.path);
  const isHighlighted = highlightedItem?.path === item.path;

  return (
    <div
      {...ariaAttributes}
      style={style}
      onClick={() => onItemClick(item)}
      className={`grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 items-center hover:bg-layer-2 cursor-pointer border-b border-border-base transition-colors ${
        isHighlighted ? 'bg-[var(--color-info-subtle)]' : ''
      }`}
    >
      {/* Checkbox */}
      <div className="flex items-center">
        {selectable && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(null, item.path)}
            onClick={e => e.stopPropagation()}
            className="w-4 h-4 rounded border-border-base"
          />
        )}
      </div>

      {/* Name */}
      <div className="flex items-center gap-2 min-w-0">
        {item.isDirectory ? (
          <Icons.Folder size={16} className="text-[var(--color-info)] flex-shrink-0" />
        ) : (
          <Icons.File size={16} className="text-text-tertiary flex-shrink-0" />
        )}
        <span className="truncate text-text-secondary">{item.name}</span>
      </div>

      {/* Size */}
      <div className="text-right text-text-tertiary tabular-nums text-sm">
        {!item.isDirectory && formatBytes(item.size)}
      </div>

      {/* Modified */}
      <div className="text-right text-text-tertiary tabular-nums text-xs">
        {item.modified.toLocaleDateString()}
      </div>
    </div>
  );
}

/**
 * VirtualFileList - High-performance virtualized file list
 * Uses react-window for smooth scrolling with large datasets (10k+ files)
 */
export function VirtualFileList({
  items,
  onItemClick,
  rowHeight = DEFAULT_ROW_HEIGHT,
  selectable = false,
  selectedFiles = new Set(),
  onSelectionChange,
  highlightedItem = null,
  emptyMessage = 'Empty directory',
  overscanCount = 5,
}: VirtualFileListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);

  // Measure container height for the virtualized list
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setListHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    setListHeight(container.clientHeight);

    return () => resizeObserver.disconnect();
  }, []);

  const handleToggleSelection = useCallback(
    (e: React.MouseEvent | null, path: string) => {
      e?.stopPropagation();
      if (onSelectionChange) {
        onSelectionChange(path, !selectedFiles.has(path));
      }
    },
    [onSelectionChange, selectedFiles]
  );

  // Memoize row props to prevent unnecessary re-renders
  const rowProps = useMemo<FileRowProps>(
    () => ({
      items,
      selectedFiles,
      highlightedItem,
      selectable,
      onItemClick,
      onToggleSelection: handleToggleSelection,
    }),
    [items, selectedFiles, highlightedItem, selectable, onItemClick, handleToggleSelection]
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
        <Icons.Search size={48} className="mb-2 opacity-20" />
        <div>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-hidden">
      <List
        defaultHeight={listHeight}
        rowComponent={FileRow}
        rowCount={items.length}
        rowHeight={rowHeight}
        rowProps={rowProps}
        overscanCount={overscanCount}
      />
    </div>
  );
}

export default VirtualFileList;
