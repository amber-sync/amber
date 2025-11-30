import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SyncJob, JobStatus, RsyncConfig, SyncMode, DestinationType } from '../types';
import { generateUniqueId } from '../utils/idGenerator';
import { useTheme } from './ThemeContext';
import { api } from '../api';

interface AppContextType {
  jobs: SyncJob[];
  activeJobId: string | null;
  view:
    | 'DASHBOARD'
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

const DEFAULT_CONFIG: RsyncConfig = {
  recursive: true,
  archive: true,
  compress: true,
  delete: true,
  verbose: true,
  excludePatterns: [],
  customFlags: '',
  customCommand: undefined,
};

const SANDBOX_JOB: SyncJob = {
  id: 'sandbox-auto',
  name: 'Sandbox Test',
  sourcePath: '/Users/florianmahner/Desktop/amber-sandbox/source',
  destPath: '/Users/florianmahner/Desktop/amber-sandbox/dest',
  mode: SyncMode.TIME_MACHINE,
  scheduleInterval: null,
  config: { ...DEFAULT_CONFIG, delete: true },
  sshConfig: { enabled: false },
  destinationType: DestinationType.LOCAL,
  lastRun: null,
  status: JobStatus.IDLE,
  snapshots: [],
};

const normalizeJobFromStore = (job: any): SyncJob => ({
  id: job.id,
  name: job.name,
  sourcePath: job.sourcePath,
  destPath: job.destPath,
  mode: job.mode,
  scheduleInterval: job.scheduleInterval ?? null,
  config: {
    ...DEFAULT_CONFIG,
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
    'DASHBOARD' | 'JOB_EDITOR' | 'DETAIL' | 'HISTORY' | 'APP_SETTINGS' | 'HELP' | 'RESTORE_WIZARD'
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
        console.error('Failed to load preferences:', err);
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
      .catch(err => console.error('Failed to save preferences:', err));
  }, [runInBackground, startOnBoot, notificationsEnabled, prefsLoaded]);

  // Load jobs
  useEffect(() => {
    const loadJobs = async () => {
      console.log('AppContext: Loading jobs...');

      try {
        const stored = await api.getJobs();
        console.log('AppContext: Stored jobs:', stored);
        const normalized = Array.isArray(stored) ? stored.map(normalizeJobFromStore) : [];

        const isDev = await api.isDev();
        console.log('AppContext: isDev:', isDev);

        if (isDev) {
          console.log('AppContext: Dev mode detected. Checking for sandbox job...');

          // Check if we already have a sandbox job
          const existingSandbox = normalized.find(j => j.id === SANDBOX_JOB.id);

          if (!existingSandbox) {
            console.log('AppContext: Sandbox job not found. Creating it...');
            // If not found, add it and save it
            await api.saveJob(stripSnapshotsForStore(SANDBOX_JOB));

            // Scan for snapshots immediately
            console.log('AppContext: Scanning for snapshots...');
            const snapshots = await api.listSnapshots(SANDBOX_JOB.id, SANDBOX_JOB.destPath);
            console.log('AppContext: Snapshots found:', snapshots.length);
            const jobWithSnapshots = { ...SANDBOX_JOB, snapshots };

            setJobs([jobWithSnapshots]);
            setActiveJobId(SANDBOX_JOB.id);
          } else {
            console.log('AppContext: Sandbox job found. Refreshing snapshots...');
            // If found, use stored but refresh snapshots
            const snapshots = await api.listSnapshots(existingSandbox.id, existingSandbox.destPath);
            console.log('AppContext: Snapshots found:', snapshots.length);
            const updatedJob = { ...existingSandbox, snapshots };

            setJobs([updatedJob]);
            setActiveJobId(updatedJob.id);
          }
        } else {
          setJobs(normalized);
          setActiveJobId(normalized[0]?.id ?? null);
        }
      } catch (err) {
        console.error('AppContext: Error loading jobs:', err);
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
      console.error('Failed to persist job', error);
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
      console.error('Failed to delete job', error);
    }
  }, []);

  const runSync = (jobId: string) => {
    console.warn('runSync not implemented in context yet');
  };
  const stopSync = (jobId: string) => {
    console.warn('stopSync not implemented in context yet');
  };

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
