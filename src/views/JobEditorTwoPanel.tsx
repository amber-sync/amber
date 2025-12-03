import React from 'react';
import { SyncMode, RsyncConfig, DestinationType } from '../types';
import { Icons } from '../components/IconComponents';
import { GlassPanel, TextInput, Toggle, PathInput, SectionHeader } from '../components/ui';

interface JobEditorTwoPanelProps {
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

const SCHEDULE_OPTIONS = [
  { label: 'Manual', value: null, icon: <Icons.Hand size={16} /> },
  { label: 'Hourly', value: 60, icon: <Icons.Clock size={16} /> },
  { label: 'Daily', value: 1440, icon: <Icons.Calendar size={16} /> },
  { label: 'Weekly', value: 10080, icon: <Icons.CalendarDays size={16} /> },
];

const SYNC_MODES = [
  {
    mode: SyncMode.TIME_MACHINE,
    label: 'Time Machine',
    description: 'Incremental',
    icon: <Icons.Clock size={18} />,
  },
  {
    mode: SyncMode.MIRROR,
    label: 'Mirror',
    description: 'Exact replica',
    icon: <Icons.Copy size={18} />,
  },
  {
    mode: SyncMode.ARCHIVE,
    label: 'Archive',
    description: 'Copy only',
    icon: <Icons.Archive size={18} />,
  },
];

export const JobEditorTwoPanel: React.FC<JobEditorTwoPanelProps> = ({
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
  isEditing,
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

  const canSave = !!jobName.trim() && !!jobSource.trim() && !!jobDest.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app/80 backdrop-blur-md animate-fade-in">
      <div className="bg-layer-1 w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-float border border-border-base flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 border-b border-border-base flex items-center justify-between bg-gradient-surface">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Icons.FolderSync size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">
                {isEditing ? 'Edit Backup Job' : 'New Backup Job'}
              </h1>
              <p className="text-xs text-text-secondary">
                {jobName || 'Configure your backup settings'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-layer-2 transition-colors"
          >
            <Icons.X size={22} />
          </button>
        </div>

        {/* Two Panel Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Essential */}
          <div className="w-1/2 p-6 overflow-y-auto border-r border-border-base">
            <div className="space-y-6">
              {/* Job Name */}
              <div>
                <SectionHeader variant="form-label">Job Name</SectionHeader>
                <TextInput
                  value={jobName}
                  onChange={e => setJobName(e.target.value)}
                  placeholder="e.g. Daily Documents Backup"
                  icon={<Icons.Tag size={18} />}
                />
              </div>

              {/* Source Path */}
              <PathInput
                label="Source"
                value={jobSource}
                onChange={setJobSource}
                onBrowse={() => onSelectDirectory('SOURCE')}
                placeholder="/Users/me/Documents"
              />

              {/* Destination */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <SectionHeader variant="form-label" className="mb-0">
                    Destination
                  </SectionHeader>
                  <div className="flex bg-layer-2 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDestinationType(DestinationType.LOCAL)}
                      className={`px-2.5 py-1 rounded-md text-2xs font-medium transition-all flex items-center gap-1 ${
                        destinationType === DestinationType.LOCAL
                          ? 'bg-layer-1 text-text-primary shadow-sm'
                          : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      <Icons.HardDrive size={12} />
                      Local
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestinationType(DestinationType.CLOUD)}
                      className={`px-2.5 py-1 rounded-md text-2xs font-medium transition-all flex items-center gap-1 ${
                        destinationType === DestinationType.CLOUD
                          ? 'bg-layer-1 text-text-primary shadow-sm'
                          : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      <Icons.Cloud size={12} />
                      Cloud
                    </button>
                  </div>
                </div>

                {destinationType === DestinationType.LOCAL ? (
                  <PathInput
                    value={jobDest}
                    onChange={setJobDest}
                    onBrowse={() => onSelectDirectory('DEST')}
                    placeholder="/Volumes/Backup/MyFiles"
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <TextInput
                        value={cloudRemoteName}
                        onChange={e => setCloudRemoteName(e.target.value)}
                        placeholder="Remote (e.g. myS3)"
                        icon={<Icons.Cloud size={18} />}
                      />
                      <TextInput
                        value={cloudRemotePath}
                        onChange={e => setCloudRemotePath(e.target.value)}
                        placeholder="/backup/path"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <Toggle
                        checked={cloudEncrypt}
                        onChange={setCloudEncrypt}
                        label="Encrypt"
                        size="sm"
                      />
                      <TextInput
                        value={cloudBandwidth}
                        onChange={e => setCloudBandwidth(e.target.value)}
                        placeholder="Bandwidth (e.g. 10M)"
                        className="flex-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sync Mode */}
              <div>
                <SectionHeader variant="form-label">Sync Mode</SectionHeader>
                <div className="grid grid-cols-3 gap-2">
                  {SYNC_MODES.map(({ mode, label, description, icon }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onJobModeChange(mode)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        jobMode === mode
                          ? 'border-accent-primary bg-accent-secondary/20'
                          : 'border-border-base hover:border-border-highlight bg-layer-2'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={
                            jobMode === mode ? 'text-accent-primary' : 'text-text-tertiary'
                          }
                        >
                          {icon}
                        </span>
                        <span className="font-medium text-sm text-text-primary">{label}</span>
                      </div>
                      <p className="text-2xs text-text-tertiary">{description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Advanced */}
          <div className="w-1/2 p-6 overflow-y-auto bg-layer-2/30">
            <div className="space-y-6">
              {/* Schedule */}
              <div>
                <SectionHeader variant="form-label">Schedule</SectionHeader>
                <div className="flex flex-wrap gap-2">
                  {SCHEDULE_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setJobSchedule(opt.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        jobSchedule === opt.value
                          ? 'bg-accent-primary text-accent-text'
                          : 'bg-layer-2 text-text-secondary hover:bg-layer-3'
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exclusions */}
              <div>
                <SectionHeader variant="form-label">Exclusions</SectionHeader>
                <div className="flex gap-2 mb-3">
                  <TextInput
                    value={tempExcludePattern}
                    onChange={e => setTempExcludePattern(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add pattern (e.g. *.log)"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={onAddPattern}
                    className="px-3 bg-layer-2 hover:bg-layer-3 rounded-xl text-text-secondary transition-colors"
                  >
                    <Icons.Plus size={18} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {jobConfig.excludePatterns.map((p, i) => (
                    <span
                      key={i}
                      className="bg-layer-1 px-2.5 py-1 rounded-md text-sm font-medium text-text-secondary flex items-center gap-1.5 border border-border-base"
                    >
                      {p}
                      <button
                        type="button"
                        onClick={() =>
                          setJobConfig(prev => ({
                            ...prev,
                            excludePatterns: prev.excludePatterns.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="hover:text-error text-text-tertiary"
                      >
                        <Icons.X size={12} />
                      </button>
                    </span>
                  ))}
                  {jobConfig.excludePatterns.length === 0 && (
                    <span className="text-sm text-text-tertiary italic">No patterns</span>
                  )}
                </div>
              </div>

              {/* Options */}
              <div>
                <SectionHeader variant="form-label">Options</SectionHeader>
                <div className="space-y-3">
                  <Toggle
                    checked={jobConfig.compress}
                    onChange={checked => setJobConfig(prev => ({ ...prev, compress: checked }))}
                    label="Compression"
                    description="Reduce transfer size"
                  />
                  <Toggle
                    checked={jobConfig.verbose}
                    onChange={checked => setJobConfig(prev => ({ ...prev, verbose: checked }))}
                    label="Verbose logging"
                    description="Detailed output"
                  />
                </div>
              </div>

              {/* SSH */}
              <GlassPanel
                variant="subtle"
                padding="sm"
                className={sshEnabled ? 'ring-1 ring-accent-primary' : ''}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icons.Server size={18} className="text-text-tertiary" />
                    <span className="font-medium text-text-primary text-sm">SSH Connection</span>
                  </div>
                  <Toggle checked={sshEnabled} onChange={setSshEnabled} size="sm" />
                </div>

                {sshEnabled && (
                  <div className="space-y-3 pt-3 border-t border-border-base animate-fade-in">
                    <div className="grid grid-cols-2 gap-3">
                      <TextInput
                        value={sshPort}
                        onChange={e => setSshPort(e.target.value)}
                        placeholder="Port (22)"
                      />
                      <TextInput
                        value={sshKeyPath}
                        onChange={e => setSshKeyPath(e.target.value)}
                        placeholder="Key path"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <TextInput
                        value={sshConfigPath}
                        onChange={e => setSshConfigPath(e.target.value)}
                        placeholder="SSH config"
                      />
                      <TextInput
                        value={sshProxyJump}
                        onChange={e => setSshProxyJump(e.target.value)}
                        placeholder="Proxy jump"
                      />
                    </div>
                    <TextInput
                      value={sshCustomOptions}
                      onChange={e => setSshCustomOptions(e.target.value)}
                      placeholder="Custom SSH options"
                      variant="mono"
                    />
                  </div>
                )}
              </GlassPanel>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border-base bg-layer-2 flex items-center justify-between">
          <div>
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2 rounded-xl font-medium text-error hover:bg-error-subtle transition-colors flex items-center gap-2"
              >
                <Icons.Trash2 size={16} />
                Delete Job
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2 rounded-xl font-medium text-text-secondary hover:bg-layer-3 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="px-5 py-2 rounded-xl font-medium text-white bg-gradient-primary hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
