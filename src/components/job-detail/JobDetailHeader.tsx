import React from 'react';
import { Icons } from '../IconComponents';
import { SyncJob } from '../../types';

interface JobDetailHeaderProps {
  job: SyncJob;
  isRunning: boolean;
  onBack: () => void;
  onRun: (jobId: string) => void;
  onStop: (jobId: string) => void;
  onOpenSettings: () => void;
  onDelete: (jobId: string) => void;
  onRestore: (jobId: string) => void;
  titleOverride?: string;
}

export const JobDetailHeader: React.FC<JobDetailHeaderProps> = ({
  job,
  isRunning,
  onBack,
  onRun,
  onStop,
  onOpenSettings,
  onDelete,
  onRestore,
  titleOverride,
}) => (
  <div className="px-8 py-6 pt-10 border-b border-border-base flex justify-between items-center sticky top-0 bg-layer-1/95 backdrop-blur-sm z-10 text-text-primary titlebar-drag">
    {isRunning && (
      <div className="absolute top-0 left-0 w-full h-1 z-20 overflow-hidden">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-progress-pulse opacity-80" />
      </div>
    )}
    <div className="flex items-center gap-4 no-drag">
      <button onClick={onBack} className="p-2 hover:bg-layer-2 rounded-full transition-colors">
        <Icons.ArrowRight className="rotate-180 text-text-secondary" />
      </button>
      <div>
        <h2 className="text-2xl font-bold">{titleOverride || job.name}</h2>
        {!titleOverride && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Icons.Server size={14} /> {job.sourcePath}
            <Icons.ArrowRight size={14} />
            <Icons.HardDrive size={14} /> {job.destPath}
          </div>
        )}
      </div>
    </div>
    <div className="flex gap-3 no-drag">
      <button
        onClick={() => onDelete(job.id)}
        className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
        title="Delete Job"
      >
        <Icons.Trash2 size={18} />
      </button>
      <div className="w-px h-8 bg-border-base self-center mx-1"></div>
      <button
        onClick={() => onRestore(job.id)}
        className="px-4 py-2 border border-blue-200 dark:border-blue-800 rounded-lg text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center gap-2"
      >
        <Icons.RotateCcw size={16} /> Restore
      </button>
      <button
        onClick={onOpenSettings}
        className="px-4 py-2 border border-border-base rounded-lg text-sm font-medium hover:bg-layer-2 text-text-primary"
      >
        Settings
      </button>
      {isRunning ? (
        <button
          onClick={() => onStop(job.id)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex items-center gap-2 shadow-sm transition-all animate-pulse"
        >
          <Icons.XCircle size={16} /> Stop Sync
        </button>
      ) : (
        <button
          onClick={() => onRun(job.id)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 hover:shadow-teal-500/20 flex items-center gap-2 shadow-sm transition-all"
        >
          <Icons.Play size={16} /> Sync Now
        </button>
      )}
    </div>
  </div>
);
