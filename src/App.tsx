import React, { useCallback, useEffect, useState } from 'react';
import { Dashboard } from './views/Dashboard';
import { RestoreWizard } from './views/RestoreWizard';
import { HistoryView } from './views/HistoryView';
import { JobEditor } from './views/JobEditor';
import { JobDetail } from './views/JobDetail';
import { AppSettings } from './views/AppSettings';
import { HelpSection } from './components/HelpSection';
import { Sidebar } from './components/Sidebar';
import { AmbientBackground } from './components/AmbientBackground';
import { DeleteJobModal } from './components/DeleteJobModal';
import { AppContextProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { useRsyncProgress } from './hooks/useRsyncProgress';
import { useDiskStats } from './hooks/useDiskStats';
import { generateUniqueId } from './utils/idGenerator';
import { JobStatus, RsyncConfig, SyncJob, SyncMode, SshConfig, DestinationType } from './types';


const MODE_PRESETS: Record<SyncMode, RsyncConfig> = {
  [SyncMode.MIRROR]: {
    recursive: true, archive: true, compress: true, delete: true, verbose: true, excludePatterns: [], customFlags: '', customCommand: undefined,
  },
  [SyncMode.ARCHIVE]: {
    recursive: true, archive: true, compress: true, delete: false, verbose: true, excludePatterns: [], customFlags: '', customCommand: undefined,
  },
  [SyncMode.TIME_MACHINE]: {
    recursive: true, archive: true, compress: true, delete: false, verbose: true, excludePatterns: [], customFlags: '', customCommand: undefined,
  },
};

const DEFAULT_CONFIG = MODE_PRESETS[SyncMode.TIME_MACHINE];

function AppContent() {
  const { 
    jobs, activeJobId, view,
    setJobs, setActiveJobId, setView,
    persistJob, deleteJob
  } = useApp();

  const { isRunning, setIsRunning, logs, progress, clearLogs, addLog } = useRsyncProgress();
  const destinationStats = useDiskStats(jobs.map(j => j.destPath));

  // Restore Wizard State
  const [restoreJobId, setRestoreJobId] = useState<string | null>(null);

  // Create/Edit Job Form State
  const [newJobName, setNewJobName] = useState('');
  const [newJobSource, setNewJobSource] = useState('');
  const [newJobDest, setNewJobDest] = useState('');
  const [newJobMode, setNewJobMode] = useState<SyncMode>(SyncMode.TIME_MACHINE);
  const [newJobSchedule, setNewJobSchedule] = useState<number | null>(null);
  const [newJobConfig, setNewJobConfig] = useState<RsyncConfig>({ ...DEFAULT_CONFIG });
  
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

  // Listen for rsync completion events
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubComplete = window.electronAPI.onRsyncComplete((data) => {
      let persistedJob: SyncJob | null = null;
      if (data.success) {
        setJobs(prev => prev.map(j => {
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
        }));
      } else {
        setJobs(prev => prev.map(j => (j.id === data.jobId ? { ...j, status: JobStatus.FAILED } : j)));
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
    setNewJobConfig({ ...MODE_PRESETS[mode], excludePatterns: [...newJobConfig.excludePatterns], customCommand: undefined });
  };

  const openNewJob = () => {
    resetForm();
    setActiveJobId(null);
    handleJobModeChange(SyncMode.TIME_MACHINE);
    setView('JOB_EDITOR');
  };

  const openSettings = () => {
    if (!activeJobId) return;
    const job = jobs.find(j => j.id === activeJobId);
    if (!job) return;

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

    const scheduleConfig = newJobSchedule ? {
      enabled: true,
      cron: getCronFromInterval(newJobSchedule),
      runOnMount: newJobSchedule === -1 || true,
    } : { enabled: false };

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
        setJobs(prev => prev.map(j => j.id === activeJobId ? updatedJob : j));
        persistJob(updatedJob);
        setView('DETAIL');
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
      setView('DETAIL');
    }
    resetForm();
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
    if (!window.electronAPI) return;
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      if (target === 'SOURCE') setNewJobSource(path);
      else setNewJobDest(path);
    }
  };

  const runSync = useCallback((jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: JobStatus.RUNNING } : j)));

    setIsRunning(true);
    clearLogs();
    addLog(`Starting sync for ${job.name}...`);

    if (window.electronAPI) {
      window.electronAPI.runRsync(job);
    } else {
      addLog('Electron API not available.', 'error');
      setIsRunning(false);
    }
  }, [jobs, setIsRunning, clearLogs, addLog, setJobs]);

  const stopSync = useCallback((jobId: string) => {
    if (!window.electronAPI) return;
    window.electronAPI.killRsync(jobId);
    addLog('Stopping sync...', 'warning');
  }, [addLog]);

  const handleOpenRestore = (jobId: string) => {
    setRestoreJobId(jobId);
    setView('RESTORE_WIZARD');
  };

  const handleRestoreFiles = async (files: string[], targetPath: string, snapshot: any) => {
    if (!restoreJobId) return;
    const job = jobs.find(j => j.id === restoreJobId);
    if (!job) return;

    addLog(`Starting restore for ${files.length} files to ${targetPath}...`);
    
    if (window.electronAPI?.restoreFiles) {
      try {
        // Use snapshot.path for the source
        const result = await window.electronAPI.restoreFiles(job, snapshot.path, files, targetPath);
        
        if (result.success) {
           // Mark snapshot as restored
           const updatedJob = {
             ...job,
             snapshots: job.snapshots.map(s => s.id === snapshot.id ? { ...s, restored: true, restoredDate: Date.now() } : s)
           };
           setJobs(prev => prev.map(j => j.id === job.id ? updatedJob : j));
           persistJob(updatedJob);
           addLog(`Successfully restored files to ${targetPath}`);
        } else {
           addLog(`Restore failed: ${result.error}`, 'error');
        }
      } catch (e: any) {
        addLog(`Restore failed: ${e.message}`, 'error');
      }
    } else {
      console.log('Restoring:', files, 'to', targetPath);
    }

    setView('DETAIL');
    setRestoreJobId(null);
  };

  const isTopLevel = ['DASHBOARD', 'HISTORY', 'APP_SETTINGS', 'HELP'].includes(view);
  const activeJob = activeJobId ? jobs.find(j => j.id === activeJobId) : null;

  return (
    <div className="flex min-h-screen bg-[#f5f5f7] dark:bg-[#0f0f10] text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300 relative">
      <div className="fixed top-0 left-0 w-full h-8 z-[100] titlebar-drag" />

      <AmbientBackground />

      <DeleteJobModal
        isOpen={showDeleteConfirm}
        onCancel={() => { setShowDeleteConfirm(false); setJobToDelete(null); }}
        onConfirm={executeDelete}
      />

      {isTopLevel && (
        <Sidebar
          activeView={view}
          onNavigate={setView}
        />
      )}

      <main className="flex-1 relative z-10 overflow-hidden flex flex-col">
        {view === 'DASHBOARD' && (
          <div className="flex-1 overflow-y-auto">
            <Dashboard
              jobs={jobs}
              diskStats={destinationStats}
              onSelectJob={(id) => {
                setActiveJobId(id);
                const job = jobs.find(j => j.id === id);
                if (job && window.electronAPI?.setActiveJob) window.electronAPI.setActiveJob(job);
                setView('DETAIL');
              }}
              onCreateJob={openNewJob}
            />
          </div>
        )}

        {view === 'HISTORY' && <HistoryView jobs={jobs} />}

        {view === 'APP_SETTINGS' && (
          <AppSettings />
        )}

        {view === 'HELP' && (
          <HelpSection />
        )}

        {view === 'DETAIL' && activeJob && (
          <JobDetail
            job={activeJob}
            diskStats={destinationStats}
            isRunning={isRunning}
            progress={progress}
            logs={logs}
            onBack={() => setView('DASHBOARD')}
            onRun={runSync}
            onStop={stopSync}
            onOpenSettings={openSettings}
            onDelete={promptDelete}
            onRestore={() => handleOpenRestore(activeJob.id)}
          />
        )}

        {view === 'RESTORE_WIZARD' && restoreJobId && (
          (() => {
            const job = jobs.find(j => j.id === restoreJobId);
            if (!job) return null;
            return (
              <RestoreWizard
                job={job}
                onBack={() => {
                  setRestoreJobId(null);
                  setView('DETAIL');
                }}
                onRestore={handleRestoreFiles}
              />
            );
          })()
        )}

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
            onCancel={() => setView(activeJobId ? 'DETAIL' : 'DASHBOARD')}
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
      <AppContextProvider>
        <AppContent />
      </AppContextProvider>
    </ThemeProvider>
  );
}
