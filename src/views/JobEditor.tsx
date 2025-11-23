import React from 'react';
import { SyncMode, RsyncConfig, SshConfig } from '../types';
import { Icons } from '../components/IconComponents';

interface JobEditorProps {
  // Form state
  jobName: string;
  jobSource: string;
  jobDest: string;
  jobMode: SyncMode;
  jobSchedule: number | null;
  jobConfig: RsyncConfig;
  sshEnabled: boolean;
  sshPort: string;
  sshKeyPath: string;
  sshConfigPath: string;
  tempExcludePattern: string;

  // State setters
  setJobName: (val: string) => void;
  setJobSource: (val: string) => void;
  setJobDest: (val: string) => void;
  setJobMode: (val: SyncMode) => void;
  setJobSchedule: (val: number | null) => void;
  setJobConfig: (val: RsyncConfig | ((prev: RsyncConfig) => RsyncConfig)) => void;
  setSshEnabled: (val: boolean) => void;
  setSshPort: (val: string) => void;
  setSshKeyPath: (val: string) => void;
  setSshConfigPath: (val: string) => void;
  setTempExcludePattern: (val: string) => void;

  // Handlers
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onSelectDirectory: (target: 'SOURCE' | 'DEST') => void;
  onJobModeChange: (mode: SyncMode) => void;
  onAddPattern: () => void;

  // Other props
  isEditing: boolean;
}

export const JobEditor: React.FC<JobEditorProps> = ({
  jobName,
  jobSource,
  jobDest,
  jobMode,
  jobSchedule,
  jobConfig,
  sshEnabled,
  sshPort,
  sshKeyPath,
  sshConfigPath,
  tempExcludePattern,
  setJobName,
  setJobSource,
  setJobDest,
  setJobSchedule,
  setJobConfig,
  setSshEnabled,
  setSshPort,
  setSshKeyPath,
  setSshConfigPath,
  setTempExcludePattern,
  onSave,
  onCancel,
  onDelete,
  onSelectDirectory,
  onJobModeChange,
  onAddPattern,
  isEditing
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAddPattern();
    }
    if (e.key === 'Backspace' && !tempExcludePattern && jobConfig.excludePatterns.length > 0) {
      setJobConfig(prev => ({ ...prev, excludePatterns: prev.excludePatterns.slice(0, -1) }));
    }
  };

  const customSelected = jobConfig.customCommand !== undefined;

  const getModeStyles = (mode: SyncMode) => {
    switch (mode) {
      case SyncMode.MIRROR:
        return { border: 'border-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/10', ring: 'ring-1 ring-teal-500' };
      case SyncMode.ARCHIVE:
        return { border: 'border-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10', ring: 'ring-1 ring-amber-500' };
      case SyncMode.TIME_MACHINE:
        return { border: 'border-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/10', ring: 'ring-1 ring-indigo-500' };
      default:
        return { border: 'border-gray-300', bg: 'bg-gray-50', ring: '' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-black/50 flex items-center justify-center p-6 backdrop-blur-md z-50 absolute top-0 left-0 w-full">
      <div className="bg-white dark:bg-gray-900 max-w-2xl w-full rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Job Settings' : 'Create Sync Job'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <Icons.XCircle size={24} />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-8 overflow-y-auto space-y-8 scrollbar-hide">

          {/* Basic Info */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Job Name</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900 outline-none transition-all"
              placeholder="e.g. Project Website Backup"
              value={jobName}
              onChange={e => setJobName(e.target.value)}
            />
          </div>

          {/* Source and Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Icons.Server size={14} /> Source
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900 outline-none transition-all font-mono text-sm"
                  placeholder="user@host:/path"
                  value={jobSource}
                  onChange={e => setJobSource(e.target.value)}
                />
                <button
                  onClick={() => onSelectDirectory('SOURCE')}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl transition-colors border border-gray-200 dark:border-gray-700"
                >
                  <Icons.Folder size={20} />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Icons.HardDrive size={14} /> Destination
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900 outline-none transition-all font-mono text-sm"
                  placeholder="/Volumes/Backup"
                  value={jobDest}
                  onChange={e => setJobDest(e.target.value)}
                />
                <button
                  onClick={() => onSelectDirectory('DEST')}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl transition-colors border border-gray-200 dark:border-gray-700"
                >
                  <Icons.Folder size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* SSH Configuration */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Icons.Shield size={14} /> Connection Details (SSH)
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={sshEnabled} onChange={e => setSshEnabled(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {sshEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 animate-fade-in">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Port</label>
                  <input
                    type="text"
                    placeholder="22"
                    value={sshPort}
                    onChange={e => setSshPort(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Identity File (Key)</label>
                  <input
                    type="text"
                    placeholder="~/.ssh/id_rsa"
                    value={sshKeyPath}
                    onChange={e => setSshKeyPath(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Config File</label>
                  <input
                    type="text"
                    placeholder="~/.ssh/config"
                    value={sshConfigPath}
                    onChange={e => setSshConfigPath(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mode Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Sync Strategy</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { m: SyncMode.TIME_MACHINE, label: 'Time Machine', desc: 'Versioned snapshots' },
                { m: SyncMode.ARCHIVE, label: 'Archive', desc: 'Keep deleted files' },
                { m: SyncMode.MIRROR, label: 'Mirror', desc: 'Exact replica' },
              ].map((opt) => (
                <button
                  key={opt.m}
                  onClick={() => onJobModeChange(opt.m)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${jobMode === opt.m && !customSelected
                      ? `${getModeStyles(opt.m).border} ${getModeStyles(opt.m).bg} ${getModeStyles(opt.m).ring}`
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white">{opt.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{opt.desc}</div>
                </button>
              ))}
              <button
                onClick={() => setJobConfig({ ...jobConfig, customCommand: customSelected ? undefined : '' })}
                className={`p-4 rounded-xl border text-left transition-all ${customSelected
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-500'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
              >
                <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">Custom</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Overrides defaults.</div>
              </button>
            </div>
            {jobMode === SyncMode.MIRROR && !customSelected && (
              <div className="text-xs text-red-600 dark:text-red-300 mt-1">
                Mirror will delete files in the destination that are not present in the source.
              </div>
            )}
          </div>

          {/* Advanced Command (visible only when custom is enabled) */}
          {customSelected && (
            <div className="space-y-2 border border-red-200 dark:border-red-900/50 rounded-xl p-4 bg-red-50/50 dark:bg-red-900/10">
              <label className="block text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wider">Custom rsync command</label>
              <textarea
                value={jobConfig.customCommand ?? ''}
                onChange={e => setJobConfig({ ...jobConfig, customCommand: e.target.value })}
                placeholder="rsync -a --{source} {dest}"
                className="w-full px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-300 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900 font-mono text-xs min-h-[70px] placeholder:text-gray-400 dark:placeholder:text-gray-600"
              />
              <p className="text-xs text-red-600 dark:text-red-300">
                Overrides presets. Use carefully.
              </p>
            </div>
          )}

          {/* Schedule Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Schedule</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Manual', val: null, icon: Icons.Play },
                { label: 'Heartbeat', val: 5, icon: Icons.Activity },
                { label: 'Hourly', val: 60, icon: Icons.Clock },
                { label: 'Daily', val: 1440, icon: Icons.Sun },
                { label: 'Weekly', val: 10080, icon: Icons.Calendar },
              ].map((opt) => (
                <div key={opt.label} className="relative group">
                  <button
                    onClick={() => setJobSchedule(opt.val)}
                    className={`w-full h-full px-3 py-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center justify-center gap-2 ${jobSchedule === opt.val
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                  >
                    <opt.icon size={20} />
                    {opt.label}
                  </button>

                  {/* Heartbeat Tooltip */}
                  {opt.val === 5 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 hidden group-hover:block animate-fade-in z-50">
                      <div className="bg-gray-900 text-white text-xs p-2.5 rounded-lg shadow-xl text-center relative">
                        Checks for changes every 5 minutes. Ideal for active projects.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Exclude Patterns */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Exclude Patterns</label>
            <div
              className="min-h-[3.5rem] p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-wrap gap-2 items-center focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100 dark:focus:within:ring-amber-900 transition-all cursor-text"
              onClick={() => document.getElementById('pattern-input')?.focus()}
            >
              {jobConfig.excludePatterns.map((p, i) => (
                <span key={i} className="bg-gray-100 dark:bg-gray-700 pl-3 pr-2 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2 animate-fade-in">
                  {p}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setJobConfig(prev => ({ ...prev, excludePatterns: prev.excludePatterns.filter((_, idx) => idx !== i) }));
                    }}
                    className="hover:text-red-500 text-gray-400 transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 p-0.5"
                  >
                    <Icons.XCircle size={14} />
                  </button>
                </span>
              ))}
              <input
                id="pattern-input"
                type="text"
                value={tempExcludePattern}
                onChange={(e) => setTempExcludePattern(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={jobConfig.excludePatterns.length === 0 ? "Type pattern (e.g. *.log) & press Enter" : ""}
                className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white min-w-[150px] h-8 px-1"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 pl-1">Type a file pattern and press Enter to add it.</p>
          </div>

          {/* Advanced Command */}
          <div className="space-y-4" />

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-3 sticky bottom-0">
          <div>
            {isEditing && onDelete && (
              <button
                onClick={onDelete}
                className="px-4 py-2.5 rounded-xl font-medium text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
              >
                <Icons.Trash2 size={18} />
                <span className="hidden sm:inline">Delete Job</span>
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="px-6 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">Cancel</button>
            <button
              onClick={onSave}
              disabled={!jobName || !jobSource || !jobDest}
              className="px-6 py-2.5 rounded-xl font-medium text-white bg-black dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
