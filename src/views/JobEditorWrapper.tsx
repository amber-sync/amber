import React from 'react';
import { SyncMode, RsyncConfig, DestinationType } from '../types';
import { JobEditorStepper } from './JobEditorStepper';
import { JobEditorAccordion } from './JobEditorAccordion';
import { JobEditorTwoPanel } from './JobEditorTwoPanel';

export type JobEditorVariant = 'stepper' | 'accordion' | 'twopanel';

interface JobEditorWrapperProps {
  variant?: JobEditorVariant;

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

export const JobEditorWrapper: React.FC<JobEditorWrapperProps> = ({
  variant = 'stepper',
  ...props
}) => {
  switch (variant) {
    case 'stepper':
      return <JobEditorStepper {...props} />;
    case 'accordion':
      return <JobEditorAccordion {...props} />;
    case 'twopanel':
    default:
      return <JobEditorTwoPanel {...props} />;
  }
};
