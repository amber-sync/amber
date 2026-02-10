import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AppContextProvider, useApp } from '../AppContext';
import { api } from '../../api';
import { JobStatus, SyncMode, DestinationType, JobWithStatus } from '../../types';
import React from 'react';

// Default preferences for all tests
const defaultPrefs = {
  runInBackground: false,
  startOnBoot: false,
  notifications: true,
  theme: 'system',
  accentColor: 'blue',
};

// Mock the api module
vi.mock('../../api', () => ({
  api: {
    getPreferences: vi.fn(),
    setPreferences: vi.fn(),
    getJobsWithStatus: vi.fn(),
    saveJob: vi.fn(),
    deleteJob: vi.fn(),
    runRsync: vi.fn(),
    runRclone: vi.fn(),
    killRsync: vi.fn(),
  },
}));

// Mock logger to avoid console noise in tests
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AppContext', () => {
  const mockJob: JobWithStatus = {
    id: 'test-job-1',
    name: 'Test Job',
    sourcePath: '/source',
    destPath: '/dest',
    mode: SyncMode.MIRROR,
    destinationType: DestinationType.LOCAL,
    scheduleInterval: null,
    config: {
      recursive: true,
      compress: false,
      archive: true,
      delete: false,
      verbose: false,
      excludePatterns: [],
      customFlags: '',
    },
    lastRun: null,
    status: JobStatus.IDLE,
    snapshots: [],
    mounted: true,
    isExternal: false,
    snapshotSource: 'none',
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppContextProvider>{children}</AppContextProvider>
  );

  beforeEach(() => {
    // Reset call counts but keep implementations
    vi.mocked(api.getPreferences).mockClear();
    vi.mocked(api.setPreferences).mockClear();
    vi.mocked(api.getJobsWithStatus).mockClear();
    vi.mocked(api.saveJob).mockClear();
    vi.mocked(api.deleteJob).mockClear();
    vi.mocked(api.runRsync).mockClear();
    vi.mocked(api.runRclone).mockClear();
    vi.mocked(api.killRsync).mockClear();

    // Set default implementations
    vi.mocked(api.getPreferences).mockResolvedValue(defaultPrefs);

    // setPreferences MUST return a promise that resolves to AppPreferences
    vi.mocked(api.setPreferences).mockImplementation(async prefs => ({
      ...defaultPrefs,
      ...prefs,
    }));

    vi.mocked(api.getJobsWithStatus).mockResolvedValue([]);
    vi.mocked(api.saveJob).mockResolvedValue(undefined);
    vi.mocked(api.deleteJob).mockResolvedValue(undefined);
    vi.mocked(api.runRsync).mockResolvedValue(undefined);
    vi.mocked(api.runRclone).mockResolvedValue(undefined);
    vi.mocked(api.killRsync).mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('should load preferences on mount', async () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(api.getPreferences).toHaveBeenCalledTimes(1);
      });

      expect(result.current.runInBackground).toBe(false);
      expect(result.current.startOnBoot).toBe(false);
      expect(result.current.notificationsEnabled).toBe(true);
    });

    it('should load jobs on mount', async () => {
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([mockJob]);

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      expect(result.current.jobs[0].id).toBe('test-job-1');
    });

    it('should set first job as active on mount', async () => {
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([mockJob]);

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.activeJobId).toBe('test-job-1');
      });
    });

    it('should handle empty jobs list gracefully', async () => {
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([]);

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(0);
        expect(result.current.activeJobId).toBe(null);
      });
    });
  });

  describe('runSync', () => {
    it('should update job status to RUNNING when starting sync', async () => {
      const runningJob = { ...mockJob, status: JobStatus.IDLE };
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([runningJob]);

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      act(() => {
        result.current.runSync('test-job-1');
      });

      // Job status should be updated to RUNNING immediately
      await waitFor(() => {
        const job = result.current.jobs.find(j => j.id === 'test-job-1');
        expect(job?.status).toBe(JobStatus.RUNNING);
      });

      // API should be called
      expect(api.runRsync).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-job-1' }));
    });

    it('should route cloud jobs to runRclone', async () => {
      const cloudJob = {
        ...mockJob,
        destinationType: DestinationType.CLOUD,
        cloudConfig: {
          remoteName: 'myS3',
          remotePath: 'amber',
          encrypt: false,
          bandwidth: '10M',
        },
      };
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([cloudJob]);

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      act(() => {
        result.current.runSync('test-job-1');
      });

      await waitFor(() => {
        const job = result.current.jobs.find(j => j.id === 'test-job-1');
        expect(job?.status).toBe(JobStatus.RUNNING);
      });

      expect(api.runRclone).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-job-1' }));
      expect(api.runRsync).not.toHaveBeenCalled();
    });

    it('should prevent duplicate calls when job is already RUNNING', async () => {
      const runningJob = { ...mockJob, status: JobStatus.RUNNING };
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([runningJob]);

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      // Try to run sync on already running job
      act(() => {
        result.current.runSync('test-job-1');
      });

      // API should NOT be called
      expect(api.runRsync).not.toHaveBeenCalled();

      // Status should remain RUNNING
      const job = result.current.jobs.find(j => j.id === 'test-job-1');
      expect(job?.status).toBe(JobStatus.RUNNING);
    });

    it('should prevent duplicate calls from rapid successive clicks', async () => {
      const idleJob = { ...mockJob, status: JobStatus.IDLE };
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([idleJob]);

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      // First call - should succeed
      act(() => {
        result.current.runSync('test-job-1');
      });

      // Wait for status to update to RUNNING
      await waitFor(() => {
        const job = result.current.jobs.find(j => j.id === 'test-job-1');
        expect(job?.status).toBe(JobStatus.RUNNING);
      });

      // Second call while running - should be ignored
      act(() => {
        result.current.runSync('test-job-1');
      });

      // API should only be called once
      expect(api.runRsync).toHaveBeenCalledTimes(1);
    });

    it('should revert to FAILED status on API error', async () => {
      const idleJob = { ...mockJob, status: JobStatus.IDLE };
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([idleJob]);
      vi.mocked(api.runRsync).mockRejectedValue(new Error('Failed to start rsync'));

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      act(() => {
        result.current.runSync('test-job-1');
      });

      // Status should initially be RUNNING
      await waitFor(() => {
        const job = result.current.jobs.find(j => j.id === 'test-job-1');
        expect(job?.status).toBe(JobStatus.RUNNING);
      });

      // After error, status should revert to FAILED
      await waitFor(() => {
        const job = result.current.jobs.find(j => j.id === 'test-job-1');
        expect(job?.status).toBe(JobStatus.FAILED);
      });
    });

    it('should handle job not found gracefully', async () => {
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([mockJob]);

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      // Try to run sync on non-existent job
      act(() => {
        result.current.runSync('non-existent-job');
      });

      // API should not be called
      expect(api.runRsync).not.toHaveBeenCalled();
    });
  });

  describe('stopSync', () => {
    it('should call killRsync API when stopping sync', async () => {
      const runningJob = { ...mockJob, status: JobStatus.RUNNING };
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([runningJob]);

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      await act(async () => {
        await result.current.stopSync('test-job-1');
      });

      expect(api.killRsync).toHaveBeenCalledWith('test-job-1');
    });

    it('should update job status to IDLE after stopping', async () => {
      const runningJob = { ...mockJob, status: JobStatus.RUNNING };
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([runningJob]);

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      await act(async () => {
        await result.current.stopSync('test-job-1');
      });

      // Status should be updated to IDLE
      await waitFor(() => {
        const job = result.current.jobs.find(j => j.id === 'test-job-1');
        expect(job?.status).toBe(JobStatus.IDLE);
      });
    });

    it('should handle killRsync API errors gracefully', async () => {
      const runningJob = { ...mockJob, status: JobStatus.RUNNING };
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([runningJob]);
      vi.mocked(api.killRsync).mockRejectedValue(new Error('Failed to kill rsync'));

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      // stopSync should not throw when API fails
      await act(async () => {
        await result.current.stopSync('test-job-1');
      });

      // When killRsync fails, the status update doesn't happen (it's after the await)
      // So the job should remain RUNNING
      const job = result.current.jobs.find(j => j.id === 'test-job-1');
      expect(job?.status).toBe(JobStatus.RUNNING);

      // Verify the API was called
      expect(api.killRsync).toHaveBeenCalledWith('test-job-1');
    });
  });

  describe('job management', () => {
    it('should persist job and reload jobs', async () => {
      const updatedJob = { ...mockJob, name: 'Updated Job' };
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([mockJob]);

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      // Mock updated jobs after save
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([updatedJob]);

      await act(async () => {
        await result.current.persistJob(updatedJob);
      });

      expect(api.saveJob).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-job-1',
          name: 'Updated Job',
        })
      );

      await waitFor(() => {
        expect(result.current.jobs[0].name).toBe('Updated Job');
      });
    });

    it('should delete job and reload jobs', async () => {
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([mockJob]);

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      // Mock empty jobs after delete
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([]);

      await act(async () => {
        await result.current.deleteJob('test-job-1');
      });

      expect(api.deleteJob).toHaveBeenCalledWith('test-job-1');

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(0);
      });
    });
  });

  describe('state management', () => {
    it('should update active job ID', async () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      act(() => {
        result.current.setActiveJobId('new-job-id');
      });

      expect(result.current.activeJobId).toBe('new-job-id');
    });

    it('should update view', async () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      act(() => {
        result.current.setView('TIME_MACHINE');
      });

      expect(result.current.view).toBe('TIME_MACHINE');
    });

    it('should update runInBackground preference', async () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(api.getPreferences).toHaveBeenCalled();
      });

      act(() => {
        result.current.setRunInBackground(true);
      });

      expect(result.current.runInBackground).toBe(true);

      // Should persist the change
      await waitFor(() => {
        expect(api.setPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            runInBackground: true,
          })
        );
      });
    });

    it('should update startOnBoot preference', async () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(api.getPreferences).toHaveBeenCalled();
      });

      act(() => {
        result.current.setStartOnBoot(true);
      });

      expect(result.current.startOnBoot).toBe(true);

      await waitFor(() => {
        expect(api.setPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            startOnBoot: true,
          })
        );
      });
    });

    it('should update notifications preference', async () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(api.getPreferences).toHaveBeenCalled();
      });

      act(() => {
        result.current.setNotificationsEnabled(false);
      });

      expect(result.current.notificationsEnabled).toBe(false);

      await waitFor(() => {
        expect(api.setPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            notifications: false,
          })
        );
      });
    });
  });

  describe('error handling', () => {
    it('should handle preferences load error gracefully', async () => {
      vi.mocked(api.getPreferences).mockRejectedValue(new Error('Failed to load'));

      const { result } = renderHook(() => useApp(), { wrapper });

      // Should not throw and use defaults
      await waitFor(() => {
        expect(result.current.runInBackground).toBe(false);
        expect(result.current.startOnBoot).toBe(false);
        expect(result.current.notificationsEnabled).toBe(true);
      });
    });

    it('should handle jobs load error gracefully', async () => {
      vi.mocked(api.getJobsWithStatus).mockRejectedValue(new Error('Failed to load jobs'));

      const { result } = renderHook(() => useApp(), { wrapper });

      // Should set empty jobs array
      await waitFor(() => {
        expect(result.current.jobs).toEqual([]);
      });
    });

    it('should handle persistJob error gracefully', async () => {
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([mockJob]);
      vi.mocked(api.saveJob).mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      // Should not throw
      await act(async () => {
        await expect(result.current.persistJob(mockJob)).resolves.toBeUndefined();
      });
    });

    it('should handle deleteJob error gracefully', async () => {
      vi.mocked(api.getJobsWithStatus).mockResolvedValue([mockJob]);
      vi.mocked(api.deleteJob).mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.jobs).toHaveLength(1);
      });

      // Should not throw
      await act(async () => {
        await expect(result.current.deleteJob('test-job-1')).resolves.toBeUndefined();
      });
    });
  });
});
