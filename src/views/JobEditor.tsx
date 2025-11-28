import React, { useState } from 'react';
import { SyncMode, RsyncConfig, DestinationType } from '../types';
import { Icons } from '../components/IconComponents';
import { JobIdentityForm } from '../components/job-editor/JobIdentityForm';
import { JobScheduleForm } from '../components/job-editor/JobScheduleForm';
import { JobSourceDestForm } from '../components/job-editor/JobSourceDestForm';
import { JobStrategyForm } from '../components/job-editor/JobStrategyForm';
import { CloudDestinationForm } from '../components/CloudDestinationForm';

interface JobEditorProps {
  // Form state
  jobName: string;
  jobSource: string;
  jobDest: string;
  jobMode: SyncMode;
  jobSchedule: number | null;
  jobConfig: RsyncConfig;
  destinationType: DestinationType;
  cloudRemoteName: string;
  cloudRemotePath: string;
  cloudEncrypt: boolean;
  cloudBandwidth: string;
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
  setDestinationType: (val: DestinationType) => void;
  setCloudRemoteName: (val: string) => void;
  setCloudRemotePath: (val: string) => void;
  setCloudEncrypt: (val: boolean) => void;
  setCloudBandwidth: (val: string) => void;
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
  destinationType,
  cloudRemoteName,
  cloudRemotePath,
  cloudEncrypt,
  cloudBandwidth,
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
  setDestinationType,
  setCloudRemoteName,
  setCloudRemotePath,
  setCloudEncrypt,
  setCloudBandwidth,
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

          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Section 1: General Settings */}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 md:col-span-8">
                <JobIdentityForm jobName={jobName} setJobName={setJobName} />
              </div>
              <div className="col-span-12 md:col-span-4">
                <JobScheduleForm jobSchedule={jobSchedule} setJobSchedule={setJobSchedule} />
              </div>
            </div>

            {/* Section 2: Transfer Paths (Source -> Destination) */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gray-50/50 dark:bg-gray-800/50 px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <Icons.RefreshCw size={18} className="text-teal-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Transfer Paths</h3>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Source */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Source (From)</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={jobSource}
                      onChange={(e) => setJobSource(e.target.value)}
                      placeholder="/Users/me/Documents"
                      className="flex-1 px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:border-teal-500 outline-none transition-all"
                    />
                    <button 
                      onClick={() => onSelectDirectory('SOURCE')} 
                      className="px-5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-gray-500 transition-colors"
                    >
                      <Icons.Folder size={22} />
                    </button>
                  </div>
                </div>

                {/* Arrow separator */}
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800"></div>
                  <div className="text-gray-300 dark:text-gray-600">
                    <Icons.ArrowDown size={20} />
                  </div>
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800"></div>
                </div>

                {/* Destination */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Destination (To)</label>
                    
                    {/* Destination Type Toggle */}
                    <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex text-xs font-medium">
                      <button
                        onClick={() => setDestinationType(DestinationType.LOCAL)}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all ${destinationType === DestinationType.LOCAL ? 'bg-white dark:bg-gray-700 text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                      >
                        <Icons.HardDrive size={14} />
                        Local
                      </button>
                      <button
                        onClick={() => setDestinationType(DestinationType.CLOUD)}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all ${destinationType === DestinationType.CLOUD ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                      >
                        <Icons.Cloud size={14} />
                        Cloud
                      </button>
                    </div>
                  </div>

                  {destinationType === DestinationType.LOCAL ? (
                    <div className="flex gap-3 animate-fade-in">
                      <input
                        type="text"
                        value={jobDest}
                        onChange={(e) => setJobDest(e.target.value)}
                        placeholder="/Volumes/Backup/MyFiles"
                        className="flex-1 px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:border-teal-500 outline-none transition-all"
                      />
                      <button 
                        onClick={() => onSelectDirectory('DEST')} 
                        className="px-5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-gray-500 transition-colors"
                      >
                        <Icons.Folder size={22} />
                      </button>
                    </div>
                  ) : (
                    <div className="animate-fade-in border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10 rounded-xl p-4">
                      <CloudDestinationForm
                        remoteName={cloudRemoteName}
                        remotePath={cloudRemotePath}
                        encrypt={cloudEncrypt}
                        bandwidth={cloudBandwidth}
                        onRemoteNameChange={setCloudRemoteName}
                        onRemotePathChange={setCloudRemotePath}
                        onEncryptChange={setCloudEncrypt}
                        onBandwidthChange={setCloudBandwidth}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Strategy & Advanced */}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12">
                <JobStrategyForm 
                  jobMode={jobMode} 
                  jobConfig={jobConfig} 
                  onJobModeChange={onJobModeChange} 
                  setJobConfig={setJobConfig} 
                />
              </div>

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
