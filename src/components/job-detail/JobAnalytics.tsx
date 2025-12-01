import React from 'react';
import { Icons } from '../IconComponents';
import { formatBytes } from '../../utils/formatters';
import { Panel, SectionHeader } from '../ui';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

export interface JobAnalyticsData {
  fileTypes: { name: string; value: number }[];
  largestFiles: { name: string; size: number; path: string }[];
}

interface JobAnalyticsProps {
  analytics: JobAnalyticsData;
  onShowFile: (path: string) => void;
}

export const JobAnalytics: React.FC<JobAnalyticsProps> = ({ analytics, onShowFile }) => (
  <Panel variant="card" className="space-y-6">
    <div>
      <SectionHeader
        variant="panel"
        icon={<Icons.PieChart size={16} className="text-indigo-500" />}
      >
        File Types
      </SectionHeader>
      <div className="flex items-center gap-4">
        <div
          className="relative w-20 h-20 rounded-full shrink-0"
          style={{
            background: `conic-gradient(${analytics.fileTypes.reduce((acc, type, i, arr) => {
              const total = analytics.fileTypes.reduce((sum, t) => sum + t.value, 0);
              const prevDeg =
                i === 0
                  ? 0
                  : (analytics.fileTypes.slice(0, i).reduce((sum, t) => sum + t.value, 0) / total) *
                    360;
              const currentDeg = (type.value / total) * 360 + prevDeg;
              const color = COLORS[i % COLORS.length];
              return (
                acc + `${color} ${prevDeg}deg ${currentDeg}deg${i === arr.length - 1 ? '' : ', '}`
              );
            }, '')})`,
          }}
        >
          <div className="absolute inset-0 m-auto w-12 h-12 bg-layer-1 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-text-primary">
              {analytics.fileTypes.reduce((acc, curr) => acc + curr.value, 0)}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          {analytics.fileTypes.slice(0, 3).map((type, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-text-secondary truncate">{type.name}</span>
              <span className="text-text-tertiary ml-auto">{type.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div>
      <SectionHeader
        variant="panel"
        icon={<Icons.File size={16} className="text-indigo-500" />}
        className="mb-3"
      >
        Largest Files
      </SectionHeader>
      <div className="space-y-2">
        {analytics.largestFiles.slice(0, 3).map((file, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-2 bg-layer-2 rounded-lg group"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Icons.File size={12} className="text-text-tertiary shrink-0" />
              <span className="text-xs font-medium text-text-primary truncate" title={file.name}>
                {file.name}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-2xs font-mono text-text-secondary">
                {formatBytes(file.size)}
              </span>
              <button
                onClick={() => onShowFile(file.path)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-layer-1 rounded transition-all text-text-tertiary hover:text-accent-primary"
                title="Show in Finder"
              >
                <Icons.Search size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </Panel>
);

export const JobAnalyticsPlaceholder: React.FC = () => (
  <Panel variant="card" className="flex flex-col items-center justify-center h-48 text-center">
    <div className="bg-layer-2 p-3 rounded-full mb-3">
      <Icons.BarChart2 className="text-text-tertiary" size={20} />
    </div>
    <h3 className="text-sm font-bold text-text-primary mb-1">No Analytics</h3>
    <p className="text-xs text-text-secondary max-w-[150px]">Run a sync to see file stats.</p>
  </Panel>
);
