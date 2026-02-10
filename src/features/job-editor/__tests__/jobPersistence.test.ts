import { describe, it, expect } from 'vitest';
import { DestinationType, JobStatus, SyncMode, type SyncJob } from '@/types';
import { createJobFromForm, updateJobFromForm, type JobFormSaveInput } from '../jobPersistence';

describe('jobPersistence', () => {
  const baseInput: JobFormSaveInput = {
    name: 'Cloud Backup',
    sourcePath: '/Users/test/Documents',
    destPath: '',
    mode: SyncMode.TIME_MACHINE,
    destinationType: DestinationType.CLOUD,
    scheduleInterval: 60,
    schedule: { enabled: true, cron: '0 * * * *' },
    config: {
      recursive: true,
      compress: false,
      archive: true,
      delete: false,
      verbose: true,
      excludePatterns: [],
      customFlags: '',
    },
    sshConfig: { enabled: false },
    cloud: {
      remoteName: 'myS3',
      remotePath: 'amber-backups',
      encrypt: true,
      bandwidth: '10M',
    },
  };

  it('creates cloud job with destinationType and cloudConfig', () => {
    const job = createJobFromForm('job-1', baseInput);

    expect(job.destinationType).toBe(DestinationType.CLOUD);
    expect(job.cloudConfig).toEqual({
      remoteName: 'myS3',
      remotePath: 'amber-backups',
      encrypt: true,
      bandwidth: '10M',
    });
    expect(job.status).toBe(JobStatus.IDLE);
  });

  it('updates existing job to cloud config when destination is cloud', () => {
    const existing: SyncJob = {
      id: 'job-1',
      name: 'Local Backup',
      sourcePath: '/Users/test/Documents',
      destPath: '/Volumes/Backup',
      mode: SyncMode.TIME_MACHINE,
      destinationType: DestinationType.LOCAL,
      scheduleInterval: null,
      config: {
        recursive: true,
        compress: false,
        archive: true,
        delete: false,
        verbose: true,
        excludePatterns: [],
        customFlags: '',
      },
      sshConfig: { enabled: false },
      lastRun: null,
      status: JobStatus.IDLE,
      snapshots: [],
    };

    const updated = updateJobFromForm(existing, baseInput);

    expect(updated.destinationType).toBe(DestinationType.CLOUD);
    expect(updated.cloudConfig).toEqual({
      remoteName: 'myS3',
      remotePath: 'amber-backups',
      encrypt: true,
      bandwidth: '10M',
    });
  });
});
