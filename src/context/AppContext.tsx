import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SyncJob, JobStatus, RsyncConfig, SyncMode } from '../types';
import { generateUniqueId } from '../utils/idGenerator';

interface AppContextType {
  jobs: SyncJob[];
  activeJobId: string | null;
  view: 'DASHBOARD' | 'JOB_EDITOR' | 'DETAIL' | 'HISTORY' | 'APP_SETTINGS' | 'HELP';
  darkMode: boolean;
  runInBackground: boolean;
  startOnBoot: boolean;
  notificationsEnabled: boolean;
  
  // Actions
  setJobs: React.Dispatch<React.SetStateAction<SyncJob[]>>;
  setActiveJobId: (id: string | null) => void;
  setView: (view: 'DASHBOARD' | 'JOB_EDITOR' | 'DETAIL' | 'HISTORY' | 'APP_SETTINGS' | 'HELP') => void;
  toggleDarkMode: () => void;
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

const INITIAL_JOBS: SyncJob[] = process.env.NODE_ENV === 'development'
  ? [
      {
        id: 'sandbox-default',
        name: 'Sandbox Default',
        sourcePath: '/tmp/amber-sandbox/source',
        destPath: '/tmp/amber-sandbox/dest',
        mode: SyncMode.TIME_MACHINE,
        scheduleInterval: null,
        config: { ...DEFAULT_CONFIG, delete: true },
        sshConfig: { enabled: false },
        lastRun: null,
        status: JobStatus.IDLE,
        snapshots: [],
      },
    ]
  : [];

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
  lastRun: job.lastRun ?? null,
  status: job.status ?? JobStatus.IDLE,
  snapshots: job.snapshots ?? [],
});

const stripSnapshotsForStore = (job: SyncJob) => {
  const snapshots = job.snapshots?.map(s => {
    const { root, ...rest } = s;
    return rest;
  }) || [];
  return { ...job, snapshots };
};

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'JOB_EDITOR' | 'DETAIL' | 'HISTORY' | 'APP_SETTINGS' | 'HELP'>('DASHBOARD');
  const [darkMode, setDarkMode] = useState(false);
  const [runInBackground, setRunInBackground] = useState(false);
  const [startOnBoot, setStartOnBoot] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load preferences
  useEffect(() => {
    if (window.electronAPI?.getPreferences) {
      window.electronAPI.getPreferences().then((p: any) => {
        setRunInBackground(p.runInBackground);
        setStartOnBoot(p.startOnBoot);
        setNotificationsEnabled(p.notifications);
      }).catch(() => {
        setRunInBackground(false);
        setStartOnBoot(false);
        setNotificationsEnabled(true);
      }).finally(() => setPrefsLoaded(true));
    } else {
      setPrefsLoaded(true);
    }

    let cleanup: (() => void) | undefined;
    if (window.electronAPI?.onNavigate) {
      cleanup = window.electronAPI.onNavigate((targetView: any) => setView(targetView));
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Persist preferences
  useEffect(() => {
    if (!prefsLoaded) return;
    if (window.electronAPI?.setPreferences) {
      window.electronAPI.setPreferences({
        runInBackground,
        startOnBoot,
        notifications: notificationsEnabled,
      });
    }
  }, [runInBackground, startOnBoot, notificationsEnabled, prefsLoaded]);

  // Load jobs
  useEffect(() => {
    const loadJobs = async () => {
      if (process.env.NODE_ENV === 'development' && window.electronAPI) {
        try {
          await window.electronAPI.createSandboxDirs('/tmp/amber-sandbox/source', '/tmp/amber-sandbox/dest');
        } catch (err) {
          console.error('Failed to create sandbox dirs:', err);
        }
      }

      if (window.electronAPI?.getJobs) {
        const stored = await window.electronAPI.getJobs();
        const normalized = Array.isArray(stored) ? stored.map(normalizeJobFromStore) : [];
        
        if (process.env.NODE_ENV === 'development') {
          const initialIds = INITIAL_JOBS.map(j => j.id);
          const missingDefaults = INITIAL_JOBS.filter(def => !normalized.find(n => n.id === def.id));
          
          if (missingDefaults.length > 0) {
            const merged = [...normalized, ...missingDefaults];
            setJobs(merged);
            if (normalized.length === 0) setActiveJobId(merged[0].id);
            else setActiveJobId(normalized[0].id);
            
            missingDefaults.forEach(job => {
               window.electronAPI?.saveJob(stripSnapshotsForStore(job));
            });
          } else {
            setJobs(normalized);
            setActiveJobId(normalized[0]?.id ?? null);
          }
        } else {
          setJobs(normalized);
          setActiveJobId(normalized[0]?.id ?? null);
        }
      } else {
        setJobs(INITIAL_JOBS);
        setActiveJobId(INITIAL_JOBS[0]?.id ?? null);
      }
    };
    loadJobs();
  }, []);

  // Keep main process aware of active job
  useEffect(() => {
    if (window.electronAPI?.setActiveJob && activeJobId) {
      const job = jobs.find(j => j.id === activeJobId);
      if (job) window.electronAPI.setActiveJob(stripSnapshotsForStore(job));
    }
  }, [activeJobId, jobs]);

  const persistJob = useCallback(async (job: SyncJob) => {
    if (!window.electronAPI?.saveJob) return;
    try {
      const result = await window.electronAPI.saveJob(stripSnapshotsForStore(job));
      if (result?.jobs) {
        const normalized = result.jobs.map(normalizeJobFromStore);
        setJobs(normalized);
      }
    } catch (error) {
      console.error('Failed to persist job', error);
    }
  }, []);

  const deleteJob = useCallback(async (jobId: string) => {
    if (!window.electronAPI?.deleteJob) return;
    try {
      const result = await window.electronAPI.deleteJob(jobId);
      if (result?.jobs) {
        const normalized = result.jobs.map(normalizeJobFromStore);
        setJobs(normalized);
      }
    } catch (error) {
      console.error('Failed to delete job', error);
    }
  }, []);

  // Placeholder for runSync/stopSync - these will be connected to the hook in App.tsx or moved here later
  // For now, we'll keep the hook in App.tsx and pass it down, or refactor the hook to be used inside Context
  // To avoid circular dependencies or complex refactors right now, we'll expose empty functions and let App.tsx handle the actual execution logic via props if needed, 
  // OR better: Move useRsyncProgress inside here? 
  // Let's keep it simple: The Context provides state. The App component will still orchestrate the hook for now to minimize risk.
  const runSync = (jobId: string) => { console.warn('runSync not implemented in context yet'); };
  const stopSync = (jobId: string) => { console.warn('stopSync not implemented in context yet'); };

  return (
    <AppContext.Provider value={{
      jobs,
      activeJobId,
      view,
      darkMode,
      runInBackground,
      startOnBoot,
      notificationsEnabled,
      setJobs,
      setActiveJobId,
      setView,
      toggleDarkMode: () => setDarkMode(!darkMode),
      setRunInBackground,
      setStartOnBoot,
      setNotificationsEnabled,
      persistJob,
      deleteJob,
      runSync,
      stopSync
    }}>
      <div className={darkMode ? 'dark' : ''}>
        {children}
      </div>
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
