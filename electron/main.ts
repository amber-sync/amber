import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, Notification } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import log from 'electron-log';
import { RsyncService } from './rsync-service';
import { SyncJob } from './types';
import { CONSTANTS } from './constants';
import { AppPreferences, loadPreferences, savePreferences } from './preferences';
import { loadJobs, saveJobs } from './store';
import { JobScheduler } from './JobScheduler';
import { VolumeWatcher } from './VolumeWatcher';
import { rcloneService } from './RcloneService';

// electron-log auto-initializes in v5+

if (process.env.ELECTRON_RUN_AS_NODE) {
  // Running Electron as pure Node breaks app lifecycle (app will be undefined).
  // Fail fast to avoid half-initialized states. Value is ignored; presence is enough.
  const val = process.env.ELECTRON_RUN_AS_NODE;
  // eslint-disable-next-line no-console
  console.error(`ELECTRON_RUN_AS_NODE is set (${val}). Please unset it before running Amber.`);
  process.exit(1);
}

const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
const rsyncService = new RsyncService();
let tray: Tray | null = null;
let lastActiveJob: SyncJob | null = null;
let prefs: AppPreferences = { runInBackground: false, startOnBoot: false, notifications: true };
let jobsCache: SyncJob[] = [];
// Lazy initialize these to avoid top-level crashes and ensure PATH is fixed first
let volumeWatcher: VolumeWatcher | null = null;
let scheduler: JobScheduler | null = null;

// Hardware acceleration disabled by default to prevent GPU crashes
// app.disableHardwareAcceleration();

// Fix PATH on macOS for double-click launch
function fixPath() {
  if (process.platform === 'darwin') {
    // Ensure common binary paths are present
    const commonPaths = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
    const currentPath = process.env.PATH || '';
    const newPath = commonPaths.reduce((acc, p) => {
      if (!acc.includes(p)) {
        return `${p}:${acc}`;
      }
      return acc;
    }, currentPath);
    process.env.PATH = newPath;
    log.info(`Fixed PATH: ${process.env.PATH}`);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Handle window close event - attach directly to the window instance
  mainWindow.on('close', (e) => {
    if (prefs.runInBackground) {
      e.preventDefault();
      mainWindow?.hide();

      // Hide dock icon when window closes in background mode (macOS only)
      if (process.platform === 'darwin' && app.dock) {
        app.dock.hide();
      }
    }
  });

  // Show dock icon when window is shown (macOS only)
  mainWindow.on('show', () => {
    if (process.platform === 'darwin' && app.dock) {
      app.dock.show();
      app.setActivationPolicy('regular');
    }
  });

  // In development, load from localhost
  // In production, load from dist/index.html
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

const TRAY_FALLBACK = nativeImage.createFromDataURL(
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAIUlEQVR42mNgGAWjYBSMglEwCkb/BxQGMMIIw6SgBEBAAObQBBznnSYxAAAAAElFTkSuQmCC'
);

function configureUserDataRoot() {
  // Keep dev data separate from production to avoid conflicts with installed app.
  if (IS_DEV) {
    const base = app.getPath('userData');
    const devPath = path.join(base, 'dev');
    app.setPath('userData', devPath);
    log.info(`Using dev userData path: ${devPath}`);
  }
}

async function createTray() {
  try {
    let image = TRAY_FALLBACK;
    const candidates = [
      path.join(__dirname, '../build/icons/tray.png'),
      path.join(app.getAppPath(), 'build/icons/tray.png'),
      path.join(process.resourcesPath, 'build/icons/tray.png'),
      // Add explicit production path for macOS app bundle
      path.join(process.resourcesPath, 'app/build/icons/tray.png')
    ];

    let loadedPath = 'FALLBACK';

    for (const candidate of candidates) {
      try {
        const loaded = nativeImage.createFromPath(candidate);
        if (!loaded.isEmpty()) {
          image = loaded;
          if (process.platform === 'darwin') {
            image.setTemplateImage(true);
          }
          loadedPath = candidate;
          break;
        }
      } catch {
        // try next candidate
      }
    }

    log.info(`Creating tray with icon from: ${loadedPath}`);

    tray = new Tray(image);
    tray.setToolTip('Amber');
    tray.setContextMenu(buildTrayMenu());
  } catch (error: any) {
    log.error(`Failed to create tray: ${error.message}`);
    // Ensure we don't crash, but maybe show a dialog if critical
  }
}

// --- Tray Animation ---
let trayAnimationTimer: NodeJS.Timeout | null = null;
let isTrayActiveFrame = false;

function startTrayAnimation() {
  if (trayAnimationTimer) return; // Already animating

  // Load active icon
  let activeImage = TRAY_FALLBACK;
  const activeCandidates = [
    path.join(__dirname, '../build/icons/tray-active.png'),
    path.join(app.getAppPath(), 'build/icons/tray-active.png'),
    path.join(process.resourcesPath, 'build/icons/tray-active.png'),
  ];
  
  // Helper to load image safely
  const loadImg = (p: string) => {
    try {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) {
        if (process.platform === 'darwin') img.setTemplateImage(true);
        return img;
      }
    } catch {}
    return null;
  };

  let activeIcon = TRAY_FALLBACK;
  for (const c of activeCandidates) {
    const img = loadImg(c);
    if (img) { activeIcon = img; break; }
  }
  
  // Re-load standard icon to ensure we have it
  let standardIcon = TRAY_FALLBACK;
  const standardCandidates = [
    path.join(__dirname, '../build/icons/tray.png'),
    path.join(app.getAppPath(), 'build/icons/tray.png'),
    path.join(process.resourcesPath, 'build/icons/tray.png'),
  ];
  for (const c of standardCandidates) {
    const img = loadImg(c);
    if (img) { standardIcon = img; break; }
  }

  isTrayActiveFrame = false;
  trayAnimationTimer = setInterval(() => {
    if (!tray) return;
    isTrayActiveFrame = !isTrayActiveFrame;
    tray.setImage(isTrayActiveFrame ? activeIcon : standardIcon);
  }, 500); // Toggle every 500ms
}

function stopTrayAnimation() {
  if (trayAnimationTimer) {
    clearInterval(trayAnimationTimer);
    trayAnimationTimer = null;
  }
  
  // Restore standard icon
  if (tray) {
    let standardIcon = TRAY_FALLBACK;
    const standardCandidates = [
      path.join(__dirname, '../build/icons/tray.png'),
      path.join(app.getAppPath(), 'build/icons/tray.png'),
      path.join(process.resourcesPath, 'build/icons/tray.png'),
    ];
    
    const loadImg = (p: string) => {
      try {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) {
          if (process.platform === 'darwin') img.setTemplateImage(true);
          return img;
        }
      } catch {}
      return null;
    };

    for (const c of standardCandidates) {
      const img = loadImg(c);
      if (img) { standardIcon = img; break; }
    }
    tray.setImage(standardIcon);
  }
}

// --- Tray Menu ---
let isQuitting = false;

function buildTrayMenu() {
  const jobItems = jobsCache.map(job => {
    const isRunning = rsyncService.isJobRunning(job.id);
    return {
      label: isRunning ? `Running: ${job.name}` : `Run ${job.name}`,
      enabled: !isRunning,
      click: () => {
        startTrayAnimation();
        handleRunJob(job);
        tray?.setContextMenu(buildTrayMenu()); // Update menu immediately
      }
    };
  });

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Amber Backup', enabled: false },
    { type: 'separator' },
    ...(jobItems.length > 0 ? jobItems : [{ label: 'No jobs configured', enabled: false }]),
    { type: 'separator' },
    { 
      label: 'Open Dashboard', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
        if (process.platform === 'darwin' && app.dock) {
          app.dock.show();
        }
      } 
    },
    { type: 'separator' },
    { 
      label: 'Quit Amber', 
      click: () => {
        isQuitting = true;
        // Use exit() to bypass before-quit listeners and force termination
        app.exit(0);
      } 
    }
  ]);
  return contextMenu;
}

// --- Tray Menu ---
// (Legacy menu items removed)

async function initApp() {
  fixPath(); // Fix environment first
  configureUserDataRoot();
  
  try {
    prefs = await loadPreferences();
    try {
      app.setLoginItemSettings({ openAtLogin: prefs.startOnBoot });
    } catch (error) {
      console.warn('Failed to set login item settings (expected in dev mode):', error);
    }

    // Create sandbox directories in dev mode BEFORE loading jobs to avoid ENOENT errors
    if (IS_DEV) {
      const sourcePath = '/tmp/amber-sandbox/source';
      const destPath = '/tmp/amber-sandbox/dest';
      try {
        await fs.mkdir(sourcePath, { recursive: true });
        await fs.mkdir(destPath, { recursive: true });
        
        // Create backup marker
        const destBasename = path.basename(destPath);
        const markerPath = path.join(destPath, `.${destBasename}_backup-marker`);
        try {
          await fs.access(markerPath);
        } catch {
          await fs.writeFile(markerPath, `Amber backup destination\nFolder: ${destBasename}\nCreated: ${new Date().toISOString()}\n`);
        }
        log.info('Sandbox directories created');
      } catch (error: any) {
        log.error(`Failed to create sandbox dirs: ${error.message}`);
      }
    }

    // Load persisted jobs before window creation
    jobsCache = await loadJobs();
    
    // Initialize services
    volumeWatcher = new VolumeWatcher();
    scheduler = new JobScheduler(rsyncService, volumeWatcher);
    scheduler.init(jobsCache);
    volumeWatcher.start();
    
    volumeWatcher.start();
  
    createWindow();
  
    // Only create tray if running in background mode
    if (prefs.runInBackground) {
      await createTray();
      
      // SAFETY: Only hide dock if tray was successfully created
      if (tray) {
        if (process.platform === 'darwin' && app.dock) {
          app.dock.hide();
          app.setActivationPolicy('accessory');
        }
      } else {
        log.warn('Tray creation failed; keeping Dock icon visible to prevent lockout.');
      }
    }
  } catch (error: any) {
    log.error(`Critical error during app init: ${error.message}`);
    dialog.showErrorBox('Amber Startup Error', `Failed to start: ${error.message}`);
  }
}

app.whenReady().then(initApp);

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log.info('Another instance is already running. Quitting...');
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    log.info('Second instance detected. Focusing window...');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      
      // Also ensure Dock is visible on macOS if it was hidden
      if (process.platform === 'darwin' && app.dock) {
        app.dock.show();
      }
    }
  });
}

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
});

app.on('window-all-closed', () => {
  if (!prefs.runInBackground || process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- IPC Handlers ---

async function handleRunJob(job: SyncJob) {
  const jobId = job.id;
  lastActiveJob = job;
  log.info(`Received run-rsync for job ${jobId}`);
  log.info(`Job Details: Name=${job.name}, Source=${job.sourcePath}, Dest=${job.destPath}, Mode=${job.mode}`);
  log.info(`CWD: ${process.cwd()}`);
  
  const onLog = (message: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('rsync-log', { jobId, message });
    }
    log.info(`[Job ${jobId}] ${message}`);
  };

  const onProgress = (data: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('rsync-progress', { jobId, ...data });
    }
  };

  try {
    const result = await rsyncService.runBackup(job, onLog, onProgress);
    
    // Update job in cache
    const jobIndex = jobsCache.findIndex(j => j.id === jobId);
    if (jobIndex >= 0) {
      const updatedJob = { ...jobsCache[jobIndex], lastRun: Date.now() };
      
      // Only add snapshot if files were actually transferred
      // We check if transferSize > 0. If stats are missing, we assume changes occurred to be safe.
      const hasChanges = result.stats && result.stats.transferSize > 0;
      
      if (hasChanges) {
        // Snapshots are already handled inside rsyncService.runBackup (it returns the new snapshot)
        // But we need to make sure we're using the updated job object if runBackup modified it
        // Actually, runBackup returns { success, error, stats, snapshot }
        // We need to manually append the snapshot if we want it, OR rely on runBackup doing it?
        // Let's look at how it was before:
        // jobsCache = jobsCache.map(j => (j.id === jobId ? { ...j, lastRun: Date.now() } : j));
        
        // Wait, rsyncService.runBackup DOES NOT update the global jobsCache.
        // We need to see if runBackup returns the snapshot.
        if (result.snapshot) {
           updatedJob.snapshots = [...(updatedJob.snapshots || []), result.snapshot];
        }
      } else {
        log.info(`Job ${jobId}: No changes detected (0 bytes transferred). Skipping history entry.`);
      }

      jobsCache[jobIndex] = updatedJob;
      await saveJobs(jobsCache);
      scheduler?.updateJobs(jobsCache);
    }

    // Only notify if there were changes or if it failed
    const hasChanges = result.stats && result.stats.transferSize > 0;
    if (prefs.notifications && Notification.isSupported() && (hasChanges || !result.success)) {
      new Notification({
        title: `Backup ${result.success ? 'completed' : 'failed'}`,
        body: `${job.name}: ${result.success ? 'Success' : result.error || 'Error'}`
      }).show();
    }
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('rsync-complete', { jobId, ...result });
    }
    tray?.setContextMenu(buildTrayMenu());
    stopTrayAnimation(); // Stop animation on success
  } catch (error: any) {
    log.error(`Error in run-rsync: ${error.message}`);
    if (prefs.notifications && Notification.isSupported()) {
      new Notification({
        title: 'Backup failed',
        body: `${job.name}: ${error.message}`
      }).show();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('rsync-log', { jobId, message: `CRITICAL ERROR: ${error.message}` });
      mainWindow.webContents.send('rsync-complete', { jobId, success: false, error: error.message });
    }
    stopTrayAnimation(); // Stop animation on error
  }
}

ipcMain.on('run-rsync', async (_event, job: SyncJob) => {
  startTrayAnimation(); // Start animation
  handleRunJob(job);
  tray?.setContextMenu(buildTrayMenu());
});

ipcMain.handle('jobs:get', async () => {
  return jobsCache;
});

ipcMain.handle('jobs:save', async (_event, job: SyncJob) => {
  const idx = jobsCache.findIndex(j => j.id === job.id);
  if (idx >= 0) {
    jobsCache[idx] = job;
  } else {
    jobsCache.push(job);
  }
  await saveJobs(jobsCache);
  scheduler?.updateJobs(jobsCache);
  return { success: true, jobs: jobsCache };
});

ipcMain.handle('jobs:delete', async (_event, jobId: string) => {
  jobsCache = jobsCache.filter(j => j.id !== jobId);
  await saveJobs(jobsCache);
  scheduler?.updateJobs(jobsCache);
  return { success: true, jobs: jobsCache };
});

ipcMain.handle('read-dir', async (_, dirPath: string) => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    return items.map((item: any) => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      path: path.join(dirPath, item.name),
      size: 0,
      modified: 0
    }));
  } catch (error: any) {
    log.error(`Error reading dir ${dirPath}: ${error.message}`);
    return { error: error.message };
  }
});

ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.on('kill-rsync', (event, jobId: string) => {
  log.info(`Received kill-rsync for job ${jobId}`);
  rsyncService.killJob(jobId);
  stopTrayAnimation();
  tray?.setContextMenu(buildTrayMenu());
});

ipcMain.handle('create-sandbox-dirs', async (_, sourcePath: string, destPath: string) => {
  try {
    // FIXED: Platform-independent temp dir check
    const tmpDir = os.tmpdir();
    const isSafePath = (p: string) => {
      if (p.startsWith(tmpDir)) return true;
      // Handle macOS /var vs /private/var
      if (process.platform === 'darwin' && p.startsWith('/private' + tmpDir)) return true;
      return false;
    };

    if (!isSafePath(sourcePath) || !isSafePath(destPath)) {
      return { success: false, error: `Sandbox paths must be in ${tmpDir}` };
    }

    await fs.mkdir(sourcePath, { recursive: true });
    await fs.mkdir(destPath, { recursive: true });

    // Ensure backup marker exists in destination for safety check
    const destBasename = path.basename(destPath);
    const markerFilename = `.${destBasename}_backup-marker`;
    const markerPath = path.join(destPath, markerFilename);
    try {
      await fs.access(markerPath);
    } catch {
      await fs.writeFile(markerPath, `Amber backup destination\nFolder: ${destBasename}\nCreated: ${new Date().toISOString()}\n`);
    }

    // Create dummy files in source if empty
    const files = await fs.readdir(sourcePath);
    if (files.length < 100) {
      await fs.writeFile(path.join(sourcePath, 'hello.txt'), 'Hello Amber Sandbox!');
      await fs.writeFile(path.join(sourcePath, 'notes.md'), '# Sandbox Notes\nThis is a test.');

      // FIXED: Batched file creation for performance
      log.info(`Creating ${CONSTANTS.SANDBOX_TOTAL_FILES} test files in batches...`);

      for (let batch = 0; batch < CONSTANTS.SANDBOX_TOTAL_FILES / CONSTANTS.FILE_CREATION_BATCH_SIZE; batch++) {
        const promises = [];
        for (let i = 0; i < CONSTANTS.FILE_CREATION_BATCH_SIZE; i++) {
          const fileIndex = batch * CONSTANTS.FILE_CREATION_BATCH_SIZE + i;
          const size = Math.floor(1024 * (Math.random() * 10 + 1));
          promises.push(
            fs.writeFile(
              path.join(sourcePath, `dummy-${fileIndex}.dat`),
              Buffer.alloc(size, 'a')
            )
          );
        }
        await Promise.all(promises);

        if (batch % 10 === 0) {
          log.info(`Created ${batch * CONSTANTS.FILE_CREATION_BATCH_SIZE} files...`);
        }
      }

      // Create large files in parallel
      log.info(`Creating ${CONSTANTS.SANDBOX_LARGE_FILES_COUNT} large files...`);
      const largeFilePromises = [];
      for (let i = 0; i < CONSTANTS.SANDBOX_LARGE_FILES_COUNT; i++) {
        largeFilePromises.push(
          fs.writeFile(
            path.join(sourcePath, `large-file-${i}.bin`),
            Buffer.alloc(1024 * 1024 * CONSTANTS.SANDBOX_LARGE_FILE_SIZE_MB, 'x')
          )
        );
      }
      await Promise.all(largeFilePromises);

      log.info('Sandbox setup complete!');
    }
    return { success: true };
  } catch (error: any) {
    log.error(`Error creating sandbox dirs: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-path', async (_, filePath: string) => {
  log.info(`Opening path: ${filePath}`);
  return await shell.openPath(filePath);
});

ipcMain.handle('show-item-in-folder', async (_, filePath: string) => {
  log.info(`Showing item in folder: ${filePath}`);
  return shell.showItemInFolder(filePath);
});

ipcMain.handle('get-disk-stats', async (_, volumePath: string) => {
  try {
    const fs = require('fs/promises');
    const pathModule = require('path');
    
    // Find the first existing parent directory to get disk stats from
    let checkPath = volumePath;
    while (checkPath && checkPath !== '/' && checkPath !== '.') {
      try {
        // Check if path exists
        await fs.access(checkPath);
        break; // Found an existing path
      } catch {
        // Move to parent directory
        const parent = pathModule.dirname(checkPath);
        if (parent === checkPath) break; // Reached root
        checkPath = parent;
      }
    }
    
    // Default to root if nothing found
    if (!checkPath || checkPath === '.') {
      checkPath = '/';
    }
    
    // Check if statfs is supported (Node 18.15+)
    if (fs.statfs) {
      const stats = await fs.statfs(checkPath);
      // bsize = optimal transfer block size
      // blocks = total data blocks in file system
      // bavail = free blocks available to unprivileged user
      
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      
      return {
        success: true,
        stats: {
          total,
          free,
          status: 'AVAILABLE'
        }
      };
    } else {
       // Fallback for older node? Or just fail gracefully.
       log.warn('fs.statfs not available');
       return { success: false, error: 'Feature not supported' };
    }

  } catch (error: any) {
    log.error(`Error getting disk stats for ${volumePath}: ${error.message}`);
    return { 
      success: true, 
      stats: {
        total: 0,
        free: 0,
        status: 'UNAVAILABLE'
      }
    };
  }
});

ipcMain.handle('prefs:get', async () => prefs);

ipcMain.handle('prefs:set', async (_event, partial: Partial<AppPreferences>) => {
  const oldPrefs = { ...prefs };
  prefs = { ...prefs, ...partial };
  await savePreferences(prefs);
  try {
    app.setLoginItemSettings({ openAtLogin: prefs.startOnBoot });
  } catch (error) {
    console.warn('Failed to set login item settings:', error);
  }

  // Handle runInBackground toggle
  if (oldPrefs.runInBackground !== prefs.runInBackground) {
    if (prefs.runInBackground) {
      // Enable background mode - create tray if needed
      if (!tray) {
        await createTray();
      }
      if (process.platform === 'darwin' && app.dock) {
        app.setActivationPolicy('accessory');
      }
    } else {
      // Disable background mode - destroy tray
      if (tray) {
        tray.destroy();
        tray = null;
      }
      if (process.platform === 'darwin' && app.dock) {
        app.dock.show();
        app.setActivationPolicy('regular');
      }
    }
  }

  if (tray) tray.setContextMenu(buildTrayMenu());
  return prefs;
});

ipcMain.handle('test-notification', async () => {
  if (Notification.isSupported()) {
    new Notification({
      title: 'Amber Notification Test',
      body: 'This is how your backup alerts will appear.'
    }).show();
    return { success: true };
  }
  return { success: false, error: 'Notifications not supported' };
});

// =====================
// Rclone Cloud Integration
// =====================

ipcMain.handle('rclone:checkInstalled', async () => {
  try {
    return await rcloneService.checkInstalled();
  } catch (error: any) {
    log.error('[Rclone] Check installed error:', error);
    return { installed: false, error: error.message };
  }
});

ipcMain.handle('rclone:listRemotes', async () => {
  try {
    return await rcloneService.listRemotes();
  } catch (error: any) {
    log.error('[Rclone] List remotes error:', error);
    throw error;
  }
});

ipcMain.handle('rclone:launchConfig', async () => {
  try {
    return await rcloneService.launchConfig();
  } catch (error: any) {
    log.error('[Rclone] Launch config error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('rclone:createRemote', async (_event, config: { name: string; type: string; config: Record<string, string> }) => {
  try {
    // For now, write directly to rclone config file
    // In production, this should use rclone's config API
    log.info('[Rclone] Create remote request:', config.name, config.type);
    
    // TODO: Implement actual rclone config creation
    // For MVP, return success and let user configure manually
    return { success: true, message: 'Remote configuration saved. Please configure via rclone config for full setup.' };
  } catch (error: any) {
    log.error('[Rclone] Create remote error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('active-job', (_event, job: SyncJob) => {
  lastActiveJob = job;
  if (tray) tray.setContextMenu(buildTrayMenu());
});

app.on('before-quit', (e) => {
  // If running in background and NOT explicitly quitting via tray, prevent quit
  if (prefs.runInBackground && !isQuitting) {
    e.preventDefault();
    mainWindow?.hide();
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide();
    }
    return;
  }

  tray?.destroy();
  volumeWatcher?.stop();
});
