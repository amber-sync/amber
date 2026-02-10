import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { SyncJob, JobStatus, DestinationType } from '@/types';
import type { RsyncStartedPayload, RsyncCompletePayload } from '@/types';
import { api } from '@/api';
import { onRsyncStarted, onRsyncComplete } from '@/api/rsync';
import { BASE_RSYNC_CONFIG } from '@/config';
import { logger } from '@/utils/logger';

interface JobsContextType {
  jobs: SyncJob[];
  setJobs: React.Dispatch<React.SetStateAction<SyncJob[]>>;
  persistJob: (job: SyncJob) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  runSync: (jobId: string) => void;
  stopSync: (jobId: string) => void;
  refreshJobs: () => Promise<void>;
}

const JobsContext = createContext<JobsContextType | undefined>(undefined);

type StoredJob = Omit<SyncJob, 'config' | 'sshConfig' | 'snapshots'> & {
  config?: Partial<SyncJob['config']>;
  sshConfig?: SyncJob['sshConfig'];
  snapshots?: SyncJob['snapshots'];
  destinationType?: DestinationType;
  status?: JobStatus;
  scheduleInterval?: number | null;
  lastRun?: number | null;
};

const normalizeJobFromStore = (job: StoredJob): SyncJob => ({
  id: job.id,
  name: job.name,
  sourcePath: job.sourcePath,
  destPath: job.destPath,
  mode: job.mode,
  scheduleInterval: job.scheduleInterval ?? null,
  config: {
    ...BASE_RSYNC_CONFIG,
    ...job.config,
    excludePatterns: job.config?.excludePatterns ?? [],
    customCommand: job.config?.customCommand,
    customFlags: job.config?.customFlags ?? '',
  },
  sshConfig: job.sshConfig ?? { enabled: false },
  destinationType: job.destinationType ?? DestinationType.LOCAL,
  cloudConfig: job.cloudConfig,
  lastRun: job.lastRun ?? null,
  status: job.status ?? JobStatus.IDLE,
  snapshots: job.snapshots ?? [],
});

const stripSnapshotsForStore = (job: SyncJob) => {
  const snapshots =
    job.snapshots?.map(s => {
      const { root: _ignoredRoot, ...rest } = s;
      void _ignoredRoot;
      return rest;
    }) || [];
  return { ...job, snapshots };
};

export const JobsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<SyncJob[]>([]);

  const loadJobs = useCallback(async () => {
    logger.debug('Loading jobs...');

    try {
      // Use getJobsWithStatus to get jobs WITH snapshot data from manifests
      const stored = await api.getJobsWithStatus();
      logger.debug('Stored jobs loaded', { count: Array.isArray(stored) ? stored.length : 0 });
      const normalized = Array.isArray(stored) ? stored.map(normalizeJobFromStore) : [];

      setJobs(normalized);
    } catch (err) {
      logger.error('Error loading jobs', err);
      setJobs([]);
    }
  }, []);

  // Load jobs with mount status and snapshots from manifests
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Listen for rsync events so tray-initiated backups reflect in the frontend
  const loadJobsRef = useRef(loadJobs);
  loadJobsRef.current = loadJobs;

  useEffect(() => {
    // Immediately mark job as RUNNING when backend emits rsync-started
    const unlistenStarted = onRsyncStarted((data: RsyncStartedPayload) => {
      setJobs(prev =>
        prev.map(j =>
          j.id === data.jobId && j.status !== JobStatus.RUNNING
            ? { ...j, status: JobStatus.RUNNING }
            : j
        )
      );
    });

    const unlistenComplete = onRsyncComplete((_data: RsyncCompletePayload) => {
      // Full refresh picks up new snapshots from manifests
      loadJobsRef.current();
    });

    return () => {
      unlistenStarted();
      unlistenComplete();
    };
  }, []);

  const persistJob = useCallback(async (job: SyncJob) => {
    try {
      await api.saveJob(stripSnapshotsForStore(job));
      // Re-fetch jobs to stay in sync (with snapshots from manifests)
      const stored = await api.getJobsWithStatus();
      const normalized = Array.isArray(stored) ? stored.map(normalizeJobFromStore) : [];
      setJobs(normalized);
    } catch (error) {
      logger.error('Failed to persist job', error);
    }
  }, []);

  const deleteJob = useCallback(async (jobId: string) => {
    try {
      await api.deleteJob(jobId);
      // Re-fetch jobs to stay in sync (with snapshots from manifests)
      const stored = await api.getJobsWithStatus();
      const normalized = Array.isArray(stored) ? stored.map(normalizeJobFromStore) : [];
      setJobs(normalized);
    } catch (error) {
      logger.error('Failed to delete job', error);
    }
  }, []);

  const runSync = useCallback(
    (jobId: string) => {
      const job = jobs.find(j => j.id === jobId);
      if (!job) {
        logger.error('runSync: Job not found', { jobId });
        return;
      }

      // Prevent duplicate runs - check if already running
      if (job.status === JobStatus.RUNNING) {
        logger.warn('runSync: Job already running, ignoring duplicate request', { jobId });
        return;
      }

      // Update job status to RUNNING immediately to prevent double-clicks
      setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: JobStatus.RUNNING } : j)));

      // Start the rsync process
      api.runRsync(job).catch(err => {
        logger.error('runSync: Failed to start rsync', { jobId, error: err });
        // Revert status on error
        setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: JobStatus.FAILED } : j)));
      });
    },
    [jobs]
  );

  const stopSync = useCallback(async (jobId: string) => {
    try {
      await api.killRsync(jobId);
      // Update job status to IDLE
      setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: JobStatus.IDLE } : j)));
    } catch (err) {
      logger.error('stopSync: Failed to stop rsync', { jobId, error: err });
    }
  }, []);

  const value = useMemo(
    () => ({
      jobs,
      setJobs,
      persistJob,
      deleteJob,
      runSync,
      stopSync,
      refreshJobs: loadJobs,
    }),
    [jobs, persistJob, deleteJob, runSync, stopSync, loadJobs]
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
};

export const useJobs = () => {
  const context = useContext(JobsContext);
  if (context === undefined) {
    throw new Error('useJobs must be used within a JobsProvider');
  }
  return context;
};
