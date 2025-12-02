import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRsyncJobs } from '../useRsyncJobs';
import { SyncJob, JobStatus, SyncMode, DestinationType } from '../../types';

// Mock generateUniqueId to return predictable IDs
vi.mock('../../utils/idGenerator', () => ({
  generateUniqueId: vi.fn((prefix: string) => `${prefix}-test-123`),
}));

const createMockJob = (overrides: Partial<SyncJob> = {}): SyncJob => ({
  id: 'job-1',
  name: 'Test Job',
  sourcePath: '/source',
  destPath: '/dest',
  mode: SyncMode.TIME_MACHINE,
  status: JobStatus.IDLE,
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
  lastRun: null,
  snapshots: [],
  ...overrides,
});

describe('useRsyncJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty jobs array', () => {
    const { result } = renderHook(() => useRsyncJobs());
    expect(result.current.jobs).toEqual([]);
  });

  it('should initialize with provided jobs', () => {
    const initialJobs = [createMockJob({ id: 'job-1', name: 'Job 1' })];
    const { result } = renderHook(() => useRsyncJobs(initialJobs));

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0].name).toBe('Job 1');
  });

  it('should have null activeJobId initially', () => {
    const { result } = renderHook(() => useRsyncJobs());
    expect(result.current.activeJobId).toBeNull();
  });

  it('should set activeJobId via setActiveJobId', () => {
    const { result } = renderHook(() => useRsyncJobs());

    act(() => {
      result.current.setActiveJobId('job-123');
    });

    expect(result.current.activeJobId).toBe('job-123');
  });

  it('should add a new job via addJob', () => {
    const { result } = renderHook(() => useRsyncJobs());

    act(() => {
      result.current.addJob({
        name: 'New Job',
        sourcePath: '/new/source',
        destPath: '/new/dest',
        mode: SyncMode.MIRROR,
        destinationType: DestinationType.LOCAL,
        scheduleInterval: null,
        config: {
          recursive: true,
          compress: false,
          archive: true,
          delete: true,
          verbose: true,
          excludePatterns: [],
          customFlags: '',
        },
      });
    });

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0].name).toBe('New Job');
    expect(result.current.jobs[0].status).toBe(JobStatus.IDLE);
    expect(result.current.jobs[0].snapshots).toEqual([]);
  });

  it('should update a job via updateJob', () => {
    const initialJobs = [createMockJob({ id: 'job-1', name: 'Original' })];
    const { result } = renderHook(() => useRsyncJobs(initialJobs));

    act(() => {
      result.current.updateJob('job-1', { name: 'Updated Name' });
    });

    expect(result.current.jobs[0].name).toBe('Updated Name');
  });

  it('should delete a job via deleteJob', () => {
    const initialJobs = [
      createMockJob({ id: 'job-1', name: 'Job 1' }),
      createMockJob({ id: 'job-2', name: 'Job 2' }),
    ];
    const { result } = renderHook(() => useRsyncJobs(initialJobs));

    act(() => {
      result.current.deleteJob('job-1');
    });

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0].id).toBe('job-2');
  });

  it('should clear activeJobId when deleting active job', () => {
    const initialJobs = [createMockJob({ id: 'job-1' })];
    const { result } = renderHook(() => useRsyncJobs(initialJobs));

    act(() => {
      result.current.setActiveJobId('job-1');
    });
    expect(result.current.activeJobId).toBe('job-1');

    act(() => {
      result.current.deleteJob('job-1');
    });
    expect(result.current.activeJobId).toBeNull();
  });

  it('should set job status via setJobStatus', () => {
    const initialJobs = [createMockJob({ id: 'job-1', status: JobStatus.IDLE })];
    const { result } = renderHook(() => useRsyncJobs(initialJobs));

    act(() => {
      result.current.setJobStatus('job-1', JobStatus.RUNNING);
    });

    expect(result.current.jobs[0].status).toBe(JobStatus.RUNNING);
  });

  it('should add a snapshot via addSnapshot', () => {
    const initialJobs = [createMockJob({ id: 'job-1' })];
    const { result } = renderHook(() => useRsyncJobs(initialJobs));

    act(() => {
      result.current.addSnapshot('job-1', {
        sizeBytes: 1000,
        fileCount: 10,
      });
    });

    expect(result.current.jobs[0].snapshots).toHaveLength(1);
    expect(result.current.jobs[0].snapshots[0].sizeBytes).toBe(1000);
    expect(result.current.jobs[0].status).toBe(JobStatus.SUCCESS);
    expect(result.current.jobs[0].lastRun).not.toBeNull();
  });

  it('should get a job by id via getJob', () => {
    const initialJobs = [
      createMockJob({ id: 'job-1', name: 'Job 1' }),
      createMockJob({ id: 'job-2', name: 'Job 2' }),
    ];
    const { result } = renderHook(() => useRsyncJobs(initialJobs));

    const job = result.current.getJob('job-2');
    expect(job?.name).toBe('Job 2');
  });

  it('should return null for non-existent job via getJob', () => {
    const { result } = renderHook(() => useRsyncJobs());

    const job = result.current.getJob('non-existent');
    expect(job).toBeNull();
  });

  it('should return null for null id via getJob', () => {
    const { result } = renderHook(() => useRsyncJobs());

    const job = result.current.getJob(null);
    expect(job).toBeNull();
  });

  it('should get active job via getActiveJob', () => {
    const initialJobs = [createMockJob({ id: 'job-1', name: 'Active Job' })];
    const { result } = renderHook(() => useRsyncJobs(initialJobs));

    act(() => {
      result.current.setActiveJobId('job-1');
    });

    const activeJob = result.current.getActiveJob();
    expect(activeJob?.name).toBe('Active Job');
  });

  it('should return null from getActiveJob when no job is active', () => {
    const { result } = renderHook(() => useRsyncJobs());

    const activeJob = result.current.getActiveJob();
    expect(activeJob).toBeNull();
  });

  it('should provide defaultConfig', () => {
    const { result } = renderHook(() => useRsyncJobs());
    expect(result.current.defaultConfig).toBeDefined();
  });
});
