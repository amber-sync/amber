/**
 * TIM-200: useJobForm hook
 *
 * Encapsulates all job editor form state and logic.
 * Extracted from App.tsx to reduce complexity and improve reusability.
 */

import { useState, useCallback } from 'react';
import { RsyncConfig, SyncMode, SshConfig, DestinationType, SyncJob } from '../types';
import { MODE_PRESETS, DEFAULT_JOB_CONFIG } from '../config';

export interface JobFormState {
  // Basic job fields
  jobName: string;
  jobSource: string;
  jobDest: string;
  jobMode: SyncMode;
  jobSchedule: number | null;
  jobConfig: RsyncConfig;

  // Destination type & cloud config
  destinationType: DestinationType;
  cloudRemoteName: string;
  cloudRemotePath: string;
  cloudEncrypt: boolean;
  cloudBandwidth: string;

  // SSH config
  sshEnabled: boolean;
  sshPort: string;
  sshKeyPath: string;
  sshConfigPath: string;
  sshProxyJump: string;
  sshCustomOptions: string;
}

export interface JobFormActions {
  setJobName: (value: string) => void;
  setJobSource: (value: string) => void;
  setJobDest: (value: string) => void;
  setJobMode: (value: SyncMode) => void;
  setJobSchedule: (value: number | null) => void;
  setJobConfig: (value: RsyncConfig | ((prev: RsyncConfig) => RsyncConfig)) => void;
  setDestinationType: (value: DestinationType) => void;
  setCloudRemoteName: (value: string) => void;
  setCloudRemotePath: (value: string) => void;
  setCloudEncrypt: (value: boolean) => void;
  setCloudBandwidth: (value: string) => void;
  setSshEnabled: (value: boolean) => void;
  setSshPort: (value: string) => void;
  setSshKeyPath: (value: string) => void;
  setSshConfigPath: (value: string) => void;
  setSshProxyJump: (value: string) => void;
  setSshCustomOptions: (value: string) => void;
  resetForm: () => void;
  handleJobModeChange: (mode: SyncMode) => void;
  populateFromJob: (job: SyncJob) => void;
  getSshConfig: () => SshConfig;
  getJobConfig: () => RsyncConfig;
}

export type UseJobFormReturn = JobFormState & JobFormActions;

const DEFAULT_FORM_STATE: JobFormState = {
  jobName: '',
  jobSource: '',
  jobDest: '',
  jobMode: SyncMode.TIME_MACHINE,
  jobSchedule: null,
  jobConfig: { ...DEFAULT_JOB_CONFIG },
  destinationType: DestinationType.LOCAL,
  cloudRemoteName: '',
  cloudRemotePath: '',
  cloudEncrypt: false,
  cloudBandwidth: '',
  sshEnabled: false,
  sshPort: '',
  sshKeyPath: '',
  sshConfigPath: '',
  sshProxyJump: '',
  sshCustomOptions: '',
};

export function useJobForm(): UseJobFormReturn {
  // Basic job fields
  const [jobName, setJobName] = useState(DEFAULT_FORM_STATE.jobName);
  const [jobSource, setJobSource] = useState(DEFAULT_FORM_STATE.jobSource);
  const [jobDest, setJobDest] = useState(DEFAULT_FORM_STATE.jobDest);
  const [jobMode, setJobMode] = useState<SyncMode>(DEFAULT_FORM_STATE.jobMode);
  const [jobSchedule, setJobSchedule] = useState<number | null>(DEFAULT_FORM_STATE.jobSchedule);
  const [jobConfig, setJobConfig] = useState<RsyncConfig>({ ...DEFAULT_FORM_STATE.jobConfig });

  // Destination type & cloud config
  const [destinationType, setDestinationType] = useState<DestinationType>(
    DEFAULT_FORM_STATE.destinationType
  );
  const [cloudRemoteName, setCloudRemoteName] = useState(DEFAULT_FORM_STATE.cloudRemoteName);
  const [cloudRemotePath, setCloudRemotePath] = useState(DEFAULT_FORM_STATE.cloudRemotePath);
  const [cloudEncrypt, setCloudEncrypt] = useState(DEFAULT_FORM_STATE.cloudEncrypt);
  const [cloudBandwidth, setCloudBandwidth] = useState(DEFAULT_FORM_STATE.cloudBandwidth);

  // SSH config
  const [sshEnabled, setSshEnabled] = useState(DEFAULT_FORM_STATE.sshEnabled);
  const [sshPort, setSshPort] = useState(DEFAULT_FORM_STATE.sshPort);
  const [sshKeyPath, setSshKeyPath] = useState(DEFAULT_FORM_STATE.sshKeyPath);
  const [sshConfigPath, setSshConfigPath] = useState(DEFAULT_FORM_STATE.sshConfigPath);
  const [sshProxyJump, setSshProxyJump] = useState(DEFAULT_FORM_STATE.sshProxyJump);
  const [sshCustomOptions, setSshCustomOptions] = useState(DEFAULT_FORM_STATE.sshCustomOptions);

  const resetForm = useCallback(() => {
    setJobName(DEFAULT_FORM_STATE.jobName);
    setJobSource(DEFAULT_FORM_STATE.jobSource);
    setJobDest(DEFAULT_FORM_STATE.jobDest);
    setJobMode(DEFAULT_FORM_STATE.jobMode);
    setJobSchedule(DEFAULT_FORM_STATE.jobSchedule);
    setJobConfig({ ...MODE_PRESETS[SyncMode.TIME_MACHINE], excludePatterns: [] });
    setDestinationType(DEFAULT_FORM_STATE.destinationType);
    setCloudRemoteName(DEFAULT_FORM_STATE.cloudRemoteName);
    setCloudRemotePath(DEFAULT_FORM_STATE.cloudRemotePath);
    setCloudEncrypt(DEFAULT_FORM_STATE.cloudEncrypt);
    setCloudBandwidth(DEFAULT_FORM_STATE.cloudBandwidth);
    setSshEnabled(DEFAULT_FORM_STATE.sshEnabled);
    setSshPort(DEFAULT_FORM_STATE.sshPort);
    setSshKeyPath(DEFAULT_FORM_STATE.sshKeyPath);
    setSshConfigPath(DEFAULT_FORM_STATE.sshConfigPath);
    setSshProxyJump(DEFAULT_FORM_STATE.sshProxyJump);
    setSshCustomOptions(DEFAULT_FORM_STATE.sshCustomOptions);
  }, []);

  const handleJobModeChange = useCallback((mode: SyncMode) => {
    setJobMode(mode);
    setJobConfig(prev => ({
      ...MODE_PRESETS[mode],
      excludePatterns: [...prev.excludePatterns],
      customCommand: undefined,
    }));
  }, []);

  const populateFromJob = useCallback((job: SyncJob) => {
    setJobName(job.name);
    setJobSource(job.sourcePath);
    setJobDest(job.destPath);
    setJobMode(job.mode);
    setJobSchedule(job.scheduleInterval);
    setJobConfig({
      ...MODE_PRESETS[job.mode],
      ...job.config,
      excludePatterns: [...job.config.excludePatterns],
      customCommand: job.config.customCommand || undefined,
      customFlags: job.config.customFlags ?? '',
    });

    if (job.sshConfig) {
      setSshEnabled(job.sshConfig.enabled);
      setSshPort(job.sshConfig.port || '');
      setSshKeyPath(job.sshConfig.identityFile || '');
      setSshConfigPath(job.sshConfig.configFile || '');
      setSshProxyJump(job.sshConfig.proxyJump || '');
      setSshCustomOptions(job.sshConfig.customSshOptions || '');
    } else {
      setSshEnabled(false);
      setSshPort('');
      setSshKeyPath('');
      setSshConfigPath('');
      setSshProxyJump('');
      setSshCustomOptions('');
    }

    if (job.destinationType) {
      setDestinationType(job.destinationType);
    }
    if (job.cloudConfig) {
      setCloudRemoteName(job.cloudConfig.remoteName || '');
      setCloudRemotePath(job.cloudConfig.remotePath || '');
      setCloudEncrypt(job.cloudConfig.encrypt || false);
      setCloudBandwidth(job.cloudConfig.bandwidth || '');
    }
  }, []);

  const getSshConfig = useCallback(
    (): SshConfig => ({
      enabled: sshEnabled,
      port: sshPort,
      identityFile: sshKeyPath,
      configFile: sshConfigPath,
      proxyJump: sshProxyJump,
      customSshOptions: sshCustomOptions,
    }),
    [sshEnabled, sshPort, sshKeyPath, sshConfigPath, sshProxyJump, sshCustomOptions]
  );

  const getJobConfig = useCallback(
    (): RsyncConfig => ({
      ...jobConfig,
      excludePatterns: [...jobConfig.excludePatterns],
      customCommand: jobConfig.customCommand ? jobConfig.customCommand.trim() : undefined,
      customFlags: jobConfig.customFlags ?? '',
    }),
    [jobConfig]
  );

  return {
    // State
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

    // Setters
    setJobName,
    setJobSource,
    setJobDest,
    setJobMode,
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

    // Actions
    resetForm,
    handleJobModeChange,
    populateFromJob,
    getSshConfig,
    getJobConfig,
  };
}
