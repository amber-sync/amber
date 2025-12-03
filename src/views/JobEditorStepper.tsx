import React, { useState } from 'react';
import { SyncMode, RsyncConfig, DestinationType } from '../types';
import { Icons } from '../components/IconComponents';
import { GlassPanel, StepIndicator, TextInput, Toggle, PathInput } from '../components/ui';

interface JobEditorStepperProps {
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

const STEPS = [
  { id: 'identity', label: 'Name', description: 'Job identity & schedule' },
  { id: 'paths', label: 'Paths', description: 'Source & destination' },
  { id: 'strategy', label: 'Strategy', description: 'Sync mode & options' },
  { id: 'review', label: 'Review', description: 'Confirm & create' },
];

const SCHEDULE_OPTIONS = [
  { label: 'Manual', value: null },
  { label: 'Hourly', value: 60 },
  { label: 'Daily', value: 1440 },
  { label: 'Weekly', value: 10080 },
];

const SYNC_MODES = [
  {
    mode: SyncMode.TIME_MACHINE,
    label: 'Time Machine',
    description: 'Incremental with hard links',
    icon: <Icons.Clock size={24} />,
  },
  {
    mode: SyncMode.MIRROR,
    label: 'Mirror',
    description: 'Exact replica with deletions',
    icon: <Icons.Copy size={24} />,
  },
  {
    mode: SyncMode.ARCHIVE,
    label: 'Archive',
    description: 'Copy only, preserve everything',
    icon: <Icons.Archive size={24} />,
  },
];

export const JobEditorStepper: React.FC<JobEditorStepperProps> = ({
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
  setTempExcludePattern,
  onSave,
  onCancel,
  onDelete,
  onSelectDirectory,
  onJobModeChange,
  onAddPattern,
  isEditing,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!jobName.trim();
      case 1:
        return !!jobSource.trim() && !!jobDest.trim();
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const canProceed = isStepValid(currentStep);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1 && canProceed) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAddPattern();
    }
    if (e.key === 'Backspace' && !tempExcludePattern && jobConfig.excludePatterns.length > 0) {
      setJobConfig(prev => ({ ...prev, excludePatterns: prev.excludePatterns.slice(0, -1) }));
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                {isEditing ? 'Edit Job' : "Let's name your backup job"}
              </h2>
              <p className="text-text-secondary">
                Give it a memorable name and choose how often to run
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-6">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                  Job Name
                </label>
                <TextInput
                  value={jobName}
                  onChange={e => setJobName(e.target.value)}
                  placeholder="e.g. Daily Documents Backup"
                  icon={<Icons.Tag size={18} />}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
                  Schedule
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {SCHEDULE_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setJobSchedule(opt.value)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        jobSchedule === opt.value
                          ? 'border-accent-primary bg-accent-secondary/20'
                          : 'border-border-base hover:border-border-highlight bg-layer-2'
                      }`}
                    >
                      <span className="font-medium text-text-primary">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-text-primary mb-2">Where are your files?</h2>
              <p className="text-text-secondary">Choose source and destination locations</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <PathInput
                label="Source Path"
                value={jobSource}
                onChange={setJobSource}
                onBrowse={() => onSelectDirectory('SOURCE')}
                placeholder="/Users/me/Documents"
              />

              <div className="flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-layer-2 flex items-center justify-center">
                  <Icons.ArrowDown size={20} className="text-text-tertiary" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Destination
                  </label>
                  <div className="flex bg-layer-2 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDestinationType(DestinationType.LOCAL)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        destinationType === DestinationType.LOCAL
                          ? 'bg-layer-1 text-text-primary shadow-sm'
                          : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      <Icons.HardDrive size={14} className="inline mr-1.5" />
                      Local
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestinationType(DestinationType.CLOUD)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        destinationType === DestinationType.CLOUD
                          ? 'bg-layer-1 text-text-primary shadow-sm'
                          : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      <Icons.Cloud size={14} className="inline mr-1.5" />
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
                  <div className="grid grid-cols-2 gap-4">
                    <TextInput
                      value={cloudRemoteName}
                      onChange={e => setCloudRemoteName(e.target.value)}
                      placeholder="Remote name (e.g. myS3)"
                      icon={<Icons.Cloud size={18} />}
                    />
                    <TextInput
                      value={cloudRemotePath}
                      onChange={e => setCloudRemotePath(e.target.value)}
                      placeholder="/backup/path"
                      icon={<Icons.Folder size={18} />}
                    />
                  </div>
                )}
              </div>

              <GlassPanel variant="subtle" padding="sm" className="mt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icons.Server size={18} className="text-text-tertiary" />
                    <span className="text-sm text-text-secondary">SSH Connection</span>
                  </div>
                  <Toggle checked={sshEnabled} onChange={setSshEnabled} size="sm" />
                </div>
                {sshEnabled && (
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border-base animate-fade-in">
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
                  </div>
                )}
              </GlassPanel>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-text-primary mb-2">How should we sync?</h2>
              <p className="text-text-secondary">Choose your backup strategy and options</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
                  Sync Mode
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {SYNC_MODES.map(({ mode, label, description, icon }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onJobModeChange(mode)}
                      className={`p-5 rounded-2xl border-2 text-left transition-all ${
                        jobMode === mode
                          ? 'border-accent-primary bg-accent-secondary/20'
                          : 'border-border-base hover:border-border-highlight bg-layer-2'
                      }`}
                    >
                      <div
                        className={`mb-3 ${jobMode === mode ? 'text-accent-primary' : 'text-text-tertiary'}`}
                      >
                        {icon}
                      </div>
                      <h4 className="font-semibold text-text-primary">{label}</h4>
                      <p className="text-xs text-text-secondary mt-1">{description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
                  Exclusions
                </label>
                <div className="flex gap-3 mb-3">
                  <TextInput
                    value={tempExcludePattern}
                    onChange={e => setTempExcludePattern(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. *.log, node_modules"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={onAddPattern}
                    className="px-4 bg-layer-2 hover:bg-layer-3 rounded-xl text-text-secondary transition-colors"
                  >
                    <Icons.Plus size={20} />
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
                    <span className="text-sm text-text-tertiary italic">No exclusions added</span>
                  )}
                </div>
              </div>

              <GlassPanel variant="subtle" padding="sm">
                <div className="flex items-center gap-6">
                  <Toggle
                    checked={jobConfig.compress}
                    onChange={checked => setJobConfig(prev => ({ ...prev, compress: checked }))}
                    label="Compress"
                    description="Reduce transfer size"
                    size="sm"
                  />
                  <Toggle
                    checked={jobConfig.verbose}
                    onChange={checked => setJobConfig(prev => ({ ...prev, verbose: checked }))}
                    label="Verbose"
                    description="Detailed logging"
                    size="sm"
                  />
                </div>
              </GlassPanel>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-text-primary mb-2">Review your job</h2>
              <p className="text-text-secondary">
                {isEditing
                  ? 'Confirm your changes'
                  : 'Everything looks good? Create your backup job'}
              </p>
            </div>

            <div className="max-w-xl mx-auto">
              <GlassPanel variant="elevated" padding="lg">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 pb-4 border-b border-border-base">
                    <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                      <Icons.FolderSync size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-primary">
                        {jobName || 'Untitled Job'}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        {SCHEDULE_OPTIONS.find(s => s.value === jobSchedule)?.label || 'Manual'}{' '}
                        backup
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-text-tertiary text-xs uppercase tracking-wider mb-1">
                        Source
                      </p>
                      <p className="text-text-primary font-mono truncate">
                        {jobSource || 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-xs uppercase tracking-wider mb-1">
                        Destination
                      </p>
                      <p className="text-text-primary font-mono truncate">
                        {destinationType === DestinationType.CLOUD
                          ? `${cloudRemoteName}:${cloudRemotePath}`
                          : jobDest || 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-xs uppercase tracking-wider mb-1">
                        Mode
                      </p>
                      <p className="text-text-primary">
                        {SYNC_MODES.find(m => m.mode === jobMode)?.label}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-xs uppercase tracking-wider mb-1">
                        Exclusions
                      </p>
                      <p className="text-text-primary">
                        {jobConfig.excludePatterns.length} pattern
                        {jobConfig.excludePatterns.length !== 1 && 's'}
                      </p>
                    </div>
                  </div>

                  {sshEnabled && (
                    <div className="pt-4 border-t border-border-base">
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Icons.Server size={16} />
                        <span>SSH enabled on port {sshPort || '22'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </GlassPanel>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app/80 backdrop-blur-md animate-fade-in">
      <div className="bg-layer-1 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-float border border-border-base flex flex-col overflow-hidden">
        {/* Header with Step Indicator */}
        <div className="px-10 pt-8 pb-6 border-b border-border-base">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-text-primary">
              {isEditing ? 'Edit Backup Job' : 'Create Backup Job'}
            </h1>
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-layer-2 transition-colors"
            >
              <Icons.X size={24} />
            </button>
          </div>
          <StepIndicator
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={index => {
              if (index < currentStep) setCurrentStep(index);
            }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-10 py-8">{renderStep()}</div>

        {/* Footer */}
        <div className="px-10 py-6 border-t border-border-base bg-layer-2 flex items-center justify-between">
          <div>
            {isEditing && onDelete && currentStep === 3 && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2.5 rounded-xl font-medium text-error hover:bg-error-subtle transition-colors flex items-center gap-2"
              >
                <Icons.Trash2 size={18} />
                Delete Job
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-2.5 rounded-xl font-medium text-text-secondary hover:bg-layer-3 transition-colors"
              >
                Back
              </button>
            )}
            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed}
                className="px-6 py-2.5 rounded-xl font-medium text-white bg-gradient-primary hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={onSave}
                disabled={!canProceed}
                className="px-6 py-2.5 rounded-xl font-medium text-white bg-gradient-primary hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditing ? 'Save Changes' : 'Create Job'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
