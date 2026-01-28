/**
 * TIM-190: Unified Job Editor component
 * TIM-217: Improved alignment and consistency
 * TIM-218: Simplified props using form object
 */

import React from 'react';
import { SyncMode, DestinationType } from '../../types';
import { Icons } from '../../components/IconComponents';
import {
  TextInput,
  Toggle,
  PathInput,
  ExclusionPatternEditor,
  COMMON_PATTERNS,
  ScheduleSelector,
  Title,
  Body,
  FormLabel,
  Button,
  IconButton,
  SegmentedControl,
  Card,
} from '../../components/ui';
import { UseJobFormReturn } from '../../hooks/useJobForm';

export interface JobEditorProps {
  /** Form state and actions from useJobForm hook */
  form: UseJobFormReturn;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onSelectDirectory: (target: 'SOURCE' | 'DEST') => void;
  isEditing: boolean;
  /** Shows loading state on save button */
  isSaving?: boolean;
}

const SYNC_MODES = [
  { mode: SyncMode.TIME_MACHINE, label: 'Time Machine', icon: <Icons.Clock size={16} /> },
  { mode: SyncMode.MIRROR, label: 'Mirror', icon: <Icons.Copy size={16} /> },
  { mode: SyncMode.ARCHIVE, label: 'Archive', icon: <Icons.Archive size={16} /> },
];

export const JobEditor: React.FC<JobEditorProps> = ({
  form,
  onSave,
  onCancel,
  onDelete,
  onSelectDirectory,
  isEditing,
  isSaving = false,
}) => {
  // Destructure form state and actions
  const {
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
    handleJobModeChange,
  } = form;
  const canSave = !!jobName.trim() && !!jobSource.trim() && !!jobDest.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app/80 backdrop-blur-md animate-fade-in">
      <div className="bg-layer-1 w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-float border border-border-base flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 border-b border-border-base flex items-center justify-between bg-gradient-surface shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Icons.FolderSync size={20} className="text-white" />
            </div>
            <div>
              <Title level={2}>{isEditing ? 'Edit Backup Job' : 'New Backup Job'}</Title>
              <Body size="sm" color="secondary">
                {jobName || 'Configure your backup settings'}
              </Body>
            </div>
          </div>
          <IconButton label="Close" variant="ghost" size="md" onClick={onCancel}>
            <Icons.X size={22} />
          </IconButton>
        </div>

        {/* Two Panel Content - Both scroll independently */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Left Panel - Essential Settings */}
          <div className="w-1/2 p-6 overflow-y-auto border-r border-border-base">
            <div className="space-y-5">
              {/* Job Name */}
              <div>
                <FormLabel>Job Name</FormLabel>
                <TextInput
                  value={jobName}
                  onChange={e => setJobName(e.target.value)}
                  placeholder="e.g. Daily Documents Backup"
                  icon={<Icons.Tag size={16} />}
                />
              </div>

              {/* Source */}
              <div>
                <FormLabel>Source Folder</FormLabel>
                <PathInput
                  value={jobSource}
                  onChange={setJobSource}
                  onBrowse={() => onSelectDirectory('SOURCE')}
                  placeholder="/Users/me/Documents"
                />
              </div>

              {/* Destination */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <FormLabel className="mb-0">Destination</FormLabel>
                  <SegmentedControl
                    value={destinationType}
                    onChange={setDestinationType}
                    options={[
                      {
                        value: DestinationType.LOCAL,
                        label: 'Local',
                        icon: <Icons.HardDrive size={12} />,
                      },
                      {
                        value: DestinationType.CLOUD,
                        label: 'Cloud',
                        icon: <Icons.Cloud size={12} />,
                      },
                    ]}
                  />
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
                      <div>
                        <FormLabel size="sm">Remote Name</FormLabel>
                        <TextInput
                          value={cloudRemoteName}
                          onChange={e => setCloudRemoteName(e.target.value)}
                          placeholder="e.g. myS3"
                          icon={<Icons.Cloud size={16} />}
                        />
                      </div>
                      <div>
                        <FormLabel size="sm">Remote Path</FormLabel>
                        <TextInput
                          value={cloudRemotePath}
                          onChange={e => setCloudRemotePath(e.target.value)}
                          placeholder="/backup/path"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FormLabel size="sm">Bandwidth Limit</FormLabel>
                        <TextInput
                          value={cloudBandwidth}
                          onChange={e => setCloudBandwidth(e.target.value)}
                          placeholder="e.g. 10M"
                        />
                      </div>
                      <div className="flex items-end pb-1">
                        <Toggle
                          checked={cloudEncrypt}
                          onChange={setCloudEncrypt}
                          label="Encrypt transfers"
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sync Mode */}
              <div>
                <FormLabel>Sync Mode</FormLabel>
                <div className="grid grid-cols-3 gap-2">
                  {SYNC_MODES.map(({ mode, label, icon }) => (
                    <Card
                      key={mode}
                      variant={jobMode === mode ? 'elevated' : 'outlined'}
                      padding="sm"
                      className={`cursor-pointer transition-all ${
                        jobMode === mode
                          ? 'ring-2 ring-accent-primary bg-accent-primary/5'
                          : 'hover:bg-layer-2'
                      }`}
                      onClick={() => handleJobModeChange(mode)}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            jobMode === mode ? 'text-accent-primary' : 'text-text-tertiary'
                          }
                        >
                          {icon}
                        </span>
                        <Body size="sm" weight="medium">
                          {label}
                        </Body>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Advanced Settings */}
          <div className="w-1/2 p-6 overflow-y-auto bg-layer-2/30">
            <div className="space-y-5">
              {/* Schedule */}
              <div>
                <FormLabel>Schedule</FormLabel>
                <ScheduleSelector value={jobSchedule} onChange={setJobSchedule} />
              </div>

              {/* Exclusions */}
              <div>
                <FormLabel>Exclusion Patterns</FormLabel>
                <ExclusionPatternEditor
                  patterns={jobConfig.excludePatterns}
                  onChange={patterns =>
                    setJobConfig(prev => ({ ...prev, excludePatterns: patterns }))
                  }
                  suggestions={[...COMMON_PATTERNS.system, ...COMMON_PATTERNS.logs]}
                />
              </div>

              {/* Options */}
              <div>
                <FormLabel>Transfer Options</FormLabel>
                <Card variant="outlined" padding="md">
                  <div className="space-y-3">
                    <Toggle
                      checked={jobConfig.compress}
                      onChange={checked => setJobConfig(prev => ({ ...prev, compress: checked }))}
                      label="Enable compression"
                      description="Reduce transfer size over network"
                    />
                    <Toggle
                      checked={jobConfig.verbose}
                      onChange={checked => setJobConfig(prev => ({ ...prev, verbose: checked }))}
                      label="Verbose logging"
                      description="Show detailed transfer output"
                    />
                  </div>
                </Card>
              </div>

              {/* SSH Connection */}
              <div>
                <FormLabel>SSH Connection</FormLabel>
                <Card
                  variant="outlined"
                  padding="md"
                  className={sshEnabled ? 'ring-1 ring-accent-primary' : ''}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icons.Server size={16} className="text-text-tertiary" />
                      <Body size="sm" weight="medium">
                        Use SSH tunnel
                      </Body>
                    </div>
                    <Toggle checked={sshEnabled} onChange={setSshEnabled} size="sm" />
                  </div>

                  {sshEnabled && (
                    <div className="mt-4 pt-4 border-t border-border-base space-y-3 animate-fade-in">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <FormLabel size="sm">Port</FormLabel>
                          <TextInput
                            value={sshPort}
                            onChange={e => setSshPort(e.target.value)}
                            placeholder="22"
                          />
                        </div>
                        <div>
                          <FormLabel size="sm">Identity File</FormLabel>
                          <TextInput
                            value={sshKeyPath}
                            onChange={e => setSshKeyPath(e.target.value)}
                            placeholder="~/.ssh/id_rsa"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <FormLabel size="sm">Config File</FormLabel>
                          <TextInput
                            value={sshConfigPath}
                            onChange={e => setSshConfigPath(e.target.value)}
                            placeholder="~/.ssh/config"
                          />
                        </div>
                        <div>
                          <FormLabel size="sm">Proxy Jump</FormLabel>
                          <TextInput
                            value={sshProxyJump}
                            onChange={e => setSshProxyJump(e.target.value)}
                            placeholder="bastion.example.com"
                          />
                        </div>
                      </div>
                      <div>
                        <FormLabel size="sm">Custom Options</FormLabel>
                        <TextInput
                          value={sshCustomOptions}
                          onChange={e => setSshCustomOptions(e.target.value)}
                          placeholder="-o StrictHostKeyChecking=no"
                          variant="mono"
                        />
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border-base bg-layer-2 flex items-center justify-between shrink-0">
          <div>
            {isEditing && onDelete && (
              <Button
                variant="ghost"
                size="md"
                onClick={onDelete}
                icon={<Icons.Trash2 size={16} />}
                className="text-error hover:bg-error-subtle"
              >
                Delete Job
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" size="md" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={onSave}
              disabled={!canSave || isSaving}
              loading={isSaving}
            >
              {isEditing ? 'Save Changes' : 'Create Job'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
