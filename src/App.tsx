import React, { useCallback, useEffect, useState } from 'react';
import { DashboardPage } from './features/dashboard';
import { RestoreWizard } from './features/restore';
import { JobEditor } from './features/job-editor';
import { TimeMachinePage } from './features/time-machine';
import { SettingsPage } from './features/settings';
import { HelpSection } from './components/HelpSection';
import { Sidebar } from './components/layout';
// AmbientBackground removed - using clean page backgrounds
import { DeleteJobModal } from './components/DeleteJobModal';
import { CommandPalette } from './components/CommandPalette';
import { FileSearchPalette } from './components/FileSearchPalette';
import { DevTools } from './components/DevTools';
import { AppContextProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { useRsyncProgress } from './hooks/useRsyncProgress';
import { useDiskStats } from './hooks/useDiskStats';
import { generateUniqueId } from './utils/idGenerator';
import { JobStatus, RsyncConfig, SyncJob, SyncMode, SshConfig, DestinationType } from './types';
import { api } from './api';
import { MODE_PRESETS, DEFAULT_JOB_CONFIG } from './config';
import { logger } from './utils/logger';

function AppContent() {
  const { jobs, activeJobId, view, setJobs, setActiveJobId, setView, persistJob, deleteJob } =
    useApp();

  // TIM-124: Pass activeJobId to filter rsync events to only the current job
  const { isRunning, setIsRunning, logs, progress, clearLogs, addLog } =
    useRsyncProgress(activeJobId);
  const destinationStats = useDiskStats(jobs.map(j => j.destPath));

  // Restore Wizard State
  const [restoreJobId, setRestoreJobId] = useState<string | null>(null);

  // Create/Edit Job Form State
  const [newJobName, setNewJobName] = useState('');
  const [newJobSource, setNewJobSource] = useState('');
  const [newJobDest, setNewJobDest] = useState('');
  const [newJobMode, setNewJobMode] = useState<SyncMode>(SyncMode.TIME_MACHINE);
  const [newJobSchedule, setNewJobSchedule] = useState<number | null>(null);
  const [newJobConfig, setNewJobConfig] = useState<RsyncConfig>({ ...DEFAULT_JOB_CONFIG });

  // Destination Type & Cloud Config State
  const [destinationType, setDestinationType] = useState<DestinationType>(DestinationType.LOCAL);
  const [cloudRemoteName, setCloudRemoteName] = useState('');
  const [cloudRemotePath, setCloudRemotePath] = useState('');
  const [cloudEncrypt, setCloudEncrypt] = useState(false);
  const [cloudBandwidth, setCloudBandwidth] = useState('');

  // SSH Form State
  const [sshEnabled, setSshEnabled] = useState(false);
  const [sshPort, setSshPort] = useState('');
  const [sshKeyPath, setSshKeyPath] = useState('');
  const [sshConfigPath, setSshConfigPath] = useState('');
  const [sshProxyJump, setSshProxyJump] = useState('');
  const [sshCustomOptions, setSshCustomOptions] = useState('');

  // UI Helper State for Form
  const [tempExcludePattern, setTempExcludePattern] = useState('');

  // Delete Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);

  // TIM-141: Track source view for proper navigation after job save
  const [jobEditorSourceView, setJobEditorSourceView] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<string | null>(null);

  // TIM-141: Track view changes to capture source view before JOB_EDITOR
  useEffect(() => {
    if (view === 'JOB_EDITOR' && previousView && previousView !== 'JOB_EDITOR') {
      // When entering JOB_EDITOR, if we didn't go through openSettings, use previousView
      if (!jobEditorSourceView) {
        setJobEditorSourceView(previousView);
      }
      // Also populate form if coming from TIME_MACHINE (which bypasses openSettings)
      if (previousView === 'TIME_MACHINE' && activeJobId) {
        const job = jobs.find(j => j.id === activeJobId);
        if (job && !newJobName) {
          // Populate form fields that openSettings would set
          setNewJobName(job.name);
          setNewJobSource(job.sourcePath);
          setNewJobDest(job.destPath);
          setNewJobMode(job.mode);
          setNewJobSchedule(job.scheduleInterval);
          setNewJobConfig({
            ...MODE_PRESETS[job.mode],
            ...job.config,
            excludePatterns: [...job.config.excludePatterns],
            customCommand: job.config.customCommand || undefined,
            customFlags: '',
          });
          if (job.sshConfig) {
            setSshEnabled(job.sshConfig.enabled);
            setSshPort(job.sshConfig.port || '');
            setSshKeyPath(job.sshConfig.identityFile || '');
            setSshConfigPath(job.sshConfig.configFile || '');
            setSshProxyJump(job.sshConfig.proxyJump || '');
            setSshCustomOptions(job.sshConfig.customSshOptions || '');
          }
        }
      }
    }
    setPreviousView(view);
  }, [view, activeJobId, jobs, previousView, jobEditorSourceView, newJobName]);

  // Dev Tools Panel (Cmd+Shift+D to toggle)
  const [showDevTools, setShowDevTools] = useState(false);

  // Keyboard shortcut for Dev Tools (only in dev mode)
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Shift+D (Mac) or Ctrl+Shift+D (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setShowDevTools(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for rsync completion events
  useEffect(() => {
    const unsubComplete = api.onRsyncComplete(async data => {
      let persistedJob: SyncJob | null = null;
      if (data.success) {
        setJobs(prev =>
          prev.map(j => {
            if (j.id === data.jobId) {
              const snapshots = j.snapshots || [];
              let newSnapshot = (data as any).snapshot;

              if (newSnapshot) {
                newSnapshot = {
                  id: generateUniqueId('snap'),
                  status: 'Complete',
                  changesCount: 0,
                  ...newSnapshot,
                };
              }

              const newSnapshots = newSnapshot ? [...snapshots, newSnapshot] : snapshots;

              const updatedJob = {
                ...j,
                status: JobStatus.SUCCESS,
                lastRun: Date.now(),
                snapshots: newSnapshots,
              };
              persistedJob = updatedJob;
              return updatedJob;
            }
            return j;
          })
        );

        // TIM-46: Index the new snapshot for fast browsing
        const snapshot = (data as any).snapshot;
        if (snapshot?.path && snapshot?.timestamp) {
          try {
            await api.indexSnapshot(data.jobId, snapshot.timestamp, snapshot.path);
            logger.debug('Indexed snapshot', { jobId: data.jobId });
          } catch (err) {
            logger.warn('Failed to index snapshot (non-fatal)', { jobId: data.jobId });
            // Non-fatal - fallback to filesystem scan
          }
        }
      } else {
        setJobs(prev =>
          prev.map(j => (j.id === data.jobId ? { ...j, status: JobStatus.FAILED } : j))
        );
      }

      if (persistedJob) {
        persistJob(persistedJob);
      }
    });

    return () => {
      unsubComplete();
    };
  }, [persistJob, setJobs]);

  const resetForm = () => {
    setNewJobName('');
    setNewJobSource('');
    setNewJobDest('');
    setNewJobMode(SyncMode.TIME_MACHINE);
    setNewJobSchedule(null);
    setNewJobConfig({ ...MODE_PRESETS[SyncMode.TIME_MACHINE], excludePatterns: [] });
    setSshEnabled(false);
    setSshPort('');
    setSshKeyPath('');
    setSshConfigPath('');
    setSshProxyJump('');
    setSshCustomOptions('');
    setTempExcludePattern('');
  };

  const handleJobModeChange = (mode: SyncMode) => {
    setNewJobMode(mode);
    setNewJobConfig({
      ...MODE_PRESETS[mode],
      excludePatterns: [...newJobConfig.excludePatterns],
      customCommand: undefined,
    });
  };

  const openNewJob = () => {
    resetForm();
    setActiveJobId(null);
    handleJobModeChange(SyncMode.TIME_MACHINE);
    setView('JOB_EDITOR');
  };

  const openSettings = (sourceView?: string, jobId?: string) => {
    const targetJobId = jobId || activeJobId;
    if (!targetJobId) return;
    const job = jobs.find(j => j.id === targetJobId);
    if (!job) return;

    // TIM-141: Track where we came from for proper navigation after save
    setJobEditorSourceView(sourceView || view);

    setNewJobName(job.name);
    setNewJobSource(job.sourcePath);
    setNewJobDest(job.destPath);
    setNewJobMode(job.mode);
    setNewJobSchedule(job.scheduleInterval);
    setNewJobConfig({
      ...MODE_PRESETS[job.mode],
      ...job.config,
      excludePatterns: [...job.config.excludePatterns],
      customCommand: job.config.customCommand || undefined,
      customFlags: '',
    });

    if (job.sshConfig) {
      setSshEnabled(job.sshConfig.enabled);
      setSshPort(job.sshConfig.port || '');
      setSshKeyPath(job.sshConfig.identityFile || '');
      setSshConfigPath(job.sshConfig.configFile || '');
      setSshProxyJump(job.sshConfig.proxyJump || '');
      setSshCustomOptions(job.sshConfig.customSshOptions || '');
    } else {
      setSshEnabled(false);
      setSshPort('');
      setSshKeyPath('');
      setSshConfigPath('');
      setSshProxyJump('');
      setSshCustomOptions('');
    }

    setTempExcludePattern('');
    setView('JOB_EDITOR');
  };

  const handleSaveJob = () => {
    const sshConfig: SshConfig = {
      enabled: sshEnabled,
      port: sshPort,
      identityFile: sshKeyPath,
      configFile: sshConfigPath,
      proxyJump: sshProxyJump,
      customSshOptions: sshCustomOptions,
    };

    const jobConfig: RsyncConfig = {
      ...newJobConfig,
      excludePatterns: [...newJobConfig.excludePatterns],
      customCommand: newJobConfig.customCommand ? newJobConfig.customCommand.trim() : undefined,
      customFlags: '',
    };

    const getCronFromInterval = (interval: number | null): string | undefined => {
      if (!interval || interval === -1) return undefined;
      if (interval === 5) return '*/5 * * * *';
      if (interval === 60) return '0 * * * *';
      if (interval === 1440) return '0 15 * * *';
      if (interval === 10080) return '0 0 * * 0';
      return undefined;
    };

    const scheduleConfig = newJobSchedule
      ? {
          enabled: true,
          cron: getCronFromInterval(newJobSchedule),
          runOnMount: newJobSchedule === -1 || true,
        }
      : { enabled: false };

    // TIM-166: Navigate back to source view (use tracked source, fallback to DASHBOARD for new jobs)
    type ViewType =
      | 'DASHBOARD'
      | 'TIME_MACHINE'
      | 'JOB_EDITOR'
      | 'APP_SETTINGS'
      | 'HELP'
      | 'RESTORE_WIZARD';
    const returnView = (jobEditorSourceView ||
      (activeJobId ? 'TIME_MACHINE' : 'DASHBOARD')) as ViewType;

    if (activeJobId) {
      const job = jobs.find(j => j.id === activeJobId);
      if (job) {
        const updatedJob = {
          ...job,
          name: newJobName,
          sourcePath: newJobSource,
          destPath: newJobDest,
          mode: newJobMode,
          scheduleInterval: newJobSchedule,
          schedule: scheduleConfig,
          config: jobConfig,
          sshConfig,
        };
        setJobs(prev => prev.map(j => (j.id === activeJobId ? updatedJob : j)));
        persistJob(updatedJob);
        setView(returnView);
      }
    } else {
      const job: SyncJob = {
        id: generateUniqueId('job'),
        name: newJobName || 'Untitled Job',
        sourcePath: newJobSource,
        destPath: newJobDest,
        mode: newJobMode,
        destinationType: DestinationType.LOCAL, // Default to local, can be changed to cloud later
        scheduleInterval: newJobSchedule,
        schedule: scheduleConfig,
        config: jobConfig,
        sshConfig,
        lastRun: null,
        status: JobStatus.IDLE,
        snapshots: [],
      };
      setJobs(prev => [...prev, job]);
      setActiveJobId(job.id);
      persistJob(job);
      setView(returnView);
    }
    resetForm();
    setJobEditorSourceView(null);
  };

  const promptDelete = (id: string) => {
    setJobToDelete(id);
    setShowDeleteConfirm(true);
  };

  const executeDelete = () => {
    if (jobToDelete) {
      setJobs(prev => prev.filter(j => j.id !== jobToDelete));
      deleteJob(jobToDelete);
      if (activeJobId === jobToDelete) {
        setActiveJobId(null);
        setView('DASHBOARD');
      }
      setShowDeleteConfirm(false);
      setJobToDelete(null);
    }
  };

  const handleAddPattern = () => {
    if (!tempExcludePattern.trim()) return;
    if (newJobConfig.excludePatterns.includes(tempExcludePattern.trim())) {
      setTempExcludePattern('');
      return;
    }
    setNewJobConfig(prev => ({
      ...prev,
      excludePatterns: [...prev.excludePatterns, tempExcludePattern.trim()],
    }));
    setTempExcludePattern('');
  };

  const handleSelectDirectory = async (target: 'SOURCE' | 'DEST') => {
    const path = await api.selectDirectory();
    if (path) {
      if (target === 'SOURCE') setNewJobSource(path);
      else setNewJobDest(path);
    }
  };

  const runSync = useCallback(
    (jobId: string) => {
      const job = jobs.find(j => j.id === jobId);
      if (!job) return;

      setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: JobStatus.RUNNING } : j)));

      setIsRunning(true);
      clearLogs();
      addLog(`Starting sync for ${job.name}...`);

      api.runRsync(job).catch(err => {
        addLog(`Error starting sync: ${err}`, 'error');
        setIsRunning(false);
      });
    },
    [jobs, setIsRunning, clearLogs, addLog, setJobs]
  );

  const stopSync = useCallback(
    async (jobId: string) => {
      addLog('Stopping sync...', 'warning');

      try {
        await api.killRsync(jobId);

        // Update job status to IDLE
        setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: JobStatus.IDLE } : j)));

        // Reset running state
        setIsRunning(false);
        addLog('Sync stopped', 'warning');
      } catch (err) {
        addLog(`Error stopping sync: ${err}`, 'error');
      }
    },
    [addLog, setJobs, setIsRunning]
  );

  const handleOpenRestore = (jobId: string) => {
    setRestoreJobId(jobId);
    setView('RESTORE_WIZARD');
  };

  const handleRestoreFiles = async (files: string[], targetPath: string, snapshot: any) => {
    if (!restoreJobId) return;
    const job = jobs.find(j => j.id === restoreJobId);
    if (!job) return;

    addLog(`Starting restore for ${files.length} files to ${targetPath}...`);

    try {
      // Use snapshot.path for the source
      const result = await api.restoreFiles(job, snapshot.path, files, targetPath);

      if (result.success) {
        // Mark snapshot as restored
        const updatedJob = {
          ...job,
          snapshots: (job.snapshots ?? []).map(s =>
            s.id === snapshot.id ? { ...s, restored: true, restoredDate: Date.now() } : s
          ),
        };
        setJobs(prev => prev.map(j => (j.id === job.id ? updatedJob : j)));
        persistJob(updatedJob);
        addLog(`Successfully restored files to ${targetPath}`);
      } else {
        addLog(`Restore failed: ${result.error}`, 'error');
      }
    } catch (e: any) {
      addLog(`Restore failed: ${e.message}`, 'error');
    }

    setView('TIME_MACHINE');
    setRestoreJobId(null);
  };

  const isTopLevel = ['DASHBOARD', 'TIME_MACHINE', 'APP_SETTINGS', 'HELP'].includes(view);
  const activeJob = activeJobId ? jobs.find(j => j.id === activeJobId) : null;

  return (
    <div className="flex h-screen bg-[var(--page-bg)] text-text-primary font-sans transition-colors duration-300 relative overflow-hidden">
      <div className="fixed top-0 left-0 w-full h-8 z-[100] titlebar-drag" />

      {/* Clean background - no ambient gradients */}

      <CommandPalette />
      <FileSearchPalette />

      {/* Dev Tools - Cmd+Shift+D to toggle */}
      {showDevTools && <DevTools onClose={() => setShowDevTools(false)} />}

      <DeleteJobModal
        isOpen={showDeleteConfirm}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setJobToDelete(null);
        }}
        onConfirm={executeDelete}
      />

      {isTopLevel && <Sidebar activeView={view} onNavigate={setView} />}

      <main className="flex-1 relative z-10 overflow-hidden flex flex-col">
        {/* Dashboard and TimeMachine kept mounted for instant switching */}
        <div
          className="flex-1 overflow-hidden"
          style={{ display: view === 'DASHBOARD' ? 'flex' : 'none' }}
        >
          <DashboardPage
            jobs={jobs}
            diskStats={destinationStats}
            onSelectJob={id => {
              setActiveJobId(id);
              // Navigate to unified Time Machine for the selected job
              setView('TIME_MACHINE');
            }}
            onCreateJob={openNewJob}
            onRunBackup={runSync}
            onEditSettings={id => {
              setActiveJobId(id);
              openSettings('DASHBOARD', id);
            }}
          />
        </div>

        <div
          className="flex-1 overflow-hidden"
          style={{ display: view === 'TIME_MACHINE' ? 'flex' : 'none' }}
        >
          <TimeMachinePage
            initialJobId={activeJobId || undefined}
            isRunning={isRunning}
            progress={progress}
            logs={logs}
          />
        </div>

        <div
          className="flex-1 overflow-hidden"
          style={{ display: view === 'APP_SETTINGS' ? 'flex' : 'none' }}
        >
          <SettingsPage />
        </div>

        {view === 'HELP' && <HelpSection />}

        {view === 'RESTORE_WIZARD' &&
          restoreJobId &&
          (() => {
            const job = jobs.find(j => j.id === restoreJobId);
            if (!job) return null;
            return (
              <RestoreWizard
                job={job}
                onBack={() => {
                  setRestoreJobId(null);
                  setView('TIME_MACHINE');
                }}
                onRestore={handleRestoreFiles}
              />
            );
          })()}

        {view === 'JOB_EDITOR' && (
          <JobEditor
            jobName={newJobName}
            jobSource={newJobSource}
            jobDest={newJobDest}
            jobMode={newJobMode}
            jobSchedule={newJobSchedule}
            jobConfig={newJobConfig}
            destinationType={destinationType}
            cloudRemoteName={cloudRemoteName}
            cloudRemotePath={cloudRemotePath}
            cloudEncrypt={cloudEncrypt}
            cloudBandwidth={cloudBandwidth}
            sshEnabled={sshEnabled}
            sshPort={sshPort}
            sshKeyPath={sshKeyPath}
            sshConfigPath={sshConfigPath}
            sshProxyJump={sshProxyJump}
            sshCustomOptions={sshCustomOptions}
            tempExcludePattern={tempExcludePattern}
            setJobName={setNewJobName}
            setJobSource={setNewJobSource}
            setJobDest={setNewJobDest}
            setJobSchedule={setNewJobSchedule}
            setJobConfig={setNewJobConfig}
            setDestinationType={setDestinationType}
            setCloudRemoteName={setCloudRemoteName}
            setCloudRemotePath={setCloudRemotePath}
            setCloudEncrypt={setCloudEncrypt}
            setCloudBandwidth={setCloudBandwidth}
            setSshEnabled={setSshEnabled}
            setSshPort={setSshPort}
            setSshKeyPath={setSshKeyPath}
            setSshConfigPath={setSshConfigPath}
            setSshProxyJump={setSshProxyJump}
            setSshCustomOptions={setSshCustomOptions}
            setTempExcludePattern={setTempExcludePattern}
            onSave={handleSaveJob}
            onCancel={() => setView(activeJobId ? 'TIME_MACHINE' : 'DASHBOARD')}
            onDelete={activeJobId ? () => promptDelete(activeJobId) : undefined}
            onSelectDirectory={handleSelectDirectory}
            onJobModeChange={handleJobModeChange}
            onAddPattern={handleAddPattern}
            isEditing={Boolean(activeJobId)}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContextProvider>
          <AppContent />
        </AppContextProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
