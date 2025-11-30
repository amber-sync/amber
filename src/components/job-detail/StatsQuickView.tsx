import React from 'react';
import { Icons } from '../IconComponents';
import { SyncJob } from '../../types';
import { formatSchedule } from '../../utils/formatters';

interface StatsQuickViewProps {
  job: SyncJob;
}

export const StatsQuickView: React.FC<StatsQuickViewProps> = ({ job }) => (
  <div className="bg-layer-1 border border-border-base rounded-xl p-5 shadow-sm">
    <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
      <Icons.Activity size={16} className="text-indigo-500" /> Quick Stats
    </h3>
    <div className="space-y-3">
      <div className="flex items-center justify-between group">
        <span className="text-xs text-text-secondary group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
          Last Sync
        </span>
        <span className="text-sm font-medium text-text-primary">
          {job.lastRun
            ? new Date(job.lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Never'}
        </span>
      </div>
      <div className="flex items-center justify-between group">
        <span className="text-xs text-text-secondary group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
          Schedule
        </span>
        <span className="text-sm font-medium text-text-primary">
          {formatSchedule(job.scheduleInterval)}
        </span>
      </div>
      <div className="flex items-center justify-between group">
        <span className="text-xs text-text-secondary group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
          Mode
        </span>
        <span className="text-sm font-medium text-text-primary bg-layer-2 px-2 py-0.5 rounded text-xs">
          {job.mode
            .replace('_', ' ')
            .toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase())}
        </span>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700 group">
        <span className="text-xs text-text-secondary group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
          Total Snapshots
        </span>
        <span className="text-sm font-bold text-text-primary">{job.snapshots.length}</span>
      </div>
    </div>
  </div>
);
