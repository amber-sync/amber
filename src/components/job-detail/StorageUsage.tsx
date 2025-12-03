import React from 'react';
import { Icons } from '../IconComponents';
import { DiskStats, SyncJob } from '../../types';
import { formatBytes } from '../../utils/formatters';
import { Panel } from '../ui';

interface StorageUsageProps {
  job: SyncJob;
  diskStats: Record<string, DiskStats>;
}

export const StorageUsage: React.FC<StorageUsageProps> = ({ job, diskStats }) => {
  const stat = diskStats[job.destPath];
  const isAvailable = stat?.status === 'AVAILABLE';
  const totalBytes = isAvailable ? stat.total : 0;
  const freeBytes = isAvailable ? stat.free : 0;
  const usedBytes = totalBytes - freeBytes;
  const snapshots = job.snapshots ?? [];
  const jobSize = snapshots[snapshots.length - 1]?.sizeBytes || 0;

  const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  const jobPercent = totalBytes > 0 ? (jobSize / totalBytes) * 100 : 0;

  return (
    <Panel variant="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Icons.HardDrive size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Storage Overview</h3>
            <p className="text-xs text-text-secondary">{job.destPath}</p>
          </div>
        </div>
        {isAvailable && (
          <span className="text-xs font-medium px-2 py-1 bg-layer-2 rounded-md text-text-secondary">
            {usedPercent.toFixed(0)}% Used
          </span>
        )}
      </div>

      {isAvailable ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-xs text-text-secondary mb-1">Capacity</div>
              <div className="text-lg font-bold text-text-primary">{formatBytes(totalBytes)}</div>
            </div>
            <div className="flex-1 border-l border-border-base pl-4">
              <div className="text-xs text-text-secondary mb-1">Free</div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {formatBytes(freeBytes)}
              </div>
            </div>
            <div className="flex-1 border-l border-border-base pl-4">
              <div className="text-xs text-text-secondary mb-1">This Job</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {formatBytes(jobSize)}
              </div>
            </div>
          </div>

          <div className="relative h-3 bg-layer-2 rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-text-tertiary transition-all"
              style={{ width: `${usedPercent}%` }}
            />
            <div
              className="absolute h-full bg-blue-500 transition-all shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              style={{ width: `${jobPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-text-secondary text-sm bg-layer-2 rounded-lg border border-dashed border-border-base">
          Destination drive not connected
        </div>
      )}
    </Panel>
  );
};
