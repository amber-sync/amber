import React from 'react';
import { Icons } from '../IconComponents';
import { SyncMode, RsyncConfig } from '../../types';

interface JobStrategyFormProps {
  jobMode: SyncMode;
  jobConfig: RsyncConfig;
  onJobModeChange: (mode: SyncMode) => void;
  setJobConfig: (val: RsyncConfig | ((prev: RsyncConfig) => RsyncConfig)) => void;
}

export const JobStrategyForm: React.FC<JobStrategyFormProps> = ({
  jobMode,
  jobConfig,
  onJobModeChange,
  setJobConfig,
}) => {
  const customSelected = jobConfig.customCommand !== undefined;

  const getModeStyles = (mode: SyncMode) => {
    switch (mode) {
      case SyncMode.MIRROR:
        return {
          border: 'border-teal-500',
          bg: 'bg-teal-50 dark:bg-teal-900/10',
          ring: 'ring-1 ring-teal-500',
        };
      case SyncMode.ARCHIVE:
        return {
          border: 'border-amber-500',
          bg: 'bg-amber-50 dark:bg-amber-900/10',
          ring: 'ring-1 ring-amber-500',
        };
      case SyncMode.TIME_MACHINE:
        return {
          border: 'border-indigo-500',
          bg: 'bg-indigo-50 dark:bg-indigo-900/10',
          ring: 'ring-1 ring-indigo-500',
        };
      default:
        return { border: 'border-gray-300', bg: 'bg-gray-50', ring: '' };
    }
  };

  return (
    <div className="col-span-12 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
        Sync Strategy
      </label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            m: SyncMode.TIME_MACHINE,
            label: 'Time Machine',
            desc: 'Snapshots',
            icon: Icons.FolderClock,
          },
          { m: SyncMode.MIRROR, label: 'Mirror', desc: 'Exact Copy', icon: Icons.RefreshCw },
          { m: SyncMode.ARCHIVE, label: 'Archive', desc: 'Add Only', icon: Icons.Archive },
        ].map(opt => (
          <button
            key={opt.m}
            onClick={() => onJobModeChange(opt.m)}
            className={`relative p-5 rounded-xl border text-left transition-all flex items-center gap-4 h-full ${
              jobMode === opt.m && !customSelected
                ? `${getModeStyles(opt.m).border} ${getModeStyles(opt.m).bg} ${getModeStyles(opt.m).ring}`
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <div
              className={`p-2.5 rounded-xl ${jobMode === opt.m && !customSelected ? 'bg-white dark:bg-black/20' : 'bg-gray-100 dark:bg-gray-800'}`}
            >
              <opt.icon
                size={24}
                className={
                  jobMode === opt.m && !customSelected
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500'
                }
              />
            </div>
            <div>
              <div className="font-bold text-gray-900 dark:text-white text-sm whitespace-nowrap">
                {opt.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-1">
                {opt.desc}
              </div>
            </div>
          </button>
        ))}

        <button
          onClick={() =>
            setJobConfig({ ...jobConfig, customCommand: customSelected ? undefined : '' })
          }
          className={`relative p-5 rounded-xl border text-left transition-all flex items-center gap-4 ${
            customSelected
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10 ring-1 ring-indigo-500'
              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <div
            className={`p-2.5 rounded-xl ${customSelected ? 'bg-white dark:bg-black/20' : 'bg-gray-100 dark:bg-gray-800'}`}
          >
            <Icons.Code
              size={24}
              className={customSelected ? 'text-indigo-600' : 'text-gray-500'}
            />
          </div>
          <div>
            <div className="font-bold text-gray-900 dark:text-white text-sm whitespace-nowrap">
              Custom
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-1">
              Raw Command
            </div>
          </div>
        </button>
      </div>

      {customSelected && (
        <textarea
          value={jobConfig.customCommand ?? ''}
          onChange={e => setJobConfig({ ...jobConfig, customCommand: e.target.value })}
          placeholder="rsync -a --{source} {dest}"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-xs min-h-[60px]"
        />
      )}
    </div>
  );
};
