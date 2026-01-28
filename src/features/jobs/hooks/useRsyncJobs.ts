import { useState, useCallback } from 'react';
import { SyncJob, JobStatus, Snapshot } from '@/types';
import { generateUniqueId } from '@/utils/idGenerator';
import { DEFAULT_JOB_CONFIG } from '@/config';

export function useRsyncJobs(initialJobs: SyncJob[] = []) {
  const [jobs, setJobs] = useState<SyncJob[]>(initialJobs);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const addJob = useCallback(
    (jobData: Omit<SyncJob, 'id' | 'status' | 'lastRun' | 'snapshots'>) => {
      const newJob: SyncJob = {
        ...jobData,
        id: generateUniqueId('job'),
        status: JobStatus.IDLE,
        lastRun: null,
        snapshots: [],
      };
      setJobs(prev => [...prev, newJob]);
      return newJob.id;
    },
    []
  );

  const updateJob = useCallback((jobId: string, updates: Partial<SyncJob>) => {
    setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, ...updates } : j)));
  }, []);

  const deleteJob = useCallback(
    (jobId: string) => {
      setJobs(prev => prev.filter(j => j.id !== jobId));
      if (activeJobId === jobId) {
        setActiveJobId(null);
      }
    },
    [activeJobId]
  );

  const setJobStatus = useCallback((jobId: string, status: JobStatus) => {
    setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status } : j)));
  }, []);

  const addSnapshot = useCallback((jobId: string, snapshot: Partial<Snapshot>) => {
    setJobs(prev =>
      prev.map(j => {
        if (j.id === jobId) {
          const newSnapshot: Snapshot = {
            id: generateUniqueId('snap'),
            status: 'Complete',
            changesCount: 0,
            sizeBytes: 0,
            fileCount: 0,
            root: [],
            timestamp: Date.now(),
            ...snapshot,
          };
          return {
            ...j,
            snapshots: [...(j.snapshots ?? []), newSnapshot],
            lastRun: Date.now(),
            status: JobStatus.SUCCESS,
          };
        }
        return j;
      })
    );
  }, []);

  const getJob = useCallback(
    (jobId: string | null) => {
      if (!jobId) return null;
      return jobs.find(j => j.id === jobId) || null;
    },
    [jobs]
  );

  const getActiveJob = useCallback(() => {
    return getJob(activeJobId);
  }, [activeJobId, getJob]);

  return {
    jobs,
    activeJobId,
    setActiveJobId,
    addJob,
    updateJob,
    deleteJob,
    setJobStatus,
    addSnapshot,
    getJob,
    getActiveJob,
    defaultConfig: DEFAULT_JOB_CONFIG,
  };
}
