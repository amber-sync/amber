import { DestinationType, JobStatus, type CloudConfig, type SyncJob, type SyncMode } from '@/types';

interface CloudFormInput {
  remoteName: string;
  remotePath?: string;
  encrypt: boolean;
  bandwidth?: string;
}

export interface JobFormSaveInput {
  name: string;
  sourcePath: string;
  destPath: string;
  mode: SyncMode;
  destinationType: DestinationType;
  scheduleInterval: number | null;
  schedule?: SyncJob['schedule'];
  config: SyncJob['config'];
  sshConfig?: SyncJob['sshConfig'];
  cloud?: CloudFormInput;
}

function buildCloudConfig(
  destinationType: DestinationType,
  cloud?: CloudFormInput
): CloudConfig | undefined {
  if (destinationType !== DestinationType.CLOUD || !cloud) {
    return undefined;
  }

  const remoteName = cloud.remoteName.trim();
  if (!remoteName) {
    return undefined;
  }

  return {
    remoteName,
    remotePath: cloud.remotePath?.trim() || undefined,
    encrypt: cloud.encrypt,
    bandwidth: cloud.bandwidth?.trim() || undefined,
  };
}

export function createJobFromForm(id: string, input: JobFormSaveInput): SyncJob {
  const cloudConfig = buildCloudConfig(input.destinationType, input.cloud);

  return {
    id,
    name: input.name || 'Untitled Job',
    sourcePath: input.sourcePath,
    destPath: input.destPath,
    mode: input.mode,
    destinationType: input.destinationType,
    scheduleInterval: input.scheduleInterval,
    schedule: input.schedule,
    config: input.config,
    sshConfig: input.sshConfig,
    cloudConfig,
    lastRun: null,
    status: JobStatus.IDLE,
    snapshots: [],
  };
}

export function updateJobFromForm(existing: SyncJob, input: JobFormSaveInput): SyncJob {
  return {
    ...existing,
    name: input.name,
    sourcePath: input.sourcePath,
    destPath: input.destPath,
    mode: input.mode,
    destinationType: input.destinationType,
    scheduleInterval: input.scheduleInterval,
    schedule: input.schedule,
    config: input.config,
    sshConfig: input.sshConfig,
    cloudConfig: buildCloudConfig(input.destinationType, input.cloud),
  };
}
