import React from 'react';
import { SyncMode, RsyncConfig, DestinationType } from '../types';
import { Icons } from '../components/IconComponents';
import { CollapsibleSection, TextInput, Toggle, PathInput } from '../components/ui';

interface JobEditorAccordionProps {
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
  { label: 'Manual', value: null },
  { label: 'Hourly', value: 60 },
  { label: 'Daily', value: 1440 },
  { label: 'Weekly', value: 10080 },
];

const SYNC_MODES = [
  {
    mode: SyncMode.MIRROR,
    label: 'Mirror',
    description: 'Exact replica with deletions',
    icon: <Icons.Copy size={20} />,
  },
  {
    mode: SyncMode.ARCHIVE,
    label: 'Archive',
    description: 'Copy only, preserve everything',
    icon: <Icons.Archive size={20} />,
  },
  {
    mode: SyncMode.TIME_MACHINE,
    label: 'Time Machine',
    description: 'Incremental with hard links',
    icon: <Icons.Clock size={20} />,
  },
];

export const JobEditorAccordion: React.FC<JobEditorAccordionProps> = ({
  jobName,
  jobSource,
  jobDest,
  jobMode,
  jobSchedule,
  jobConfig,
  destinationType,
  cloudRemoteName,
  cloudRemotePath,
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

  const isIdentityValid = !!jobName.trim();
  const isPathsValid = !!jobSource.trim() && !!jobDest.trim();
  const canSave = isIdentityValid && isPathsValid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app/80 backdrop-blur-md animate-fade-in">
      <div className="bg-layer-1 w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-float border border-border-base flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-border-base flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {isEditing ? 'Edit Backup Job' : 'Create Backup Job'}
            </h1>
            <p className="text-sm text-text-secondary mt-1">Configure your backup settings</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-layer-2 transition-colors"
          >
            <Icons.X size={24} />
          </button>
        </div>

        {/* Content - Accordion Sections */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {/* Section 1: Identity & Schedule */}
          <CollapsibleSection
            title="Name & Schedule"
            icon={<Icons.Tag size={20} />}
            defaultOpen={true}
            isValid={isIdentityValid}
          >
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                  Job Name
                </label>
                <TextInput
                  value={jobName}
                  onChange={e => setJobName(e.target.value)}
                  placeholder="e.g. Daily Documents Backup"
                  icon={<Icons.Tag size={18} />}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
                  Schedule
                </label>
                <div className="flex flex-wrap gap-2">
                  {SCHEDULE_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setJobSchedule(opt.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        jobSchedule === opt.value
                          ? 'bg-accent-primary text-accent-text'
                          : 'bg-layer-2 text-text-secondary hover:bg-layer-3'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 2: Paths */}
          <CollapsibleSection
            title="Source & Destination"
            icon={<Icons.Folder size={20} />}
            defaultOpen={!isIdentityValid}
            isValid={isPathsValid}
          >
            <div className="space-y-5">
              <PathInput
                label="Source Path"
                value={jobSource}
                onChange={setJobSource}
                onBrowse={() => onSelectDirectory('SOURCE')}
                placeholder="/Users/me/Documents"
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Destination Path
                  </label>
                  <div className="flex bg-layer-2 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDestinationType(DestinationType.LOCAL)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        destinationType === DestinationType.LOCAL
                          ? 'bg-layer-1 text-text-primary shadow-sm'
                          : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      Local
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestinationType(DestinationType.CLOUD)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        destinationType === DestinationType.CLOUD
                          ? 'bg-layer-1 text-text-primary shadow-sm'
                          : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
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
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput
                      value={cloudRemoteName}
                      onChange={e => setCloudRemoteName(e.target.value)}
                      placeholder="Remote name"
                      icon={<Icons.Cloud size={18} />}
                    />
                    <TextInput
                      value={cloudRemotePath}
                      onChange={e => setCloudRemotePath(e.target.value)}
                      placeholder="/backup/path"
                    />
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 3: Strategy */}
          <CollapsibleSection
            title="Sync Strategy"
            icon={<Icons.RefreshCw size={20} />}
            badge={SYNC_MODES.find(m => m.mode === jobMode)?.label}
          >
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {SYNC_MODES.map(({ mode, label, description, icon }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onJobModeChange(mode)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      jobMode === mode
                        ? 'border-accent-primary bg-accent-secondary/20'
                        : 'border-border-base hover:border-border-highlight bg-layer-2'
                    }`}
                  >
                    <div
                      className={`mb-2 ${jobMode === mode ? 'text-accent-primary' : 'text-text-tertiary'}`}
                    >
                      {icon}
                    </div>
                    <h4 className="font-medium text-sm text-text-primary">{label}</h4>
                    <p className="text-2xs text-text-tertiary mt-0.5">{description}</p>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-6 pt-2">
                <Toggle
                  checked={jobConfig.compress}
                  onChange={checked => setJobConfig(prev => ({ ...prev, compress: checked }))}
                  label="Compress"
                  size="sm"
                />
                <Toggle
                  checked={jobConfig.verbose}
                  onChange={checked => setJobConfig(prev => ({ ...prev, verbose: checked }))}
                  label="Verbose logging"
                  size="sm"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 4: Exclusions */}
          <CollapsibleSection
            title="Exclusions"
            icon={<Icons.Filter size={20} />}
            badge={
              jobConfig.excludePatterns.length > 0
                ? `${jobConfig.excludePatterns.length}`
                : undefined
            }
          >
            <div className="space-y-4">
              <div className="flex gap-2">
                <TextInput
                  value={tempExcludePattern}
                  onChange={e => setTempExcludePattern(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add pattern (e.g. *.log, node_modules)"
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
              <div className="flex flex-wrap gap-2">
                {jobConfig.excludePatterns.map((p, i) => (
                  <span
                    key={i}
                    className="bg-layer-2 px-3 py-1.5 rounded-lg text-sm font-medium text-text-secondary flex items-center gap-2"
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
                      <Icons.X size={14} />
                    </button>
                  </span>
                ))}
                {jobConfig.excludePatterns.length === 0 && (
                  <span className="text-sm text-text-tertiary italic">No patterns added</span>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 5: SSH (Optional) */}
          <CollapsibleSection
            title="SSH Connection"
            icon={<Icons.Server size={20} />}
            badge={sshEnabled ? 'Enabled' : undefined}
          >
            <div className="space-y-4">
              <Toggle
                checked={sshEnabled}
                onChange={setSshEnabled}
                label="Enable SSH"
                description="Connect to remote servers via SSH"
              />

              {sshEnabled && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-base animate-fade-in">
                  <TextInput
                    value={sshPort}
                    onChange={e => setSshPort(e.target.value)}
                    placeholder="Port (22)"
                  />
                  <TextInput
                    value={sshKeyPath}
                    onChange={e => setSshKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_rsa"
                  />
                  <TextInput
                    value={sshConfigPath}
                    onChange={e => setSshConfigPath(e.target.value)}
                    placeholder="~/.ssh/config"
                  />
                  <TextInput
                    value={sshProxyJump}
                    onChange={e => setSshProxyJump(e.target.value)}
                    placeholder="user@jump-host"
                  />
                  <TextInput
                    value={sshCustomOptions}
                    onChange={e => setSshCustomOptions(e.target.value)}
                    placeholder="Custom SSH options"
                    variant="mono"
                    className="col-span-2"
                  />
                </div>
              )}
            </div>
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-border-base bg-layer-2 flex items-center justify-between">
          <div>
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2 rounded-xl font-medium text-error hover:bg-error-subtle transition-colors flex items-center gap-2"
              >
                <Icons.Trash2 size={18} />
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl font-medium text-text-secondary hover:bg-layer-3 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="px-5 py-2.5 rounded-xl font-medium text-white bg-gradient-primary hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
