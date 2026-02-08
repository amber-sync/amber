/**
 * AnalyticsOverlay - Expanded analytics view for snapshot insights
 *
 * Shows detailed file type distribution, largest files, and storage patterns.
 * Uses Observatory styling with data visualization elements.
 */

import { useState, useEffect, useMemo, memo } from 'react';
import { SyncJob, FileTypeStats, LargestFile } from '../../../types';
import { TimeMachineSnapshot } from '../TimeMachinePage';
import { Icons } from '../../../components/IconComponents';
import { Title, Body, Caption, Code } from '../../../components/ui';
import { formatBytes } from '../../../utils';
import { api } from '../../../api';

interface AnalyticsOverlayProps {
  isOpen: boolean;
  job: SyncJob;
  snapshot: TimeMachineSnapshot | null;
  onClose: () => void;
}

interface AnalyticsData {
  fileTypes: FileTypeStats[];
  largestFiles: LargestFile[];
  totalSize: number;
  totalFiles: number;
}

function AnalyticsOverlayComponent({ isOpen, job, snapshot, onClose }: AnalyticsOverlayProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'types' | 'largest'>('types');
  const snapshotTimestamp = snapshot?.timestamp;

  // Load analytics data
  useEffect(() => {
    if (!isOpen || !snapshotTimestamp || !job.destPath) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [fileTypes, largestFiles] = await Promise.all([
          api.getFileTypeStatsOnDestination(job.destPath, job.id, snapshotTimestamp, 20),
          api.getLargestFilesOnDestination(job.destPath, job.id, snapshotTimestamp, 20),
        ]);

        const totalSize = fileTypes.reduce((sum, ft) => sum + ft.totalSize, 0);
        const totalFiles = fileTypes.reduce((sum, ft) => sum + ft.count, 0);

        setData({ fileTypes, largestFiles, totalSize, totalFiles });
      } catch (err) {
        console.error('Failed to load analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, snapshotTimestamp, job.id, job.destPath]);

  // Calculate max values for bar charts
  const maxFileTypeSize = useMemo(() => {
    if (!data?.fileTypes.length) return 0;
    return Math.max(...data.fileTypes.map(ft => ft.totalSize));
  }, [data?.fileTypes]);

  const maxFileSize = useMemo(() => {
    if (!data?.largestFiles.length) return 0;
    return Math.max(...data.largestFiles.map(f => f.size));
  }, [data?.largestFiles]);

  return (
    <div className={`tm-overlay ${isOpen ? 'tm-overlay--visible' : ''}`}>
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel */}
      <div className="tm-overlay-panel" style={{ width: '600px' }}>
        {/* Header */}
        <div className="tm-overlay-header">
          <Title level={3} className="tm-overlay-title">
            Snapshot Analytics
          </Title>
          <button onClick={onClose} className="tm-overlay-close">
            <Icons.X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="tm-overlay-content">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Icons.RefreshCw
                size={32}
                className="text-[var(--color-accent-primary)] animate-spin mb-4"
              />
              <Body size="sm" className="text-[var(--tm-text-dim)]">
                Loading analytics...
              </Body>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Icons.AlertCircle size={32} className="text-[var(--tm-error)] mb-4" />
              <Body size="sm" className="text-[var(--tm-error)]">
                {error}
              </Body>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg">
                  <Caption className="mb-1 text-[var(--tm-text-dim)]">Total Files</Caption>
                  <Title level={3} className="text-[var(--tm-text-bright)]">
                    {data.totalFiles.toLocaleString()}
                  </Title>
                </div>
                <div className="p-4 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg">
                  <Caption className="mb-1 text-[var(--tm-text-dim)]">Total Size</Caption>
                  <Title level={3} className="text-[var(--tm-text-bright)]">
                    {formatBytes(data.totalSize)}
                  </Title>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-[var(--tm-void)] rounded-lg">
                <button
                  onClick={() => setActiveTab('types')}
                  className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                    activeTab === 'types'
                      ? 'bg-[var(--tm-nebula)] text-[var(--tm-text-bright)]'
                      : 'text-[var(--tm-text-dim)] hover:text-[var(--tm-text-soft)]'
                  }`}
                >
                  <Body size="sm">File Types</Body>
                </button>
                <button
                  onClick={() => setActiveTab('largest')}
                  className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                    activeTab === 'largest'
                      ? 'bg-[var(--tm-nebula)] text-[var(--tm-text-bright)]'
                      : 'text-[var(--tm-text-dim)] hover:text-[var(--tm-text-soft)]'
                  }`}
                >
                  <Body size="sm">Largest Files</Body>
                </button>
              </div>

              {/* Tab content */}
              <div className="space-y-2">
                {activeTab === 'types' ? (
                  data.fileTypes.length > 0 ? (
                    data.fileTypes.map((ft, i) => (
                      <FileTypeRow
                        key={i}
                        extension={ft.extension || 'other'}
                        count={ft.count}
                        size={ft.totalSize}
                        percentage={(ft.totalSize / maxFileTypeSize) * 100}
                      />
                    ))
                  ) : (
                    <Body size="sm" className="text-center py-8 text-[var(--tm-text-dim)]">
                      No file type data available
                    </Body>
                  )
                ) : data.largestFiles.length > 0 ? (
                  data.largestFiles.map((file, i) => (
                    <LargestFileRow
                      key={i}
                      path={file.path}
                      size={file.size}
                      percentage={(file.size / maxFileSize) * 100}
                      onOpen={() => api.openPath(file.path)}
                    />
                  ))
                ) : (
                  <Body size="sm" className="text-center py-8 text-[var(--tm-text-dim)]">
                    No file data available
                  </Body>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// File type row with bar chart
function FileTypeRow({
  extension,
  count,
  size,
  percentage,
}: {
  extension: string;
  count: number;
  size: number;
  percentage: number;
}) {
  return (
    <div className="relative p-3 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg overflow-hidden">
      {/* Background bar */}
      <div
        className="absolute inset-0 bg-[var(--color-accent-secondary)] transition-all"
        style={{ width: `${percentage}%` }}
      />

      {/* Content */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Code
            size="sm"
            className="px-2 py-0.5 bg-[var(--tm-dust)] rounded text-[var(--tm-text-bright)]"
          >
            .{extension}
          </Code>
          <Body size="sm" className="text-[var(--tm-text-dim)]">
            {count.toLocaleString()} files
          </Body>
        </div>
        <Body size="sm" weight="medium" className="text-[var(--tm-text-bright)]">
          {formatBytes(size)}
        </Body>
      </div>
    </div>
  );
}

// Largest file row
function LargestFileRow({
  path,
  size,
  percentage,
  onOpen,
}: {
  path: string;
  size: number;
  percentage: number;
  onOpen: () => void;
}) {
  const fileName = path.split('/').pop() || path;
  const dirPath = path.split('/').slice(0, -1).join('/');

  return (
    <div className="relative p-3 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg overflow-hidden group">
      {/* Background bar */}
      <div
        className="absolute inset-0 bg-[var(--color-accent-secondary)] transition-all"
        style={{ width: `${percentage}%` }}
      />

      {/* Content */}
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Body size="sm" weight="medium" className="text-[var(--tm-text-bright)] truncate">
            {fileName}
          </Body>
          <Code size="sm" truncate className="text-[var(--tm-text-dim)]">
            {dirPath}
          </Code>
        </div>
        <div className="flex items-center gap-2">
          <Body size="sm" weight="medium" className="text-[var(--tm-text-bright)]">
            {formatBytes(size)}
          </Body>
          <button
            onClick={onOpen}
            className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 bg-[var(--tm-dust)] hover:bg-[var(--tm-mist)] text-[var(--tm-text-dim)] hover:text-[var(--tm-text-bright)] transition-all"
            title="Open in Finder"
          >
            <Icons.ExternalLink size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export const AnalyticsOverlay = memo(AnalyticsOverlayComponent);
AnalyticsOverlay.displayName = 'AnalyticsOverlay';

export default AnalyticsOverlay;
