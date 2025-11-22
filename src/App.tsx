import React, { useState, useEffect, useCallback } from 'react';
import { Icons } from './components/IconComponents';
import { Terminal } from './components/Terminal';
import { SyncJob, JobStatus, SyncMode, RsyncConfig, Snapshot, SshConfig, FileNode } from './types';

// --- Utilities ---
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatSchedule = (minutes: number | null) => {
  if (minutes === null) return 'Manual Only';
  if (minutes === 5) return 'Heartbeat';
  if (minutes === 60) return 'Hourly';
  if (minutes === 1440) return 'Daily';
  if (minutes === 10080) return 'Weekly';
  return `Every ${minutes} mins`;
};

// --- Mock Data Generators ---
const generateMockFileSystem = (seed: number): FileNode[] => {
  const files: FileNode[] = [
    { id: `f-${seed}-1`, name: 'index.html', type: 'FILE', size: 1024 + seed, modified: Date.now() },
    { id: `f-${seed}-2`, name: 'styles.css', type: 'FILE', size: 2048 + seed * 2, modified: Date.now() },
    { id: `d-${seed}-1`, name: 'assets', type: 'FOLDER', size: 0, modified: Date.now(), children: [
      { id: `f-${seed}-3`, name: 'logo.png', type: 'FILE', size: 15000, modified: Date.now() },
      { id: `f-${seed}-4`, name: 'banner.jpg', type: 'FILE', size: 45000, modified: Date.now() },
    ]},
    { id: `d-${seed}-2`, name: 'src', type: 'FOLDER', size: 0, modified: Date.now(), children: [
      { id: `f-${seed}-5`, name: 'app.tsx', type: 'FILE', size: 5000 + seed * 5, modified: Date.now() },
      { id: `f-${seed}-6`, name: 'utils.ts', type: 'FILE', size: 1200, modified: Date.now() },
      { id: `d-${seed}-3`, name: 'components', type: 'FOLDER', size: 0, modified: Date.now(), children: [
        { id: `f-${seed}-7`, name: 'Header.tsx', type: 'FILE', size: 2000, modified: Date.now() },
        { id: `f-${seed}-8`, name: 'Footer.tsx', type: 'FILE', size: 1800, modified: Date.now() },
      ]}
    ]},
    { id: `f-${seed}-9`, name: 'README.md', type: 'FILE', size: 500, modified: Date.now() },
  ];
  
  // Randomly add/remove files based on seed to simulate changes
  if (seed % 2 === 0) {
    files.push({ id: `f-${seed}-10`, name: 'new-feature.ts', type: 'FILE', size: 3000, modified: Date.now() });
  }
  return files;
};

const DEFAULT_CONFIG: RsyncConfig = {
  recursive: true,
  archive: true,
  compress: true,
  delete: false,
  verbose: true,
  excludePatterns: [],
  customFlags: '' // Backend adds --stats --human-readable automatically
};

const DEFAULT_SANDBOX_SOURCE = '/tmp/amber-sandbox/source';
const DEFAULT_SANDBOX_DEST = '/tmp/amber-sandbox/dest';

const INITIAL_JOBS: SyncJob[] = [
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
      customFlags: ''
    },
    sshConfig: { enabled: false },
    lastRun: null,
    status: JobStatus.IDLE,
    snapshots: []
  }
];

const generateCmd = (job: SyncJob): string => {
  const c = job.config;
  let cmd = 'rsync';
  
  // SSH Configuration
  if (job.sshConfig?.enabled) {
    let sshOpts = 'ssh';
    if (job.sshConfig.port) sshOpts += ` -p ${job.sshConfig.port}`;
    if (job.sshConfig.identityFile) sshOpts += ` -i ${job.sshConfig.identityFile}`;
    if (job.sshConfig.configFile) sshOpts += ` -F ${job.sshConfig.configFile}`;
    
    cmd += ` -e '${sshOpts}'`;
  }

  if (c.archive) cmd += ' -a';
  if (c.recursive && !c.archive) cmd += ' -r'; // -a implies -r
  if (c.compress) cmd += ' -z';
  if (c.verbose) cmd += ' -v';
  if (c.delete) cmd += ' --delete';
  if (c.customFlags) cmd += ` ${c.customFlags}`;
  
  if (job.mode === SyncMode.TIME_MACHINE) {
    const prevDate = new Date();
    prevDate.setHours(prevDate.getHours() - 1);
    cmd += ` --link-dest="${job.destPath}/latest"`;
  }
  c.excludePatterns.forEach(p => cmd += ` --exclude="${p}"`);
  cmd += ` ${job.sourcePath} ${job.destPath}/${job.mode === SyncMode.TIME_MACHINE ? new Date().toISOString().slice(0,19).replace(/:/g,"-") : ''}`;
  return cmd;
};

// --- Components ---

const CustomTooltip = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <div className="relative group">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
    </div>
  </div>
);

const AmbientBackground = () => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
    {/* Gradient Orbs - Seaborn Set 2 inspired (Teal/Green/Orange) */}
    <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-400/10 dark:bg-teal-500/5 blur-[100px] animate-pulse" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-orange-300/10 dark:bg-orange-400/5 blur-[100px] animate-pulse delay-1000" />
    
    {/* Grid Pattern */}
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 dark:opacity-10 mix-blend-overlay"></div>
    <div 
      className="absolute inset-0" 
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)',
        backgroundSize: '24px 24px'
      }} 
    />
    <div className="dark:hidden absolute inset-0 bg-gradient-to-b from-transparent to-white/50" />
  </div>
);

const Tooltip = CustomTooltip; // Alias for backward compatibility in this file

// --- Helper: Calculate Job Stats ---
const calculateJobStats = (fileNodes: FileNode[]): { fileTypes: { name: string, value: number }[], largestFiles: { name: string, size: number, path: string }[] } => {
  const typesMap = new Map<string, number>();
  const allFiles: { name: string, size: number, path: string }[] = [];

  const traverse = (nodes: FileNode[], currentPath: string) => {
    for (const node of nodes) {
      if (node.type === 'FILE') {
        const ext = node.name.includes('.') ? node.name.split('.').pop()?.toLowerCase() || 'unknown' : 'no-ext';
        typesMap.set(ext, (typesMap.get(ext) || 0) + 1);
        allFiles.push({ name: node.name, size: node.size, path: `${currentPath}/${node.name}` });
      } else if (node.children) {
        traverse(node.children, `${currentPath}/${node.name}`);
      }
    }
  };

  traverse(fileNodes, '');

  const fileTypes = Array.from(typesMap.entries())
    .map(([name, value]) => ({ name: `.${name}`, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5); // Top 5 types

  const largestFiles = allFiles
    .sort((a, b) => b.size - a.size)
    .slice(0, 5); // Top 5 largest files

  return { fileTypes, largestFiles };
};

// --- Main App ---

export default function App() {
  const [jobs, setJobs] = useState<SyncJob[]>(INITIAL_JOBS);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'JOB_EDITOR' | 'DETAIL' | 'HISTORY' | 'APP_SETTINGS'>('DASHBOARD');
  const [darkMode, setDarkMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ percentage: number; speed: string; transferred: string; eta: string; currentFile?: string } | null>(null);
  const [destinationStats, setDestinationStats] = useState<Record<string, { total: number; free: number; status: 'AVAILABLE' | 'UNAVAILABLE' }>>({});

  // Buffered Logging for Performance
  const logBufferRef = React.useRef<string[]>([]);
  
  useEffect(() => {
    if (!window.electronAPI) return;

    // Initialize Sandbox Environment for default job
    window.electronAPI.createSandboxDirs(DEFAULT_SANDBOX_SOURCE, DEFAULT_SANDBOX_DEST)
      .catch(err => console.error("Failed to create sandbox dirs:", err));

    const unsubLog = window.electronAPI.onRsyncLog((data) => {
        logBufferRef.current.push(data.message);
    });
    
    // Flush logs every 200ms to prevent UI freezing
    const logInterval = setInterval(() => {
        if (logBufferRef.current.length > 0) {
            setLogs(prev => {
                const newLogs = [...prev, ...logBufferRef.current];
                logBufferRef.current = []; // Clear buffer
                return newLogs.length > 500 ? newLogs.slice(-500) : newLogs;
            });
        }
    }, 200);

    const unsubProgress = window.electronAPI.onRsyncProgress((data) => {
      if (data.jobId === activeJobId || jobs.find(j => j.id === data.jobId && j.status === JobStatus.RUNNING)) {
        setProgress({
          percentage: data.percentage,
          speed: data.speed,
          transferred: data.transferred,
          eta: data.eta,
          currentFile: data.currentFile
        });
      }
    });

    const unsubComplete = window.electronAPI.onRsyncComplete((data) => {
      setIsRunning(false);
      setProgress(null);
      if (data.success) {
        setLogs(prev => [...prev, 'Sync Completed Successfully.']);
        setJobs(prev => prev.map(j => {
          if (j.id === data.jobId) {
            // Add new snapshot if returned
            const snapshots = j.snapshots || [];
            let newSnapshot = (data as any).snapshot;
            
            if (newSnapshot) {
                // Ensure snapshot has all required fields, especially ID for React keys
                newSnapshot = {
                    id: `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    status: 'Complete',
                    changesCount: 0, // Default if not parsed
                    ...newSnapshot
                };
            }

            const newSnapshots = newSnapshot ? [...snapshots, newSnapshot] : snapshots;
            
            return { 
              ...j, 
              status: JobStatus.SUCCESS, 
              lastRun: Date.now(),
              snapshots: newSnapshots
            };
          }
          return j;
        }));
      } else {
        setLogs(prev => [...prev, `Sync Failed: ${data.error || 'Unknown error'}`]);
        setJobs(prev => prev.map(j => j.id === data.jobId ? { ...j, status: JobStatus.FAILED } : j));
      }
    });

    return () => {
      unsubLog();
      clearInterval(logInterval);
      unsubProgress();
      unsubComplete();
    };
  }, [activeJobId, jobs]);

  // Fetch Disk Stats Effect
  useEffect(() => {
    const fetchDiskStats = async () => {
        if (!window.electronAPI) return;
        const uniquePaths = Array.from(new Set(jobs.map(j => j.destPath).filter(Boolean)));
        const stats: Record<string, any> = {};
        
        for (const path of uniquePaths) {
            stats[path] = await window.electronAPI.getDiskStats(path);
        }
        setDestinationStats(stats);
    };
    
    fetchDiskStats();
    // Refresh every 10 seconds
    const interval = setInterval(fetchDiskStats, 10000);
    return () => clearInterval(interval);
  }, [jobs]);
  
  // Create/Edit Job Form State
  const [newJobName, setNewJobName] = useState('');
  const [newJobSource, setNewJobSource] = useState('');
  const [newJobDest, setNewJobDest] = useState('');
  const [newJobMode, setNewJobMode] = useState<SyncMode>(SyncMode.MIRROR);
  const [newJobSchedule, setNewJobSchedule] = useState<number | null>(null);
  const [newJobConfig, setNewJobConfig] = useState<RsyncConfig>(DEFAULT_CONFIG);
  
  // SSH Form State
  const [sshEnabled, setSshEnabled] = useState(false);
  const [sshPort, setSshPort] = useState('');
  const [sshKeyPath, setSshKeyPath] = useState('');
  const [sshConfigPath, setSshConfigPath] = useState('');
  
  // UI Helper State for Form
  const [tempExcludePattern, setTempExcludePattern] = useState('');
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
  const [snapshotGrouping, setSnapshotGrouping] = useState<'ALL' | 'DAY' | 'MONTH' | 'YEAR'>('ALL');

  // Delete Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);

  // Time Machine Viewer State
  const [viewerSnapshotId, setViewerSnapshotId] = useState<string | null>(null);
  const [viewerPath, setViewerPath] = useState<string[]>([]);

  // --- Actions ---

  const resetForm = () => {
    setNewJobName('');
    setNewJobSource('');
    setNewJobDest('');
    setNewJobMode(SyncMode.MIRROR);
    setNewJobSchedule(null);
    setNewJobConfig(DEFAULT_CONFIG);
    setSshEnabled(false);
    setSshPort('');
    setSshKeyPath('');
    setSshConfigPath('');
    setTempExcludePattern('');
  };

  const handleJobModeChange = (mode: SyncMode) => {
    setNewJobMode(mode);
    // Auto-configure defaults for mode
    if (mode === SyncMode.TIME_MACHINE) {
        // Time Machine usually doesn't need delete on the destination because it writes to a new folder
        // But for rsync link-dest to work best and be clean, we usually don't use --delete against the timestamp folder anyway
        // as it is empty.
        setNewJobConfig(prev => ({ ...prev, delete: false }));
    } else if (mode === SyncMode.MIRROR) {
        // Mirror usually implies delete extraneous
        setNewJobConfig(prev => ({ ...prev, delete: true }));
    }
  };

  const openNewJob = () => {
    resetForm();
    setActiveJobId(null);
    // Set default mode logic
    handleJobModeChange(SyncMode.MIRROR);
    setView('JOB_EDITOR');
  };

  const openSettings = () => {
    const job = jobs.find(j => j.id === activeJobId);
    if (!job) return;
    
    setNewJobName(job.name);
    setNewJobSource(job.sourcePath);
    setNewJobDest(job.destPath);
    setNewJobMode(job.mode);
    setNewJobSchedule(job.scheduleInterval);
    setNewJobConfig(job.config);
    
    // SSH Settings
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
      configFile: sshConfigPath
    };

    if (activeJobId) {
      // Update existing
      setJobs(prev => prev.map(j => j.id === activeJobId ? {
        ...j,
        name: newJobName,
        sourcePath: newJobSource,
        destPath: newJobDest,
        mode: newJobMode,
        scheduleInterval: newJobSchedule,
        config: newJobConfig,
        sshConfig: sshConfig
      } : j));
      setView('DETAIL');
    } else {
      // Create new
      const job: SyncJob = {
        id: Date.now().toString(),
        name: newJobName || 'Untitled Job',
        sourcePath: newJobSource,
        destPath: newJobDest,
        mode: newJobMode,
        scheduleInterval: newJobSchedule,
        config: newJobConfig,
        sshConfig: sshConfig,
        lastRun: null,
        status: JobStatus.IDLE,
        snapshots: []
      };
      setJobs([...jobs, job]);
      setView('DASHBOARD');
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
      excludePatterns: [...prev.excludePatterns, tempExcludePattern.trim()]
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

    // Update status to running for UI animation
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: JobStatus.RUNNING } : j));

    setIsRunning(true);
    setLogs([`Starting sync for ${job.name}...`]);

    if (window.electronAPI) {
      window.electronAPI.runRsync(job);
    } else {
      setLogs(prev => [...prev, "Electron API not available."]);
        setIsRunning(false);
    }
  }, [jobs]);

  const stopSync = useCallback((jobId: string) => {
    if (!window.electronAPI) return;
    window.electronAPI.killRsync(jobId);
    setLogs(prev => [...prev, "Stopping sync..."]);
  }, []);

  // --- Helpers for Time Machine Viewer ---
  
  const getFilesAtCurrentPath = (snapshot: Snapshot, path: string[]): FileNode[] => {
    let currentLevel = snapshot.root;
    for (const p of path) {
      const folder = currentLevel.find(f => f.name === p && f.type === 'FOLDER');
      if (folder && folder.children) {
        currentLevel = folder.children;
      } else {
        return [];
      }
    }
    return currentLevel;
  };

  const navigateSnapshot = (direction: 'PREV' | 'NEXT') => {
    const job = jobs.find(j => j.id === activeJobId);
    if (!job) return;
    
    // Sort snapshots desc
    const sorted = [...job.snapshots].sort((a, b) => b.timestamp - a.timestamp);
    const currentIndex = sorted.findIndex(s => s.id === viewerSnapshotId);
    
    if (currentIndex === -1) return;
    
    let newIndex = direction === 'NEXT' ? currentIndex - 1 : currentIndex + 1;
    
    // Bounds check
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= sorted.length) newIndex = sorted.length - 1;
    
    setViewerSnapshotId(sorted[newIndex].id);
  };

  const [isGeneratingSandbox, setIsGeneratingSandbox] = useState(false);

  const createSandboxJob = async () => {
    setIsGeneratingSandbox(true);
    const sandboxSource = `/tmp/amber-sandbox/source-${Date.now()}`;
    const sandboxDest = `/tmp/amber-sandbox/dest-${Date.now()}`;
    
    // Ensure dirs exist
    if (window.electronAPI) {
      const result = await window.electronAPI.createSandboxDirs(sandboxSource, sandboxDest);
      setIsGeneratingSandbox(false);
      if (!result.success) {
        setLogs(prev => [...prev, `Error creating sandbox dirs: ${result.error}`]);
        return;
      }
    } else {
      setIsGeneratingSandbox(false);
    }
    
    const job: SyncJob = {
      id: `sandbox-${Date.now()}`,
      name: 'Sandbox Test Job',
      sourcePath: sandboxSource,
      destPath: sandboxDest,
      mode: SyncMode.TIME_MACHINE,
      scheduleInterval: null,
      config: { ...DEFAULT_CONFIG, delete: true, verbose: true },
      sshConfig: { enabled: false },
      lastRun: null,
      status: JobStatus.IDLE,
      snapshots: []
    };
    setJobs([...jobs, job]);
    setLogs(prev => [...prev, `Created Sandbox Job: Source=${sandboxSource}, Dest=${sandboxDest}`]);
  };

  // --- Views ---

  const renderDeleteModal = () => {
    if (!showDeleteConfirm) return null;
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
                onClick={() => { setShowDeleteConfirm(false); setJobToDelete(null); }}
                className="flex-1 px-4 py-2 rounded-xl font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
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

  const renderSnapshotViewer = () => {
    // Simplified viewer replaced by native "Open in Finder"
    return null;
  };

  const renderDashboard = () => {
    const totalProtectedSize = jobs.reduce((acc, job) => {
      const latest = job.snapshots[job.snapshots.length - 1];
      return acc + (latest?.sizeBytes || 0);
    }, 0);

    const uniqueDestinations = Array.from(new Set(jobs.map(j => j.destPath).filter(Boolean)));

    return (
    <div className="p-8 space-y-6 relative z-10">
      <header className="flex justify-between items-center mb-8 pt-4">
        <div className="no-drag">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Amber</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Rsync and Time Machine</p>
        </div>
        <div className="flex gap-3 no-drag">
          <button 
            onClick={openNewJob}
            className="flex items-center gap-2 bg-black dark:bg-white dark:text-black text-white px-5 py-2.5 rounded-full font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95"
          >
            <Icons.Plus size={18} /> New Job
          </button>
        </div>
      </header>

      {/* Global Stats Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Storage Destinations */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Icons.HardDrive size={20} className="text-[#fc8d62]" /> Storage Destinations
          </h3>
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
             {uniqueDestinations.map(path => {
                 const stat = destinationStats[path];
                 const isAvailable = stat?.status === 'AVAILABLE';
                 const percentUsed = isAvailable && stat.total > 0 ? ((stat.total - stat.free) / stat.total) * 100 : 0;
                 
                 return (
                     <div key={path} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`p-2 rounded-full shrink-0 ${isAvailable ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'}`}>
                                <Icons.HardDrive size={18} />
                            </div>
                            <div className="min-w-0">
                                <div className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[250px]" title={path}>{path}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {!stat ? 'Checking...' : 
                                     isAvailable ? `${formatBytes(stat.free)} free of ${formatBytes(stat.total)}` : 
                                     'Not Connected'}
                                </div>
                            </div>
                        </div>
                        {isAvailable && (
                            <div className="w-32 shrink-0 flex flex-col gap-1">
                                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#fc8d62]" style={{ width: `${percentUsed}%` }} />
                                </div>
                                <div className="text-[10px] text-right text-gray-400">{Math.round(percentUsed)}% Used</div>
                            </div>
                        )}
                     </div>
                 );
             })}
             {uniqueDestinations.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500">
                    <Icons.HardDrive size={32} className="mb-2 opacity-20" />
                    <p className="text-sm">No destinations configured.</p>
                 </div>
             )}
          </div>
        </div>

        {/* Total Backed Up Summary */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700 shadow-sm flex flex-col justify-between relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10">
             <Icons.Database size={120} />
           </div>
           <div>
             <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Total Backed Up</h3>
             <p className="text-sm text-gray-500 dark:text-gray-400">Across all jobs</p>
           </div>
           <div className="flex items-end gap-2 mt-8">
             <span className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
               {formatBytes(totalProtectedSize)}
             </span>
           </div>
           <div className="mt-4">
             <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
               <div className="bg-[#fc8d62] h-2.5 rounded-full" style={{ width: '100%' }}></div>
             </div>
             <div className="flex justify-between text-xs text-gray-400 mt-2">
               <span>Used Space</span>
               <span>{jobs.length} Active Jobs</span>
             </div>
           </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Your Jobs</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map(job => (
          <div 
            key={job.id} 
            onClick={() => { setActiveJobId(job.id); setView('DETAIL'); }}
            className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl transition-all duration-500 ${
                job.status === JobStatus.RUNNING 
                  ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 animate-heartbeat shadow-[0_0_15px_rgba(245,158,11,0.4)]' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
                <Icons.Database size={24} />
              </div>
              <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                job.status === JobStatus.SUCCESS ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                job.status === JobStatus.RUNNING ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 animate-pulse' :
                'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {job.status === JobStatus.RUNNING && <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping"/>}
                {job.status}
              </div>
            </div>
            
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">{job.name}</h3>
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-4 gap-2">
              <span className="truncate max-w-[100px]">{job.sourcePath}</span>
              <Icons.ArrowRight size={12} />
              <span className="truncate max-w-[100px]">{job.destPath}</span>
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1">
                <Icons.Clock size={12} />
                {formatSchedule(job.scheduleInterval)}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Last: {job.lastRun ? new Date(job.lastRun).toLocaleDateString() : 'Never'}
              </span>
            </div>
          </div>
        ))}

        {jobs.length === 0 && (
          <div className="col-span-full py-20 text-center text-gray-400 dark:text-gray-600">
            <Icons.HardDrive className="mx-auto mb-4 opacity-20" size={64} />
            <p>No sync jobs configured yet.</p>
          </div>
        )}
      </div>
    </div>
  );
  };

  const renderHistory = () => {
    // Flatten and sort all snapshots from all jobs
    const history = jobs
      .flatMap(job => job.snapshots.map(snap => ({ ...snap, jobName: job.name })))
      .sort((a, b) => b.timestamp - a.timestamp);

    return (
      <div className="p-8 space-y-6 animate-fade-in relative z-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Global History</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Timeline of all synchronization events.</p>
        </header>

        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-700 dark:text-gray-300">
                <tr>
                  <th className="px-6 py-4 font-semibold">Job Name</th>
                  <th className="px-6 py-4 font-semibold">Date & Time</th>
                  <th className="px-6 py-4 font-semibold">Changes</th>
                  <th className="px-6 py-4 font-semibold">Total Size</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {history.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{item.jobName}</td>
                    <td className="px-6 py-4">{new Date(item.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4">{item.changesCount} files</td>
                    <td className="px-6 py-4 font-mono text-xs">{formatBytes(item.sizeBytes)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        <Icons.CheckCircle size={12} /> {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">No history records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAppSettings = () => (
    <div className="p-8 space-y-6 animate-fade-in relative z-10">
       <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Application preferences and configuration.</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
              {/* Appearance */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Icons.Sun size={20} /> Appearance
                </h3>
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Dark Mode</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Toggle application theme</div>
                  </div>
                  <button 
                    onClick={() => setDarkMode(!darkMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${darkMode ? 'bg-teal-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              {/* System */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Icons.Cpu size={20} /> System
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Run in Background</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Keep Amber running in the macOS menu bar when closed</div>
                    </div>
                    <input type="checkbox" className="w-4 h-4 text-teal-600 rounded" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Start on Boot</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Launch Amber automatically</div>
                    </div>
                    <input type="checkbox" className="w-4 h-4 text-teal-600 rounded" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Notifications</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Show desktop alerts for finished jobs</div>
                    </div>
                    <input type="checkbox" className="w-4 h-4 text-teal-600 rounded" defaultChecked />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* About / System Check */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700 p-6 h-fit">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Icons.Shield size={20} /> System Health
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-1">
                  <Icons.CheckCircle size={16} /> Environment Ready
                </div>
                <p className="text-xs text-green-600 dark:text-green-500">
                  All necessary binary dependencies detected.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Rsync Version</span>
                  <span className="font-mono text-gray-900 dark:text-gray-200">3.2.7</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">SSH Client</span>
                  <span className="font-mono text-gray-900 dark:text-gray-200">OpenSSH_9.0p1</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">App Version</span>
                  <span className="font-mono text-gray-900 dark:text-gray-200">1.0.0-beta</span>
                </div>
              </div>

              <hr className="border-gray-100 dark:border-gray-700" />

              <button className="w-full py-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
                Check for Updates
              </button>
              
              <div className="text-center pt-2">
                <p className="text-xs text-gray-400 dark:text-gray-600">
                  © 2024 Amber Sync Inc.
                </p>
              </div>
            </div>
          </div>
        </div>
    </div>
  );

  const renderJobEditor = () => (
    <div className="min-h-screen bg-gray-50/50 dark:bg-black/50 flex items-center justify-center p-6 backdrop-blur-md z-50 absolute top-0 left-0 w-full">
      <div className="bg-white dark:bg-gray-900 max-w-2xl w-full rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {activeJobId ? 'Edit Job Settings' : 'Create Sync Job'}
          </h2>
          <button 
            onClick={() => setView(activeJobId ? 'DETAIL' : 'DASHBOARD')} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <Icons.XCircle size={24} />
          </button>
        </div>
        <div className="p-8 overflow-y-auto space-y-8 scrollbar-hide">
          
          {/* Basic Info */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Job Name</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900 outline-none transition-all"
              placeholder="e.g. Project Website Backup"
              value={newJobName}
              onChange={e => setNewJobName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Icons.Server size={14} /> Source
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900 outline-none transition-all font-mono text-sm"
                  placeholder="user@host:/path"
                  value={newJobSource}
                  onChange={e => setNewJobSource(e.target.value)}
                />
                <button 
                  onClick={() => handleSelectDirectory('SOURCE')}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl transition-colors border border-gray-200 dark:border-gray-700"
                >
                  <Icons.Folder size={20} />
                </button>
              </div>
            </div>
            <div className="space-y-4">
               <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Icons.HardDrive size={14} /> Destination
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900 outline-none transition-all font-mono text-sm"
                  placeholder="/Volumes/Backup"
                  value={newJobDest}
                  onChange={e => setNewJobDest(e.target.value)}
                />
                <button 
                  onClick={() => handleSelectDirectory('DEST')}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl transition-colors border border-gray-200 dark:border-gray-700"
                >
                  <Icons.Folder size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* SSH Configuration */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Icons.Shield size={14} /> Connection Details (SSH)
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={sshEnabled} onChange={e => setSshEnabled(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
              </label>
            </div>
            
            {sshEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 animate-fade-in">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Port</label>
                  <input 
                    type="text" 
                    placeholder="22" 
                    value={sshPort}
                    onChange={e => setSshPort(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Identity File (Key)</label>
                  <input 
                    type="text" 
                    placeholder="~/.ssh/id_rsa" 
                    value={sshKeyPath}
                    onChange={e => setSshKeyPath(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
                 <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Config File</label>
                  <input 
                    type="text" 
                    placeholder="~/.ssh/config" 
                    value={sshConfigPath}
                    onChange={e => setSshConfigPath(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mode Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Sync Strategy</label>
            <div className="grid grid-cols-3 gap-4">
              {[
                { m: SyncMode.MIRROR, label: 'Mirror', desc: 'Exact replica' },
                { m: SyncMode.ARCHIVE, label: 'Archive', desc: 'Keep deleted files' },
                { m: SyncMode.TIME_MACHINE, label: 'Time Machine', desc: 'Versioned snapshots' },
              ].map((opt) => (
                <button 
                  key={opt.m}
                  onClick={() => handleJobModeChange(opt.m)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    newJobMode === opt.m 
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-500' 
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white">{opt.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Schedule</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Manual', val: null, icon: Icons.Play },
                { label: 'Heartbeat', val: 5, icon: Icons.Activity },
                { label: 'Hourly', val: 60, icon: Icons.Clock },
                { label: 'Daily', val: 1440, icon: Icons.Sun },
                { label: 'Weekly', val: 10080, icon: Icons.Calendar },
              ].map((opt) => (
                <div key={opt.label} className="relative group">
                  <button 
                    onClick={() => setNewJobSchedule(opt.val)}
                    className={`w-full h-full px-3 py-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center justify-center gap-2 ${
                      newJobSchedule === opt.val 
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500' 
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <opt.icon size={20} />
                    {opt.label}
                  </button>
                  
                  {/* Specific Heartbeat Tooltip */}
                  {opt.val === 5 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 hidden group-hover:block animate-fade-in z-50">
                      <div className="bg-gray-900 text-white text-xs p-2.5 rounded-lg shadow-xl text-center relative">
                        Checks for changes every 5 minutes. Ideal for active projects.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Config Toggles */}
          <div className="space-y-4">
             <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Rsync Options</h3>
             <div className="grid grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300">
                <label className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer transition-colors">
                   <input 
                     type="checkbox" 
                     checked={newJobConfig.archive} 
                     onChange={e => setNewJobConfig({...newJobConfig, archive: e.target.checked})}
                     className="rounded text-amber-600 w-4 h-4" 
                   />
                   Archive (-a)
                </label>
                <label className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer transition-colors">
                   <input 
                     type="checkbox" 
                     checked={newJobConfig.recursive} 
                     onChange={e => setNewJobConfig({...newJobConfig, recursive: e.target.checked})}
                     className="rounded text-amber-600 w-4 h-4" 
                   />
                   Recursive (-r)
                </label>
                <label className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer transition-colors">
                   <input 
                     type="checkbox" 
                     checked={newJobConfig.compress} 
                     onChange={e => setNewJobConfig({...newJobConfig, compress: e.target.checked})}
                     className="rounded text-amber-600 w-4 h-4" 
                   />
                   Compress (-z)
                </label>
                <label className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer transition-colors">
                   <input 
                     type="checkbox" 
                     checked={newJobConfig.delete} 
                     onChange={e => setNewJobConfig({...newJobConfig, delete: e.target.checked})}
                     className="rounded text-amber-600 w-4 h-4" 
                   />
                   Delete Extraneous
                </label>
                <label className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer transition-colors">
                   <input 
                     type="checkbox" 
                     checked={newJobConfig.verbose} 
                     onChange={e => setNewJobConfig({...newJobConfig, verbose: e.target.checked})}
                     className="rounded text-amber-600 w-4 h-4" 
                   />
                   Verbose (-v)
                </label>
             </div>
             <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Custom Flags</label>
                <input 
                  type="text" 
                  value={newJobConfig.customFlags}
                  onChange={e => setNewJobConfig({...newJobConfig, customFlags: e.target.value})}
                  placeholder="--dry-run --human-readable"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900 font-mono text-sm"
                />
             </div>
             {/* Exclude Patterns Refined */}
             <div className="pt-2">
               <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Exclude Patterns</label>
               <div 
                 className="min-h-[3.5rem] p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-wrap gap-2 items-center focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100 dark:focus:within:ring-amber-900 transition-all cursor-text"
                 onClick={() => document.getElementById('pattern-input')?.focus()}
               >
                 {newJobConfig.excludePatterns.map((p, i) => (
                   <span key={i} className="bg-gray-100 dark:bg-gray-700 pl-3 pr-2 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2 animate-fade-in">
                     {p}
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         setNewJobConfig(prev => ({...prev, excludePatterns: prev.excludePatterns.filter((_, idx) => idx !== i)}));
                       }}
                       className="hover:text-red-500 text-gray-400 transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 p-0.5"
                     >
                       <Icons.XCircle size={14} />
                     </button>
                   </span>
                 ))}
                 <input 
                   id="pattern-input"
                   type="text" 
                   value={tempExcludePattern}
                   onChange={(e) => setTempExcludePattern(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       e.preventDefault();
                       handleAddPattern();
                     }
                     if (e.key === 'Backspace' && !tempExcludePattern && newJobConfig.excludePatterns.length > 0) {
                        setNewJobConfig(prev => ({...prev, excludePatterns: prev.excludePatterns.slice(0, -1)}));
                     }
                   }}
                   placeholder={newJobConfig.excludePatterns.length === 0 ? "Type pattern (e.g. *.log) & press Enter" : ""}
                   className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white min-w-[150px] h-8 px-1"
                 />
               </div>
               <p className="text-xs text-gray-400 mt-2 pl-1">Type a file pattern and press Enter to add it.</p>
             </div>
          </div>

        </div>
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-3 sticky bottom-0">
          <div>
            {activeJobId && (
              <button 
                onClick={() => promptDelete(activeJobId)}
                className="px-4 py-2.5 rounded-xl font-medium text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
              >
                <Icons.Trash2 size={18} />
                <span className="hidden sm:inline">Delete Job</span>
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setView(activeJobId ? 'DETAIL' : 'DASHBOARD')} className="px-6 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">Cancel</button>
            <button 
              onClick={handleSaveJob}
              disabled={!newJobName || !newJobSource || !newJobDest}
              className="px-6 py-2.5 rounded-xl font-medium text-white bg-black dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeJobId ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderJobDetail = () => {
    const job = jobs.find(j => j.id === activeJobId);
    if (!job) return null;

    const chartData = job.snapshots.map((s, i, arr) => {
      const prevSize = i > 0 ? arr[i-1].sizeBytes : 0;
      const dataAdded = Math.max(0, s.sizeBytes - prevSize); // Only show positive growth for "Added"
      return {
        name: new Date(s.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        size: s.sizeBytes / (1024 * 1024),
        dataAdded: dataAdded / (1024 * 1024),
        changes: s.changesCount
      };
    });

    const latestSnapshot = job.snapshots[job.snapshots.length - 1];
    const analytics = latestSnapshot ? calculateJobStats(latestSnapshot.root) : null;
    
    // Muted Professional Palette
    // Blue, Emerald, Amber, Violet, Slate (500 range)
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b']; 

    return (
      <div className="h-screen flex flex-col relative z-10">
        {/* Header */}
        <div className="px-8 py-6 pt-10 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-10 text-gray-900 dark:text-white titlebar-drag">
          {isRunning && (
            <div className="absolute top-0 left-0 w-full h-1 z-20 overflow-hidden">
               <div className="w-full h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-progress-pulse opacity-80" />
            </div>
          )}
          <div className="flex items-center gap-4 no-drag">
            <button 
              onClick={() => setView('DASHBOARD')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <Icons.ArrowRight className="rotate-180 text-gray-500 dark:text-gray-400" />
            </button>
            <div>
              <h2 className="text-2xl font-bold">{job.name}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Icons.Server size={14} /> {job.sourcePath}
                <Icons.ArrowRight size={14} />
                <Icons.HardDrive size={14} /> {job.destPath}
              </div>
            </div>
          </div>
          <div className="flex gap-3 no-drag">
            <button 
              onClick={() => promptDelete(job.id)}
              className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
              title="Delete Job"
            >
              <Icons.Trash2 size={18} />
            </button>
            <div className="w-px h-8 bg-gray-200 dark:bg-gray-800 self-center mx-1"></div>
            <button 
              onClick={openSettings}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
            >
              Settings
            </button>
            {isRunning ? (
              <button 
                onClick={() => stopSync(job.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex items-center gap-2 shadow-sm transition-all animate-pulse"
              >
                <Icons.XCircle size={16} /> Stop Sync
              </button>
            ) : (
              <button 
                onClick={() => runSync(job.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 hover:shadow-teal-500/20 flex items-center gap-2 shadow-sm transition-all"
              >
                <Icons.Play size={16} /> Sync Now
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 space-y-8">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2 text-gray-500 dark:text-gray-400">
                <Icons.Database size={18} />
                <span className="text-sm font-medium">Total Size</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatBytes(job.snapshots[job.snapshots.length - 1]?.sizeBytes || 0)}
              </p>
            </div>
            <div className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2 text-gray-500 dark:text-gray-400">
                <Icons.Clock size={18} />
                <span className="text-sm font-medium">Last Sync</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {job.lastRun ? new Date(job.lastRun).toLocaleTimeString() : 'Never'}
              </p>
            </div>
            <div className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2 text-gray-500 dark:text-gray-400">
                <Icons.Clock size={18} />
                <span className="text-sm font-medium">Schedule</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                {formatSchedule(job.scheduleInterval)}
              </p>
            </div>
            <div className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2 text-gray-500 dark:text-gray-400">
                <Icons.Shield size={18} />
                <span className="text-sm font-medium">Mode</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white capitalize truncate">
                {job.mode.replace('_', ' ').toLowerCase()}
              </p>
            </div>
          </div>

          {/* Terminal / Status */}
          <div className={`transition-all duration-500 ${isTerminalExpanded ? 'fixed inset-0 z-50 bg-black/90 p-8 overflow-auto' : 'grid grid-cols-1 lg:grid-cols-5 gap-8'}`}>
            
            {/* If expanded, close button */}
            {isTerminalExpanded && (
              <button 
                onClick={() => setIsTerminalExpanded(false)}
                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full"
              >
                <Icons.XCircle size={24} />
              </button>
            )}

            <div className={`${isTerminalExpanded ? 'hidden' : 'lg:col-span-3 space-y-6'}`}>
               {/* Storage History Chart (CSS) - Data Added */}
               <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                   <Icons.BarChart2 size={20} /> Storage History (Data Added)
                </h3>
                <div className="h-64 w-full flex items-end justify-between gap-1">
                  {(() => {
                    const maxAdded = Math.max(...chartData.map(d => d.dataAdded), 0.1); // Avoid div/0
                    return chartData.slice(-20).map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center group relative">
                        <div 
                          className="w-full mx-0.5 bg-indigo-500/80 dark:bg-indigo-600 rounded-t transition-all hover:bg-indigo-400"
                          style={{ height: `${(d.dataAdded / maxAdded) * 100}%`, minHeight: '4px' }}
                        ></div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
                          {d.name}: +{d.dataAdded.toFixed(2)} MB
                        </div>
                      </div>
                    ));
                  })()}
                  {chartData.length === 0 && (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                      No snapshots yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Analytics Section (CSS Pie & List) */}
              {analytics && (
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                    <Icons.Activity size={20} /> Analytics
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* File Types Pie Chart */}
                    <div className="flex flex-col items-center">
                       <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">File Types</h4>
                       <div className="relative w-48 h-48 rounded-full" 
                            style={{
                              background: `conic-gradient(${
                                analytics.fileTypes.reduce((acc, type, i, arr) => {
                                  const total = analytics.fileTypes.reduce((sum, t) => sum + t.value, 0);
                                  const prevDeg = i === 0 ? 0 : (analytics.fileTypes.slice(0, i).reduce((sum, t) => sum + t.value, 0) / total) * 360;
                                  const currentDeg = ((type.value / total) * 360) + prevDeg;
                                  const color = COLORS[i % COLORS.length];
                                  return acc + `${color} ${prevDeg}deg ${currentDeg}deg${i === arr.length - 1 ? '' : ', '}`;
                                }, '')
                              })`
                            }}
                       >
                         {/* Donut Hole */}
                         <div className="absolute inset-0 m-auto w-32 h-32 bg-white dark:bg-gray-800 rounded-full flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-gray-900 dark:text-white">
                              {analytics?.fileTypes.reduce((acc, curr) => acc + curr.value, 0)}
                            </span>
                            <span className="text-xs text-gray-500">Files</span>
                         </div>
                       </div>
                       {/* Legend */}
                       <div className="flex flex-wrap justify-center gap-3 mt-6">
                          {analytics?.fileTypes.map((type, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="text-xs text-gray-600 dark:text-gray-300">{type.name}</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    {/* Largest Files List */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Largest Files</h4>
                      <div className="space-y-3">
                        {analytics?.largestFiles.map((file, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-lg text-teal-600 dark:text-teal-400 shrink-0">
                                <Icons.File size={16} />
                              </div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                                {file.name}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-100 dark:border-gray-700 shrink-0 ml-2">
                              {formatBytes(file.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Snapshots List */}
              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white">Snapshots</h3>
                   <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg text-xs font-medium">
                     <button 
                       onClick={() => setSnapshotGrouping('ALL')}
                       className={`px-3 py-1.5 rounded-md transition-all ${snapshotGrouping === 'ALL' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                     >
                       All
                     </button>
                     <button 
                       onClick={() => setSnapshotGrouping('DAY')}
                       className={`px-3 py-1.5 rounded-md transition-all ${snapshotGrouping === 'DAY' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                     >
                       Day
                     </button>
                     <button 
                       onClick={() => setSnapshotGrouping('MONTH')}
                       className={`px-3 py-1.5 rounded-md transition-all ${snapshotGrouping === 'MONTH' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                     >
                       Month
                     </button>
                     <button 
                       onClick={() => setSnapshotGrouping('YEAR')}
                       className={`px-3 py-1.5 rounded-md transition-all ${snapshotGrouping === 'YEAR' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                     >
                       Year
                     </button>
                   </div>
                 </div>
                 
                 {(() => {
                   const reversedSnapshots = job.snapshots.slice().reverse();
                   
                   if (snapshotGrouping === 'ALL') {
                     return reversedSnapshots.map((snap) => (
                       <div key={snap.id} className="flex items-center justify-between p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full text-green-600 dark:text-green-400">
                              <Icons.CheckCircle size={16} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-gray-200">{new Date(snap.timestamp).toLocaleString()}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{snap.fileCount} files • {snap.changesCount} changed</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                              {formatBytes(snap.sizeBytes)}
                            </span>
                            <button 
                                  onClick={() => { 
                                      if (window.electronAPI && job.destPath) {
                                          // Construct path to snapshot folder
                                          // Assuming Time Machine structure: dest/YYYY-MM-DD-HHMMSS
                                          // We need the folder name from timestamp
                                          const date = new Date(snap.timestamp);
                                          const y = date.getFullYear();
                                          const m = String(date.getMonth() + 1).padStart(2, '0');
                                          const d = String(date.getDate()).padStart(2, '0');
                                          const h = String(date.getHours()).padStart(2, '0');
                                          const min = String(date.getMinutes()).padStart(2, '0');
                                          const s = String(date.getSeconds()).padStart(2, '0');
                                          const folderName = `${y}-${m}-${d}-${h}${min}${s}`;
                                          
                                          const fullPath = job.mode === SyncMode.TIME_MACHINE 
                                              ? `${job.destPath}/${folderName}` 
                                              : job.destPath;
                                              
                                          window.electronAPI.openPath(fullPath);
                                      }
                                  }}
                                  className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  title="Open in Finder"
                                >
                                  <Icons.FolderOpen size={18} />
                                </button>
                          </div>
                       </div>
                     ));
                   }

                   // Grouping Logic
                   const groups: Record<string, typeof reversedSnapshots> = {};
                   reversedSnapshots.forEach(snap => {
                     const date = new Date(snap.timestamp);
                     let key = '';
                     if (snapshotGrouping === 'DAY') {
                       const today = new Date().toDateString();
                       const yesterday = new Date(Date.now() - 86400000).toDateString();
                       const snapDate = date.toDateString();
                       if (snapDate === today) key = 'Today';
                       else if (snapDate === yesterday) key = 'Yesterday';
                       else key = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                     } else if (snapshotGrouping === 'MONTH') {
                       key = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                     } else if (snapshotGrouping === 'YEAR') {
                       key = date.getFullYear().toString();
                     }
                     
                     if (!groups[key]) groups[key] = [];
                     groups[key].push(snap);
                   });

                   {/* Collapsible Groups */}
                   return Object.entries(groups).map(([groupName, snaps]) => (
                     <details key={groupName} open className="group/details space-y-3">
                       <summary className="py-2 bg-[#f5f5f7] dark:bg-[#0f0f10] text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none flex items-center gap-2 hover:text-gray-800 dark:hover:text-gray-200 transition-colors outline-none">
                         <Icons.ChevronDown className="w-4 h-4 transition-transform group-open/details:rotate-0 -rotate-90" />
                         {groupName}
                         <span className="ml-auto text-[10px] font-normal bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400">{snaps.length}</span>
                       </summary>
                       <div className="space-y-3 pl-2 border-l-2 border-gray-200 dark:border-gray-800 ml-2">
                         {snaps.map((snap) => (
                           <div key={snap.id} className="flex items-center justify-between p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                              <div className="flex items-center gap-4">
                                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full text-green-600 dark:text-green-400">
                                  <Icons.CheckCircle size={16} />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-800 dark:text-gray-200">{new Date(snap.timestamp).toLocaleTimeString()}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{snap.fileCount} files • {snap.changesCount} changed</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-mono text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                  {formatBytes(snap.sizeBytes)}
                                </span>
                                <button 
                                  onClick={() => { 
                                      if (window.electronAPI && job.destPath) {
                                          // Construct path to snapshot folder
                                          // Assuming Time Machine structure: dest/YYYY-MM-DD-HHMMSS
                                          // We need the folder name from timestamp
                                          const date = new Date(snap.timestamp);
                                          const y = date.getFullYear();
                                          const m = String(date.getMonth() + 1).padStart(2, '0');
                                          const d = String(date.getDate()).padStart(2, '0');
                                          const h = String(date.getHours()).padStart(2, '0');
                                          const min = String(date.getMinutes()).padStart(2, '0');
                                          const s = String(date.getSeconds()).padStart(2, '0');
                                          const folderName = `${y}-${m}-${d}-${h}${min}${s}`;
                                          
                                          const fullPath = job.mode === SyncMode.TIME_MACHINE 
                                              ? `${job.destPath}/${folderName}` 
                                              : job.destPath;
                                              
                                          window.electronAPI.openPath(fullPath);
                                      }
                                  }}
                                  className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  title="Open in Finder"
                                >
                                  <Icons.FolderOpen size={18} />
                                </button>
                              </div>
                           </div>
                         ))}
                       </div>
                     </details>
                   ));
                 })()}
              </div>
            </div>

            <div className={`${isTerminalExpanded ? 'w-full h-full flex flex-col' : 'lg:col-span-2'}`}>
              <h3 className={`text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2 ${isTerminalExpanded ? 'text-white' : ''}`}>
                Live Activity
                {isRunning && <span className="inline-flex w-2 h-2 bg-indigo-500 rounded-full animate-ping" />}
                {!isTerminalExpanded && (
                  <button onClick={() => setIsTerminalExpanded(true)} className="ml-auto text-xs text-gray-400 hover:text-indigo-500">Expand</button>
                )}
              </h3>
              
              {/* Progress Bar */}
              {isRunning && progress && (
                <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
                    <span>{progress.percentage > 0 ? `${progress.percentage}% Complete` : 'Syncing...'}</span>
                    <span>
                        {progress.speed} 
                        {progress.eta ? ` • ETA: ${progress.eta}` : ''}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative">
                    {progress.percentage > 0 ? (
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    ) : (
                      <div className="h-full bg-indigo-500/50 w-1/3 absolute top-0 animate-progress-pulse rounded-full" />
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-400 truncate">
                    {progress.currentFile ? `File: ${progress.currentFile}` : `Transferred: ${progress.transferred}`}
                  </div>
                </div>
              )}

              <div className={isTerminalExpanded ? 'flex-1' : ''}>
                 <Terminal logs={logs} isRunning={isRunning} />
              </div>
              
              {!isTerminalExpanded && (
                 <div className="mt-6 p-4 bg-blue-50/90 dark:bg-blue-900/10 backdrop-blur-sm rounded-xl border border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-start gap-3">
                    <Icons.Zap className="text-blue-500 dark:text-blue-400 mt-1" size={20} />
                    <div>
                      <h4 className="font-semibold text-blue-900 dark:text-blue-300">Config Insight</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-400 mt-1 leading-relaxed">
                        {job.mode === SyncMode.TIME_MACHINE 
                          ? "Time Machine mode is active. Files are hard-linked to the previous snapshot, meaning only changed files consume new disk space." 
                          : "Standard mirror mode. Destination is an exact copy of source."}
                        <br/>
                        {job.scheduleInterval 
                          ? `Automation active: Running ${formatSchedule(job.scheduleInterval).toLowerCase()}.`
                          : "Automation disabled: Manual sync only."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Analytics Section (Simplified - No Charts) */}
              {!isTerminalExpanded && latestSnapshot && (
                <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Icons.Activity size={16} /> Job Analytics
                  </h4>
                  <div className="space-y-4">
                     <div>
                       <h5 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">Largest Files</h5>
                       <div className="space-y-2">
                         {analytics?.largestFiles.slice(0, 3).map((file, i) => (
                           <div key={i} className="flex justify-between items-center text-xs group">
                             <div className="flex items-center gap-2 min-w-0 flex-1">
                               <span className="text-gray-700 dark:text-gray-300 truncate" title={file.name}>{file.name}</span>
                               <button
                                 onClick={() => {
                                     if (window.electronAPI && job.destPath) {
                                         // Construct path
                                         const date = new Date(latestSnapshot.timestamp);
                                         const y = date.getFullYear();
                                         const m = String(date.getMonth() + 1).padStart(2, '0');
                                         const d = String(date.getDate()).padStart(2, '0');
                                         const h = String(date.getHours()).padStart(2, '0');
                                         const min = String(date.getMinutes()).padStart(2, '0');
                                         const s = String(date.getSeconds()).padStart(2, '0');
                                         const folderName = `${y}-${m}-${d}-${h}${min}${s}`;
                                         
                                         const basePath = job.mode === SyncMode.TIME_MACHINE 
                                             ? `${job.destPath}/${folderName}` 
                                             : job.destPath;
                                         
                                         // file.path starts with / because we passed empty string as initial root
                                         window.electronAPI.showItemInFolder(`${basePath}${file.path}`);
                                     }
                                 }}
                                 className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all text-gray-400 hover:text-blue-500"
                                 title="Show in Finder"
                               >
                                 <Icons.Search size={12} />
                               </button>
                             </div>
                             <span className="font-mono text-gray-500 shrink-0 ml-2">{formatBytes(file.size)}</span>
                           </div>
                         ))}
                         {analytics?.largestFiles.length === 0 && <span className="text-xs text-gray-400">No files found.</span>}
                       </div>
                     </div>
                     <div>
                       <h5 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">File Types</h5>
                       <div className="flex flex-wrap gap-2">
                          {analytics?.fileTypes.slice(0, 5).map((type, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-300">
                              {type.name} ({type.value})
                            </span>
                          ))}
                       </div>
                     </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const isTopLevel = ['DASHBOARD', 'HISTORY', 'APP_SETTINGS'].includes(view);

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="flex min-h-screen bg-[#f5f5f7] dark:bg-[#0f0f10] text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300 relative">
        
        {/* Global Fixed Drag Bar - Replaces complex sticky drag regions for better performance */}
        <div className="fixed top-0 left-0 w-full h-8 z-[100] titlebar-drag" />

        <AmbientBackground />
        
        {renderDeleteModal()}
        {renderSnapshotViewer()}

        {/* Sidebar */}
        {isTopLevel && (
          <aside className="w-64 bg-white/80 dark:bg-[#161617]/80 backdrop-blur-md border-r border-gray-200 dark:border-gray-800 hidden md:flex flex-col transition-colors duration-300 relative z-10 pt-6">
            <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
              <Icons.Activity size={20} />
              </div>
              <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">Amber</span>
            </div>
            
            <nav className="flex-1 px-4 py-4 space-y-1">
              <button 
                onClick={() => setView('DASHBOARD')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  view === 'DASHBOARD' 
                    ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <Icons.Database size={18} /> Jobs
              </button>
              <button 
                onClick={() => setView('HISTORY')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  view === 'HISTORY' 
                    ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <Icons.List size={18} /> History
              </button>
              <button 
                onClick={() => setView('APP_SETTINGS')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  view === 'APP_SETTINGS' 
                    ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <Icons.Settings size={18} /> Settings
              </button>
            </nav>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <button 
                onClick={() => setDarkMode(!darkMode)}
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
        )}

        {/* Main Area */}
        <main className="flex-1 overflow-auto relative z-10">
          {view === 'DASHBOARD' && renderDashboard()}
          {view === 'HISTORY' && renderHistory()}
          {view === 'APP_SETTINGS' && renderAppSettings()}
          {view === 'DETAIL' && renderJobDetail()}
          {view === 'JOB_EDITOR' && renderJobEditor()}
        </main>

      </div>
    </div>
  );
}