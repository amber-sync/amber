import React, { useCallback, useEffect, useState } from 'react';
import { Icons } from './components/IconComponents';
import { Dashboard } from './views/Dashboard';
import { HistoryView } from './views/HistoryView';
import { JobEditor } from './views/JobEditor';
import { JobDetail } from './views/JobDetail';
import { AppSettings } from './views/AppSettings';
import { useRsyncProgress } from './hooks/useRsyncProgress';
import { useDiskStats } from './hooks/useDiskStats';
import { generateUniqueId } from './utils/idGenerator';
import { JobStatus, RsyncConfig, SyncJob, SyncMode, SshConfig } from './types';

type View = 'DASHBOARD' | 'JOB_EDITOR' | 'DETAIL' | 'HISTORY' | 'APP_SETTINGS' | 'HELP';

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

const MODE_PRESETS: Record<SyncMode, RsyncConfig> = {
  [SyncMode.MIRROR]: {
    ...DEFAULT_CONFIG,
    delete: true,
  },
  [SyncMode.ARCHIVE]: {
    ...DEFAULT_CONFIG,
    delete: false,
  },
  [SyncMode.TIME_MACHINE]: {
    ...DEFAULT_CONFIG,
    delete: false,
  },
};

const DEFAULT_SANDBOX_SOURCE = '/tmp/amber-sandbox/source';
const DEFAULT_SANDBOX_DEST = '/tmp/amber-sandbox/dest';

const INITIAL_JOBS: SyncJob[] = process.env.NODE_ENV === 'development'
  ? [
      {
        id: 'sandbox-default',
        name: 'Sandbox Default',
        sourcePath: DEFAULT_SANDBOX_SOURCE,
        destPath: DEFAULT_SANDBOX_DEST,
        mode: SyncMode.TIME_MACHINE,
        scheduleInterval: null,
        config: {
          ...DEFAULT_CONFIG,
          delete: true, // Enabled for sandbox cleanup
          customFlags: '',
        },
        sshConfig: { enabled: false },
        lastRun: null,
        status: JobStatus.IDLE,
        snapshots: [],
      },
    ]
  : [];

export default function App() {
  const [jobs, setJobs] = useState<SyncJob[]>(INITIAL_JOBS);
  const [activeJobId, setActiveJobId] = useState<string | null>(INITIAL_JOBS[0]?.id ?? null);
  const [view, setView] = useState<View>('DASHBOARD');
  const [darkMode, setDarkMode] = useState(false);
  const [runInBackground, setRunInBackground] = useState(true);
  const [startOnBoot, setStartOnBoot] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const { isRunning, setIsRunning, logs, progress, clearLogs, addLog } = useRsyncProgress();
  const destinationStats = useDiskStats(jobs.map(j => j.destPath));

  // Load preferences and navigation listener
  useEffect(() => {
    if (window.electronAPI?.getPreferences) {
      window.electronAPI.getPreferences().then((p: any) => {
        setRunInBackground(p.runInBackground);
        setStartOnBoot(p.startOnBoot);
        setNotificationsEnabled(p.notifications);
      }).catch(() => {});
    }

    let cleanup: (() => void) | undefined;
    if (window.electronAPI?.onNavigate) {
      cleanup = window.electronAPI.onNavigate((targetView: any) => setView(targetView as View));
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Persist preferences when toggled
  useEffect(() => {
    if (window.electronAPI?.setPreferences) {
      window.electronAPI.setPreferences({
        runInBackground,
        startOnBoot,
        notifications: notificationsEnabled,
      });
    }
  }, [runInBackground, startOnBoot, notificationsEnabled]);

  // Keep main process aware of active job for tray actions
  useEffect(() => {
    if (window.electronAPI?.setActiveJob && activeJobId) {
      const job = jobs.find(j => j.id === activeJobId);
      if (job) window.electronAPI.setActiveJob(job);
    }
  }, [activeJobId, jobs]);

  // Create initial sandbox dirs (dev only) and listen for rsync completion events
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && window.electronAPI) {
      window.electronAPI.createSandboxDirs(DEFAULT_SANDBOX_SOURCE, DEFAULT_SANDBOX_DEST)
        .catch(err => console.error('Failed to create sandbox dirs:', err));
    }

    if (!window.electronAPI) return;

    const unsubComplete = window.electronAPI.onRsyncComplete((data) => {
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

            return {
              ...j,
              status: JobStatus.SUCCESS,
              lastRun: Date.now(),
              snapshots: newSnapshots,
            };
          }
          return j;
        }));
      } else {
        setJobs(prev => prev.map(j => (j.id === data.jobId ? { ...j, status: JobStatus.FAILED } : j)));
      }
    });

    return () => {
      unsubComplete();
    };
  }, []);

  // Create/Edit Job Form State
  const [newJobName, setNewJobName] = useState('');
  const [newJobSource, setNewJobSource] = useState('');
  const [newJobDest, setNewJobDest] = useState('');
  const [newJobMode, setNewJobMode] = useState<SyncMode>(SyncMode.MIRROR);
  const [newJobSchedule, setNewJobSchedule] = useState<number | null>(null);
  const [newJobConfig, setNewJobConfig] = useState<RsyncConfig>({ ...DEFAULT_CONFIG });

  // SSH Form State
  const [sshEnabled, setSshEnabled] = useState(false);
  const [sshPort, setSshPort] = useState('');
  const [sshKeyPath, setSshKeyPath] = useState('');
  const [sshConfigPath, setSshConfigPath] = useState('');

  // UI Helper State for Form
  const [tempExcludePattern, setTempExcludePattern] = useState('');

  // Delete Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);

  const resetForm = () => {
    setNewJobName('');
    setNewJobSource('');
    setNewJobDest('');
    setNewJobMode(SyncMode.MIRROR);
    setNewJobSchedule(null);
    setNewJobConfig({ ...MODE_PRESETS[SyncMode.MIRROR], excludePatterns: [] });
    setSshEnabled(false);
    setSshPort('');
    setSshKeyPath('');
    setSshConfigPath('');
    setTempExcludePattern('');
  };

  const handleJobModeChange = (mode: SyncMode) => {
    setNewJobMode(mode);
    setNewJobConfig({ ...MODE_PRESETS[mode], excludePatterns: [...newJobConfig.excludePatterns], customCommand: undefined });
  };

  const openNewJob = () => {
    resetForm();
    setActiveJobId(null);
    handleJobModeChange(SyncMode.MIRROR);
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
      customFlags: '', // custom flags disabled in favor of custom command
    });

    if (job.sshConfig) {
      setSshEnabled(job.sshConfig.enabled);
      setSshPort(job.sshConfig.port || '');
      setSshKeyPath(job.sshConfig.identityFile || '');
      setSshConfigPath(job.sshConfig.configFile || '');
    } else {
      setSshEnabled(false);
      setSshPort('');
      setSshKeyPath('');
      setSshConfigPath('');
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
    };

    const jobConfig: RsyncConfig = {
      ...newJobConfig,
      excludePatterns: [...newJobConfig.excludePatterns],
      customCommand: newJobConfig.customCommand ? newJobConfig.customCommand.trim() : undefined,
      customFlags: '', // enforce disabled custom flags
    };

    if (activeJobId) {
      setJobs(prev => prev.map(j => (j.id === activeJobId
        ? {
            ...j,
            name: newJobName,
            sourcePath: newJobSource,
            destPath: newJobDest,
            mode: newJobMode,
            scheduleInterval: newJobSchedule,
            config: jobConfig,
            sshConfig,
          }
        : j)));
      setView('DETAIL');
    } else {
      const job: SyncJob = {
        id: generateUniqueId('job'),
        name: newJobName || 'Untitled Job',
        sourcePath: newJobSource,
        destPath: newJobDest,
        mode: newJobMode,
        scheduleInterval: newJobSchedule,
        config: jobConfig,
        sshConfig,
        lastRun: null,
        status: JobStatus.IDLE,
        snapshots: [],
      };
      setJobs(prev => [...prev, job]);
      setActiveJobId(job.id);
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
  }, [jobs, setIsRunning, clearLogs, addLog]);

  const stopSync = useCallback((jobId: string) => {
    if (!window.electronAPI) return;
    window.electronAPI.killRsync(jobId);
    addLog('Stopping sync...', 'warning');
  }, [addLog]);

  const isTopLevel = ['DASHBOARD', 'HISTORY', 'APP_SETTINGS', 'HELP'].includes(view);
  const activeJob = activeJobId ? jobs.find(j => j.id === activeJobId) : null;

  return (
    <div className={darkMode ? 'dark' : ''}>
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
            view={view}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            onNavigate={setView}
          />
        )}

        <main className="flex-1 overflow-auto relative z-10">
          {view === 'DASHBOARD' && (
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
          )}

          {view === 'HISTORY' && <HistoryView jobs={jobs} />}

          {view === 'APP_SETTINGS' && (
            <AppSettings
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode(!darkMode)}
              runInBackground={runInBackground}
              startOnBoot={startOnBoot}
              notificationsEnabled={notificationsEnabled}
              onToggleRunInBackground={() => setRunInBackground(!runInBackground)}
              onToggleStartOnBoot={() => setStartOnBoot(!startOnBoot)}
              onToggleNotifications={() => setNotificationsEnabled(!notificationsEnabled)}
            />
          )}

          {view === 'HELP' && (
            <HelpPanel />
          )}

          {view === 'DETAIL' && activeJob && (
            <JobDetail
              job={activeJob}
              isRunning={isRunning}
              progress={progress}
              logs={logs}
              onBack={() => setView('DASHBOARD')}
              onRun={runSync}
              onStop={stopSync}
              onOpenSettings={openSettings}
              onDelete={promptDelete}
            />
          )}

          {view === 'JOB_EDITOR' && (
            <JobEditor
              jobName={newJobName}
              jobSource={newJobSource}
              jobDest={newJobDest}
              jobMode={newJobMode}
              jobSchedule={newJobSchedule}
              jobConfig={newJobConfig}
              sshEnabled={sshEnabled}
              sshPort={sshPort}
              sshKeyPath={sshKeyPath}
              sshConfigPath={sshConfigPath}
              tempExcludePattern={tempExcludePattern}
              setJobName={setNewJobName}
              setJobSource={setNewJobSource}
              setJobDest={setNewJobDest}
              setJobSchedule={setNewJobSchedule}
              setJobConfig={setNewJobConfig}
              setSshEnabled={setSshEnabled}
              setSshPort={setSshPort}
              setSshKeyPath={setSshKeyPath}
              setSshConfigPath={setSshConfigPath}
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
    </div>
  );
}

const AmbientBackground = () => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
    <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-400/10 dark:bg-teal-500/5 blur-[100px] animate-pulse" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-orange-300/10 dark:bg-orange-400/5 blur-[100px] animate-pulse delay-1000" />

    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 dark:opacity-10 mix-blend-overlay"></div>
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    />
    <div className="dark:hidden absolute inset-0 bg-gradient-to-b from-transparent to-white/50" />
  </div>
);

const DeleteJobModal: React.FC<{ isOpen: boolean; onCancel: () => void; onConfirm: () => void }> = ({ isOpen, onCancel, onConfirm }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100 dark:border-gray-800 transform transition-all scale-100">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
            <Icons.Trash2 size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Job?</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Are you sure you want to delete this sync job? This action cannot be undone.
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-xl font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Sidebar: React.FC<{ view: View; darkMode: boolean; onToggleDarkMode: () => void; onNavigate: (view: View) => void }> = ({ view, darkMode, onToggleDarkMode, onNavigate }) => (
  <aside className="w-64 bg-white/80 dark:bg-[#161617]/80 backdrop-blur-md border-r border-gray-200 dark:border-gray-800 hidden md:flex flex-col transition-colors duration-300 relative z-10 pt-6">
    <div className="p-6 flex items-center gap-3">
      <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
        <Icons.Activity size={20} />
      </div>
      <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">Amber</span>
    </div>

    <nav className="flex-1 px-4 py-4 space-y-1">
      <SidebarButton
        label="Dashboard"
        icon={<Icons.Database size={18} />}
        active={view === 'DASHBOARD'}
        onClick={() => onNavigate('DASHBOARD')}
      />
      <SidebarButton
        label="History"
        icon={<Icons.List size={18} />}
        active={view === 'HISTORY'}
        onClick={() => onNavigate('HISTORY')}
      />
      <SidebarButton
        label="Settings"
        icon={<Icons.Settings size={18} />}
        active={view === 'APP_SETTINGS'}
        onClick={() => onNavigate('APP_SETTINGS')}
      />
      <SidebarButton
        label="Help"
        icon={<Icons.Info size={18} />}
        active={view === 'HELP'}
        onClick={() => onNavigate('HELP')}
      />
    </nav>

    <div className="p-4 border-t border-gray-100 dark:border-gray-800">
      <button
        onClick={onToggleDarkMode}
        className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-600 dark:text-gray-300 text-xs font-medium"
      >
        <span className="flex items-center gap-2">
          {darkMode ? <Icons.Moon size={14} /> : <Icons.Sun size={14} />}
          {darkMode ? 'Dark Mode' : 'Light Mode'}
        </span>
        <div className={`w-8 h-4 rounded-full relative transition-colors ${darkMode ? 'bg-teal-600' : 'bg-gray-300'}`}>
          <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
        </div>
      </button>
    </div>
  </aside>
);

const SidebarButton: React.FC<{ label: string; icon: React.ReactNode; active: boolean; onClick: () => void }> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
    }`}
  >
    {icon} {label}
  </button>
);

const HelpPanel: React.FC = () => (
  <div className="max-w-5xl mx-auto px-8 pb-12">
    <div className="mt-2 bg-white/90 dark:bg-gray-900/85 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-lg overflow-hidden">
      <div className="px-6 py-6 bg-gradient-to-r from-teal-50 via-amber-50 to-indigo-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 border-b border-gray-100 dark:border-gray-800">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Help</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">How Amber syncs, modes, commands, and safety.</p>
      </div>

      {/* Flow */}
      <div className="px-6 py-6 space-y-6 text-sm text-gray-800 dark:text-gray-200">
        <div>
          <p className="font-semibold text-gray-900 dark:text-white mb-2">Flow at a glance</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {[
              { title: '1. Source', desc: 'Local/SSH path selected in job.', color: 'bg-teal-500' },
              { title: '2. Strategy', desc: 'Time Machine / Archive / Mirror / Custom.', color: 'bg-amber-500' },
              { title: '3. Rsync Run', desc: 'Flags assembled per mode, optional custom command.', color: 'bg-indigo-500' },
              { title: '4. Destination', desc: 'Writes to target; Time Machine uses dated folders & latest symlink.', color: 'bg-gray-700' },
            ].map((step, idx) => (
              <div key={idx} className="flex-1 min-w-[180px] bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm relative overflow-hidden">
                <div className={`absolute inset-x-0 top-0 h-1 ${step.color} opacity-70`} />
                <p className="font-semibold text-gray-900 dark:text-white">{step.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="font-semibold text-gray-900 dark:text-white">Modes</p>
          <ul className="list-disc list-inside space-y-3 mt-2">
            <li>
              <span className="font-semibold">Time Machine</span>: Creates dated folders (e.g., <code className="font-mono">2025-01-12-143000</code>). Unchanged files are hard-linked to the previous backup via <code className="font-mono">--link-dest</code>, so only changes consume space. Each backup browses like a full copy, but storage is incremental.
            </li>
            <li>
              <span className="font-semibold">Archive</span>: Copies everything and never deletes on destination. Good for keeping historical/deleted files in one target.
            </li>
            <li>
              <span className="font-semibold">Mirror</span>: Destination matches source exactly. Anything not in source is removed on destination (<code className="font-mono">--delete</code>).
            </li>
            <li>
              <span className="font-semibold">Custom</span>: Your rsync command. Leave empty to use presets; once filled, it overrides all defaults.
            </li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-gray-900 dark:text-white">Default command profile</p>
          <p className="mt-1 text-gray-700 dark:text-gray-300">Amber runs rsync with safety and fidelity flags:</p>
          <code className="block bg-gray-100 dark:bg-gray-800 text-xs font-mono rounded px-3 py-2 mt-2 text-gray-800 dark:text-gray-200">
            rsync -D --numeric-ids --links --hard-links --one-file-system --itemize-changes --stats --human-readable -a [-z] [--delete] [--link-dest=&lt;prev&gt;] [--exclude=...] source/ dest
          </code>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Notes: <code>-a</code> implies recursive/perms/times/owner/group; <code>-z</code> for compression; <code>--delete</code> only in Mirror; <code>--link-dest</code> only in Time Machine.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
            <p className="font-semibold text-gray-900 dark:text-white mb-2">Safety</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Backup marker required at destination to prevent accidents.</li>
              <li>Stays on one filesystem (<code>--one-file-system</code>) to avoid runaway copies.</li>
              <li>FAT detection adds <code>--modify-window=2</code> for coarse timestamps on FAT/USB volumes.</li>
              <li>SSH host key checking on by default; disable only on trusted networks.</li>
              <li>Mirror deletes extras; use Archive or Time Machine for retention.</li>
            </ul>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
            <p className="font-semibold text-gray-900 dark:text-white mb-2">Custom commands</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Use placeholders: <code>{'{source}'}</code>, <code>{'{dest}'}</code>, <code>{'{linkDest}'}</code> (Time Machine). Once set, your command runs as-is. Clear it to return to presets.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);
