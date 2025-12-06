/**
 * TIM-200: Job form hook - extracted from App.tsx
 * Manages all job form state, validation, and transformations
 */

import { useState, useCallback } from 'react';
import { SyncJob, SyncMode, RsyncConfig, DestinationType } from '../types';
import { MODE_PRESETS, DEFAULT_JOB_CONFIG } from '../config';

export interface JobFormState {
  // Basic job info
  name: string;
  source: string;
  dest: string;
  mode: SyncMode;
  schedule: number | null;
  config: RsyncConfig;

  // Destination config
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

  // UI helpers
  tempExcludePattern: string;
}

export interface JobFormSetters {
  setName: (name: string) => void;
  setSource: (source: string) => void;
  setDest: (dest: string) => void;
  setMode: (mode: SyncMode) => void;
  setSchedule: (schedule: number | null) => void;
  setConfig: (config: RsyncConfig | ((prev: RsyncConfig) => RsyncConfig)) => void;
  setDestinationType: (type: DestinationType) => void;
  setCloudRemoteName: (name: string) => void;
  setCloudRemotePath: (path: string) => void;
  setCloudEncrypt: (encrypt: boolean) => void;
  setCloudBandwidth: (bandwidth: string) => void;
  setSshEnabled: (enabled: boolean) => void;
  setSshPort: (port: string) => void;
  setSshKeyPath: (path: string) => void;
  setSshConfigPath: (path: string) => void;
  setSshProxyJump: (jump: string) => void;
  setSshCustomOptions: (options: string) => void;
  setTempExcludePattern: (pattern: string) => void;
}

export interface UseJobFormReturn {
  // Form state
  formState: JobFormState;
  setters: JobFormSetters;

  // Actions
  resetForm: () => void;
  populateFromJob: (job: SyncJob) => void;
  handleModeChange: (mode: SyncMode) => void;
  handleAddPattern: () => void;

  // Validation
  canSave: boolean;
}

export function useJobForm(): UseJobFormReturn {
  // Basic job info state
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [dest, setDest] = useState('');
  const [mode, setMode] = useState<SyncMode>(SyncMode.TIME_MACHINE);
  const [schedule, setSchedule] = useState<number | null>(null);
  const [config, setConfig] = useState<RsyncConfig>({ ...DEFAULT_JOB_CONFIG });

  // Destination type & cloud config state
  const [destinationType, setDestinationType] = useState<DestinationType>(DestinationType.LOCAL);
  const [cloudRemoteName, setCloudRemoteName] = useState('');
  const [cloudRemotePath, setCloudRemotePath] = useState('');
  const [cloudEncrypt, setCloudEncrypt] = useState(false);
  const [cloudBandwidth, setCloudBandwidth] = useState('');

  // SSH form state
  const [sshEnabled, setSshEnabled] = useState(false);
  const [sshPort, setSshPort] = useState('');
  const [sshKeyPath, setSshKeyPath] = useState('');
  const [sshConfigPath, setSshConfigPath] = useState('');
  const [sshProxyJump, setSshProxyJump] = useState('');
  const [sshCustomOptions, setSshCustomOptions] = useState('');

  // UI helper state
  const [tempExcludePattern, setTempExcludePattern] = useState('');

  // Reset all form fields to default values
  const resetForm = useCallback(() => {
    setName('');
    setSource('');
    setDest('');
    setMode(SyncMode.TIME_MACHINE);
    setSchedule(null);
    setConfig({ ...MODE_PRESETS[SyncMode.TIME_MACHINE], excludePatterns: [] });
    setDestinationType(DestinationType.LOCAL);
    setCloudRemoteName('');
    setCloudRemotePath('');
    setCloudEncrypt(false);
    setCloudBandwidth('');
    setSshEnabled(false);
    setSshPort('');
    setSshKeyPath('');
    setSshConfigPath('');
    setSshProxyJump('');
    setSshCustomOptions('');
    setTempExcludePattern('');
  }, []);

  // Populate form from existing job (for editing)
  const populateFromJob = useCallback((job: SyncJob) => {
    setName(job.name);
    setSource(job.sourcePath);
    setDest(job.destPath);
    setMode(job.mode);
    setSchedule(job.scheduleInterval);
    setConfig({
      ...MODE_PRESETS[job.mode],
      ...job.config,
      excludePatterns: [...job.config.excludePatterns],
      customCommand: job.config.customCommand || undefined,
      customFlags: '',
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

    setTempExcludePattern('');
  }, []);

  // Handle job mode change (updates config preset)
  const handleModeChange = useCallback(
    (newMode: SyncMode) => {
      setMode(newMode);
      setConfig({
        ...MODE_PRESETS[newMode],
        excludePatterns: [...config.excludePatterns],
        customCommand: undefined,
      });
    },
    [config.excludePatterns]
  );

  // Add pattern to exclude list
  const handleAddPattern = useCallback(() => {
    if (!tempExcludePattern.trim()) return;
    if (config.excludePatterns.includes(tempExcludePattern.trim())) {
      setTempExcludePattern('');
      return;
    }
    setConfig(prev => ({
      ...prev,
      excludePatterns: [...prev.excludePatterns, tempExcludePattern.trim()],
    }));
    setTempExcludePattern('');
  }, [tempExcludePattern, config.excludePatterns]);

  // Validation: can save if source and dest are provided
  const canSave = Boolean(source && dest);

  // Aggregate state and setters
  const formState: JobFormState = {
    name,
    source,
    dest,
    mode,
    schedule,
    config,
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
  };

  const setters: JobFormSetters = {
    setName,
    setSource,
    setDest,
    setMode,
    setSchedule,
    setConfig,
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
  };

  return {
    formState,
    setters,
    resetForm,
    populateFromJob,
    handleModeChange,
    handleAddPattern,
    canSave,
  };
}
