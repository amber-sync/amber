import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DestinationType, SyncMode } from '@/types';
import { JobEditor } from '../JobEditor';
import type { UseJobFormReturn } from '@/hooks/useJobForm';

function createForm(overrides: Partial<UseJobFormReturn> = {}): UseJobFormReturn {
  const noop = vi.fn();

  return {
    jobName: 'My Job',
    jobSource: '/source',
    jobDest: '/dest',
    jobMode: SyncMode.TIME_MACHINE,
    jobSchedule: null,
    jobConfig: {
      recursive: true,
      compress: false,
      archive: true,
      delete: false,
      verbose: true,
      excludePatterns: [],
      customFlags: '',
    },
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
    setJobName: noop,
    setJobSource: noop,
    setJobDest: noop,
    setJobMode: noop,
    setJobSchedule: noop,
    setJobConfig: noop,
    setDestinationType: noop,
    setCloudRemoteName: noop,
    setCloudRemotePath: noop,
    setCloudEncrypt: noop,
    setCloudBandwidth: noop,
    setSshEnabled: noop,
    setSshPort: noop,
    setSshKeyPath: noop,
    setSshConfigPath: noop,
    setSshProxyJump: noop,
    setSshCustomOptions: noop,
    resetForm: noop,
    handleJobModeChange: noop,
    populateFromJob: noop,
    getSshConfig: () => ({ enabled: false }),
    getJobConfig: () => ({
      recursive: true,
      compress: false,
      archive: true,
      delete: false,
      verbose: true,
      excludePatterns: [],
      customFlags: '',
    }),
    ...overrides,
  };
}

describe('JobEditor', () => {
  it('keeps save disabled for local jobs without destination path', () => {
    const form = createForm({ destinationType: DestinationType.LOCAL, jobDest: '' });

    render(
      <JobEditor
        form={form}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onSelectDirectory={vi.fn()}
        isEditing={false}
      />
    );

    expect(screen.getByRole('button', { name: /create job/i })).toBeDisabled();
  });

  it('allows save for cloud jobs when remote name is present', () => {
    const form = createForm({
      destinationType: DestinationType.CLOUD,
      jobDest: '',
      cloudRemoteName: 'myS3',
    });

    render(
      <JobEditor
        form={form}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onSelectDirectory={vi.fn()}
        isEditing={false}
      />
    );

    expect(screen.getByRole('button', { name: /create job/i })).toBeEnabled();
  });

  it('disables cloud encryption toggle until backend support is implemented', () => {
    const form = createForm({
      destinationType: DestinationType.CLOUD,
      cloudRemoteName: 'myS3',
    });

    render(
      <JobEditor
        form={form}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onSelectDirectory={vi.fn()}
        isEditing={false}
      />
    );

    expect(screen.getByRole('switch', { name: /encrypt transfers/i })).toBeDisabled();
  });
});
