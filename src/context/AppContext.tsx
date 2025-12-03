import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SyncJob, JobStatus, SyncMode, DestinationType } from '../types';
import { api } from '../api';
import { BASE_RSYNC_CONFIG, MODE_PRESETS } from '../config';
import { logger } from '../utils/logger';

interface AppContextType {
  jobs: SyncJob[];
  activeJobId: string | null;
  view:
    | 'DASHBOARD'
    | 'TIMELINE'
    | 'JOB_EDITOR'
    | 'DETAIL'
    | 'HISTORY'
    | 'APP_SETTINGS'
    | 'HELP'
    | 'RESTORE_WIZARD';
  runInBackground: boolean;
  startOnBoot: boolean;
  notificationsEnabled: boolean;

  // Actions
  setJobs: React.Dispatch<React.SetStateAction<SyncJob[]>>;
  setActiveJobId: (id: string | null) => void;
  setView: (
    view:
      | 'DASHBOARD'
      | 'TIMELINE'
      | 'JOB_EDITOR'
      | 'DETAIL'
      | 'HISTORY'
      | 'APP_SETTINGS'
      | 'HELP'
      | 'RESTORE_WIZARD'
  ) => void;
  setRunInBackground: (val: boolean) => void;
  setStartOnBoot: (val: boolean) => void;
  setNotificationsEnabled: (val: boolean) => void;

  // Job Operations
  persistJob: (job: SyncJob) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  runSync: (jobId: string) => void;
  stopSync: (jobId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const normalizeJobFromStore = (job: any): SyncJob => ({
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
    customFlags: '',
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
      const { root, ...rest } = s;
      return rest;
    }) || [];
  return { ...job, snapshots };
};

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [view, setView] = useState<
    | 'DASHBOARD'
    | 'TIMELINE'
    | 'JOB_EDITOR'
    | 'DETAIL'
    | 'HISTORY'
    | 'APP_SETTINGS'
    | 'HELP'
    | 'RESTORE_WIZARD'
  >('DASHBOARD');
  const [runInBackground, setRunInBackground] = useState(false);
  const [startOnBoot, setStartOnBoot] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load preferences
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const prefs = await api.getPreferences();
        setRunInBackground(prefs.runInBackground);
        setStartOnBoot(prefs.startOnBoot);
        setNotificationsEnabled(prefs.notifications);
        setPrefsLoaded(true);
      } catch (err) {
        logger.error('Failed to load preferences', err);
        setPrefsLoaded(true);
      }
    };
    loadPrefs();
  }, []);

  // Persist preferences
  useEffect(() => {
    if (!prefsLoaded) return;
    api
      .setPreferences({
        runInBackground,
        startOnBoot,
        notifications: notificationsEnabled,
      })
      .catch(err => logger.error('Failed to save preferences', err));
  }, [runInBackground, startOnBoot, notificationsEnabled, prefsLoaded]);

  // Load jobs
  useEffect(() => {
    const loadJobs = async () => {
      logger.debug('Loading jobs...');

      try {
        const stored = await api.getJobs();
        logger.debug('Stored jobs loaded', { count: Array.isArray(stored) ? stored.length : 0 });
        const normalized = Array.isArray(stored) ? stored.map(normalizeJobFromStore) : [];

        setJobs(normalized);
        setActiveJobId(normalized[0]?.id ?? null);
      } catch (err) {
        logger.error('Error loading jobs', err);
        setJobs([]);
      }
    };
    loadJobs();
  }, []);

  const persistJob = useCallback(async (job: SyncJob) => {
    try {
      await api.saveJob(stripSnapshotsForStore(job));
      // Re-fetch jobs to stay in sync
      const stored = await api.getJobs();
      const normalized = Array.isArray(stored) ? stored.map(normalizeJobFromStore) : [];
      setJobs(normalized);
    } catch (error) {
      logger.error('Failed to persist job', error);
    }
  }, []);

  const deleteJob = useCallback(async (jobId: string) => {
    try {
      await api.deleteJob(jobId);
      // Re-fetch jobs to stay in sync
      const stored = await api.getJobs();
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

      // Update job status to RUNNING
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

  return (
    <AppContext.Provider
      value={{
        jobs,
        activeJobId,
        view,
        runInBackground,
        startOnBoot,
        notificationsEnabled,
        setJobs,
        setActiveJobId,
        setView,
        setRunInBackground,
        setStartOnBoot,
        setNotificationsEnabled,
        persistJob,
        deleteJob,
        runSync,
        stopSync,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppContextProvider');
  }
  return context;
};
