import React from 'react';
import { Icons } from '../IconComponents';
import { SyncJob } from '../../types';
import { formatSchedule } from '../../utils/formatters';
import { Panel, SectionHeader } from '../ui';

interface StatsQuickViewProps {
  job: SyncJob;
}

export const StatsQuickView: React.FC<StatsQuickViewProps> = ({ job }) => (
  <Panel variant="card">
    <SectionHeader variant="panel" icon={<Icons.Activity size={16} className="text-indigo-500" />}>
      Quick Stats
    </SectionHeader>
    <div className="space-y-3">
      <div className="flex items-center justify-between group">
        <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
          Last Sync
        </span>
        <span className="text-sm font-medium text-text-primary">
          {job.lastRun
            ? new Date(job.lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Never'}
        </span>
      </div>
      <div className="flex items-center justify-between group">
        <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
          Schedule
        </span>
        <span className="text-sm font-medium text-text-primary">
          {formatSchedule(job.scheduleInterval)}
        </span>
      </div>
      <div className="flex items-center justify-between group">
        <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
          Mode
        </span>
        <span className="text-sm font-medium text-text-primary bg-layer-2 px-2 py-0.5 rounded text-xs">
          {job.mode
            .replace('_', ' ')
            .toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase())}
        </span>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-border-base group">
        <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
          Total Snapshots
        </span>
        <span className="text-sm font-bold text-text-primary">{job.snapshots.length}</span>
      </div>
    </div>
  </Panel>
);
