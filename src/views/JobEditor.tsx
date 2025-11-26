import React from 'react';
import { SyncMode, RsyncConfig, SshConfig } from '../types';
import { Icons } from '../components/IconComponents';
import { HelpIconBadge } from '../components/HelpIconBadge';

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
  sshProxyJump: string;
  sshCustomOptions: string;
  tempExcludePattern: string;

  // State setters
  setJobName: (val: string) => void;
  setJobSource: (val: string) => void;
  setJobDest: (val: string) => void;
  setJobSchedule: (val: number | null) => void;
  setJobConfig: (val: RsyncConfig | ((prev: RsyncConfig) => RsyncConfig)) => void;
  setSshEnabled: (val: boolean) => void;
  setSshPort: (val: string) => void;
  setSshKeyPath: (val: string) => void;
  setSshConfigPath: (val: string) => void;
  setSshProxyJump: (val: string) => void;
  setSshCustomOptions: (val: string) => void;
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
  sshProxyJump,
  sshCustomOptions,
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
  setSshProxyJump,
  setSshCustomOptions,
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
  const MODE_ICON_SIZE = 18;

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
      <div className="bg-white dark:bg-gray-900 max-w-5xl w-full rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Form Content */}
        <div className="p-10 overflow-y-auto scrollbar-hide flex-1 relative">
          <button 
            onClick={onCancel} 
            className="absolute top-8 right-8 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors z-10"
          >
            <Icons.X size={28} />
          </button>

          <div className="max-w-6xl mx-auto grid grid-cols-12 gap-8">
            
            {/* Row 1: Identity & Schedule */}
            <div className="col-span-12 md:col-span-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Job Name</label>
              <input
                type="text"
                className="w-full px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition-all font-medium text-sm"
                placeholder="e.g. Project Website Backup"
                value={jobName}
                onChange={e => setJobName(e.target.value)}
              />
            </div>

            <div className="col-span-12 md:col-span-7 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col justify-center">
               <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Schedule</label>
               <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { label: 'Manual', val: null, icon: Icons.Play, desc: 'Run only when clicked' },
                    { label: 'Auto', val: -1, icon: Icons.Zap, desc: 'Run when drive connects' },
                    { label: '5m', val: 5, icon: Icons.Activity, desc: 'Every 5 minutes' },
                    { label: '1h', val: 60, icon: Icons.Clock, desc: 'Every hour' },
                    { label: 'Daily', val: 1440, icon: Icons.Sun, desc: 'Every day at 15:00' },
                    { label: '1w', val: 10080, icon: Icons.Calendar, desc: 'Every week' },
                  ].map((opt) => (
                    <div key={opt.label} className="relative group">
                      <button
                        onClick={() => setJobSchedule(opt.val)}
                        className={`w-full p-3.5 rounded-xl border transition-all flex items-center justify-center ${jobSchedule === opt.val
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 ring-1 ring-amber-400'
                            : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                      >
                        <opt.icon size={22} />
                      </button>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 shadow-lg">
                        {opt.desc}
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Row 2: Source & Dest */}
            <div className="col-span-12 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="flex-1 w-full space-y-3">
                  <label className="block text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-2">
                    <Icons.Server size={14} /> Source
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      className="flex-1 px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 outline-none transition-all font-mono text-sm"
                      placeholder="user@host:/path"
                      value={jobSource}
                      onChange={e => setJobSource(e.target.value)}
                    />
                    <button onClick={() => onSelectDirectory('SOURCE')} className="px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors">
                      <Icons.Folder size={22} />
                    </button>
                  </div>
                </div>

                <div className="text-gray-300 dark:text-gray-600 self-center pt-8">
                  <Icons.ArrowRight size={28} />
                </div>

                <div className="flex-1 w-full space-y-3">
                  <label className="block text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-2">
                    <Icons.HardDrive size={14} /> Destination
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      className="flex-1 px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 outline-none transition-all font-mono text-sm"
                      placeholder="/Volumes/Backup"
                      value={jobDest}
                      onChange={e => setJobDest(e.target.value)}
                    />
                    <button onClick={() => onSelectDirectory('DEST')} className="px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors">
                      <Icons.Folder size={22} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Strategy */}
            <div className="col-span-12 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Sync Strategy</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { m: SyncMode.TIME_MACHINE, label: 'Time Machine', desc: 'Snapshots', icon: Icons.FolderClock },
                  { m: SyncMode.MIRROR, label: 'Mirror', desc: 'Exact Copy', icon: Icons.RefreshCw },
                  { m: SyncMode.ARCHIVE, label: 'Archive', desc: 'Add Only', icon: Icons.Archive },
                ].map((opt) => (
                  <button
                    key={opt.m}
                    onClick={() => onJobModeChange(opt.m)}
                    className={`relative p-5 rounded-xl border text-left transition-all flex items-center gap-4 h-full ${jobMode === opt.m && !customSelected
                        ? `${getModeStyles(opt.m).border} ${getModeStyles(opt.m).bg} ${getModeStyles(opt.m).ring}`
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                  >
                    <div className={`p-2.5 rounded-xl ${jobMode === opt.m && !customSelected ? 'bg-white dark:bg-black/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <opt.icon size={24} className={jobMode === opt.m && !customSelected ? 'text-gray-900 dark:text-white' : 'text-gray-500'} />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white text-sm whitespace-nowrap">{opt.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-1">{opt.desc}</div>
                    </div>
                  </button>
                ))}
                
                <button
                  onClick={() => setJobConfig({ ...jobConfig, customCommand: customSelected ? undefined : '' })}
                  className={`relative p-5 rounded-xl border text-left transition-all flex items-center gap-4 ${customSelected
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10 ring-1 ring-indigo-500'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                >
                  <div className={`p-2.5 rounded-xl ${customSelected ? 'bg-white dark:bg-black/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Icons.Code size={24} className={customSelected ? 'text-indigo-600' : 'text-gray-500'} />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white text-sm whitespace-nowrap">Custom</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-1">Raw Command</div>
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

            {/* Row 4: Exclusions & SSH */}
            <div className="col-span-12 md:col-span-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm h-full flex flex-col">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Exclusions</label>
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  value={tempExcludePattern}
                  onChange={(e) => setTempExcludePattern(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. *.log"
                  className="flex-1 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:border-pink-500 outline-none"
                />
                <button onClick={onAddPattern} className="px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-gray-500 transition-colors">
                  <Icons.Plus size={22} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2.5 content-start flex-1">
                {jobConfig.excludePatterns.map((p, i) => (
                  <span key={i} className="bg-gray-100 dark:bg-gray-800 pl-3 pr-2 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2 border border-gray-200 dark:border-gray-700">
                    {p}
                    <button onClick={(e) => { e.stopPropagation(); setJobConfig(prev => ({ ...prev, excludePatterns: prev.excludePatterns.filter((_, idx) => idx !== i) })); }} className="hover:text-red-500 text-gray-400">
                      <Icons.XCircle size={14} />
                    </button>
                  </span>
                ))}
                {jobConfig.excludePatterns.length === 0 && <span className="text-sm text-gray-400 italic p-1">No patterns added.</span>}
              </div>
            </div>

            <div className={`col-span-12 md:col-span-6 bg-white dark:bg-gray-900 border rounded-2xl p-6 shadow-sm h-full flex flex-col transition-all ${sshEnabled ? 'border-teal-500 ring-1 ring-teal-500' : 'border-gray-100 dark:border-gray-800'}`}>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">SSH Connection</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={sshEnabled} onChange={e => setSshEnabled(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
                </label>
              </div>

              {sshEnabled ? (
                <div className="grid grid-cols-2 gap-4 animate-fade-in flex-1 content-start">
                  <input type="text" placeholder="22" value={sshPort} onChange={e => setSshPort(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:border-teal-500 outline-none" />
                  <input type="text" placeholder="~/.ssh/id_rsa" value={sshKeyPath} onChange={e => setSshKeyPath(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:border-teal-500 outline-none" />
                  <input type="text" placeholder="~/.ssh/config" value={sshConfigPath} onChange={e => setSshConfigPath(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:border-teal-500 outline-none" />
                  <input type="text" placeholder="user@jump-host" value={sshProxyJump} onChange={e => setSshProxyJump(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:border-teal-500 outline-none" />
                  <input type="text" placeholder="-o StrictHostKeyChecking=no" value={sshCustomOptions} onChange={e => setSshCustomOptions(e.target.value)} className="col-span-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:border-teal-500 outline-none font-mono" />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic">
                  Local transfer only. Toggle to enable SSH.
                </div>
              )}
            </div>

          </div>
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
