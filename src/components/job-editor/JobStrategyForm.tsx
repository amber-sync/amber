import React from 'react';
import { Icons } from '../IconComponents';
import { SyncMode, RsyncConfig } from '../../types';
import { Panel, SectionHeader, TextArea } from '../ui';

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
        return { border: 'border-border-base', bg: 'bg-layer-2', ring: '' };
    }
  };

  return (
    <Panel variant="form" className="col-span-12 space-y-4">
      <SectionHeader variant="form-label" className="mb-0">
        Sync Strategy
      </SectionHeader>
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
                : 'border-border-base hover:bg-layer-2'
            }`}
          >
            <div
              className={`p-2.5 rounded-xl ${jobMode === opt.m && !customSelected ? 'bg-layer-1' : 'bg-layer-2'}`}
            >
              <opt.icon
                size={24}
                className={
                  jobMode === opt.m && !customSelected ? 'text-text-primary' : 'text-text-tertiary'
                }
              />
            </div>
            <div>
              <div className="font-bold text-text-primary text-sm whitespace-nowrap">
                {opt.label}
              </div>
              <div className="text-xs text-text-secondary leading-tight mt-1">{opt.desc}</div>
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
              : 'border-border-base hover:bg-layer-2'
          }`}
        >
          <div className={`p-2.5 rounded-xl ${customSelected ? 'bg-layer-1' : 'bg-layer-2'}`}>
            <Icons.Code
              size={24}
              className={customSelected ? 'text-indigo-600' : 'text-text-tertiary'}
            />
          </div>
          <div>
            <div className="font-bold text-text-primary text-sm whitespace-nowrap">Custom</div>
            <div className="text-xs text-text-secondary leading-tight mt-1">Raw Command</div>
          </div>
        </button>
      </div>

      {customSelected && (
        <TextArea
          variant="mono"
          value={jobConfig.customCommand ?? ''}
          onChange={e => setJobConfig({ ...jobConfig, customCommand: e.target.value })}
          placeholder="rsync -a --{source} {dest}"
          className="min-h-[60px] text-xs"
        />
      )}
    </Panel>
  );
};
