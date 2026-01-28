/**
 * DiffTree - Grouped tree view of snapshot differences
 *
 * Displays files added, deleted, and modified between two snapshots,
 * organized into collapsible sections with files grouped by folder.
 *
 * @module TIM-221
 */

import { useState, useMemo, memo } from 'react';
import type { DiffEntry } from '../../../types';
import { Icons } from '../../../components/IconComponents';
import { Body, Code, Caption } from '../../../components/ui';
import { formatBytes } from '../../../utils';

/* ========================================
 * TYPES
 * ======================================== */

export interface DiffTreeProps {
  added: DiffEntry[];
  deleted: DiffEntry[];
  modified: DiffEntry[];
  onFileClick?: (path: string, type: 'added' | 'deleted' | 'modified') => void;
}

interface GroupedFiles {
  folder: string;
  files: DiffEntry[];
}

type DiffType = 'added' | 'deleted' | 'modified';

/* ========================================
 * UTILITY FUNCTIONS
 * ======================================== */

/**
 * Groups entries by their parent folder path
 */
function groupByFolder(entries: DiffEntry[]): GroupedFiles[] {
  const folderMap = new Map<string, DiffEntry[]>();

  for (const entry of entries) {
    const lastSlash = entry.path.lastIndexOf('/');
    const folder = lastSlash > 0 ? entry.path.slice(0, lastSlash) : '/';

    const existing = folderMap.get(folder);
    if (existing) {
      existing.push(entry);
    } else {
      folderMap.set(folder, [entry]);
    }
  }

  // Sort folders alphabetically and files within each folder
  return Array.from(folderMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, files]) => ({
      folder,
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
    }));
}

/**
 * Extract filename from path
 */
function getFileName(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}

/* ========================================
 * SUB-COMPONENTS
 * ======================================== */

/**
 * Renders size delta with appropriate color
 */
function SizeDelta({
  type,
  sizeA,
  sizeB,
}: {
  type: DiffType;
  sizeA: number | null;
  sizeB: number | null;
}) {
  if (type === 'added' && sizeB !== null) {
    return <Caption className="text-[var(--color-success)]">+{formatBytes(sizeB)}</Caption>;
  }

  if (type === 'deleted' && sizeA !== null) {
    return <Caption className="text-[var(--color-error)]">-{formatBytes(sizeA)}</Caption>;
  }

  if (type === 'modified' && sizeA !== null && sizeB !== null) {
    const delta = sizeB - sizeA;
    if (delta === 0) {
      return <Caption color="tertiary">{formatBytes(sizeB)}</Caption>;
    }
    const isPositive = delta > 0;
    const color = isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]';
    const prefix = isPositive ? '+' : '';
    return (
      <Caption className={color}>
        {prefix}
        {formatBytes(Math.abs(delta))}
      </Caption>
    );
  }

  return null;
}

/**
 * Individual file row within a folder group
 */
function FileRow({
  entry,
  type,
  onClick,
}: {
  entry: DiffEntry;
  type: DiffType;
  onClick?: () => void;
}) {
  const fileName = getFileName(entry.path);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-layer-2 rounded-md transition-colors text-left"
    >
      <Icons.File size={14} className="text-text-tertiary flex-shrink-0" />
      <Body size="sm" as="span" className="flex-1 truncate" title={entry.path}>
        {fileName}
      </Body>
      <SizeDelta type={type} sizeA={entry.sizeA} sizeB={entry.sizeB} />
    </button>
  );
}

/**
 * Folder group with multiple files
 */
function FolderGroup({
  folder,
  files,
  type,
  onFileClick,
}: {
  folder: string;
  files: DiffEntry[];
  type: DiffType;
  onFileClick?: (path: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-layer-2 rounded-md transition-colors"
      >
        <Icons.ChevronRight
          size={14}
          className={`text-text-tertiary transition-transform duration-fast ${isExpanded ? 'rotate-90' : ''}`}
        />
        <Icons.Folder size={14} className="text-text-tertiary" />
        <Code size="sm" className="flex-1 truncate text-left" title={folder}>
          {folder}
        </Code>
        <Caption color="tertiary">{files.length}</Caption>
      </button>

      {isExpanded && (
        <div className="ml-5 border-l border-border-base pl-2">
          {files.map(file => (
            <FileRow
              key={file.path}
              entry={file}
              type={type}
              onClick={onFileClick ? () => onFileClick(file.path) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Collapsible section for a diff type (added/deleted/modified)
 */
function DiffSection({
  title,
  type,
  entries,
  onFileClick,
}: {
  title: string;
  type: DiffType;
  entries: DiffEntry[];
  onFileClick?: (path: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const groupedFiles = useMemo(() => groupByFolder(entries), [entries]);

  // Calculate total size change for section summary
  const sizeChange = useMemo(() => {
    if (type === 'added') {
      return entries.reduce((sum, e) => sum + (e.sizeB ?? 0), 0);
    }
    if (type === 'deleted') {
      return entries.reduce((sum, e) => sum + (e.sizeA ?? 0), 0);
    }
    // Modified: sum of deltas
    return entries.reduce((sum, e) => sum + ((e.sizeB ?? 0) - (e.sizeA ?? 0)), 0);
  }, [entries, type]);

  if (entries.length === 0) {
    return null;
  }

  const getSectionColor = () => {
    switch (type) {
      case 'added':
        return 'text-[var(--color-success)]';
      case 'deleted':
        return 'text-[var(--color-error)]';
      case 'modified':
        return sizeChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]';
    }
  };

  const getPrefix = () => {
    switch (type) {
      case 'added':
        return '+';
      case 'deleted':
        return '-';
      case 'modified':
        return sizeChange >= 0 ? '+' : '';
    }
  };

  return (
    <div className="border border-border-base rounded-lg overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-layer-2 hover:bg-layer-3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icons.ChevronRight
            size={16}
            className={`text-text-tertiary transition-transform duration-fast ${isExpanded ? 'rotate-90' : ''}`}
          />
          <Body size="sm" weight="medium" as="span">
            {title}
          </Body>
          <Caption color="tertiary">{entries.length} files</Caption>
        </div>
        <Caption className={getSectionColor()}>
          {getPrefix()}
          {formatBytes(Math.abs(sizeChange))}
        </Caption>
      </button>

      {/* Section content */}
      {isExpanded && (
        <div className="p-2 space-y-1">
          {groupedFiles.map(group => (
            <FolderGroup
              key={group.folder}
              folder={group.folder}
              files={group.files}
              type={type}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================================
 * MAIN COMPONENT
 * ======================================== */

function DiffTreeComponent({ added, deleted, modified, onFileClick }: DiffTreeProps) {
  const totalChanges = added.length + deleted.length + modified.length;

  // Calculate overall size delta
  const totalSizeDelta = useMemo(() => {
    const addedSize = added.reduce((sum, e) => sum + (e.sizeB ?? 0), 0);
    const deletedSize = deleted.reduce((sum, e) => sum + (e.sizeA ?? 0), 0);
    const modifiedDelta = modified.reduce((sum, e) => sum + ((e.sizeB ?? 0) - (e.sizeA ?? 0)), 0);
    return addedSize - deletedSize + modifiedDelta;
  }, [added, deleted, modified]);

  if (totalChanges === 0) {
    return (
      <div className="text-center py-8">
        <Body color="secondary">No differences found</Body>
      </div>
    );
  }

  const deltaColor =
    totalSizeDelta >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]';
  const deltaPrefix = totalSizeDelta >= 0 ? '+' : '';

  return (
    <div className="space-y-4">
      {/* Summary line */}
      <div className="flex items-center justify-between px-1">
        <Body size="sm" color="secondary">
          {totalChanges} file{totalChanges !== 1 ? 's' : ''} changed
        </Body>
        <Caption className={deltaColor}>
          {deltaPrefix}
          {formatBytes(Math.abs(totalSizeDelta))} total
        </Caption>
      </div>

      {/* Diff sections */}
      <div className="space-y-3">
        <DiffSection
          title="Added"
          type="added"
          entries={added}
          onFileClick={onFileClick ? path => onFileClick(path, 'added') : undefined}
        />
        <DiffSection
          title="Deleted"
          type="deleted"
          entries={deleted}
          onFileClick={onFileClick ? path => onFileClick(path, 'deleted') : undefined}
        />
        <DiffSection
          title="Modified"
          type="modified"
          entries={modified}
          onFileClick={onFileClick ? path => onFileClick(path, 'modified') : undefined}
        />
      </div>
    </div>
  );
}

export const DiffTree = memo(DiffTreeComponent);
DiffTree.displayName = 'DiffTree';

export default DiffTree;
