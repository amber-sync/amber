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
const volumeWatcher = new VolumeWatcher();
const scheduler = new JobScheduler(rsyncService, volumeWatcher);

// Hardware acceleration disabled by default to prevent GPU crashes
// app.disableHardwareAcceleration();

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
  let image = TRAY_FALLBACK;
  const candidates = [
    path.join(__dirname, '../build/icons/tray.png'),
    path.join(app.getAppPath(), 'build/icons/tray.png'),
    path.join(process.resourcesPath, 'build/icons/tray.png'),
  ];

  for (const candidate of candidates) {
    try {
      const loaded = nativeImage.createFromPath(candidate);
      if (!loaded.isEmpty()) {
        image = loaded;
        if (process.platform === 'darwin') {
          image.setTemplateImage(true);
        }
        break;
      }
    } catch {
      // try next candidate
    }
  }

  tray = new Tray(image);
  tray.setToolTip('Amber');
  // On macOS, clicking the tray icon shows the menu (no need for explicit click handler)
  // The menu has "Open Amber" option for showing the window
  tray.setContextMenu(buildTrayMenu());
}

function buildTrayMenu() {
  const running = lastActiveJob ? rsyncService.isJobRunning(lastActiveJob.id) : false;
  return Menu.buildFromTemplate([
    {
      label: 'Open Amber',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          // Show dock when opening from tray
          if (process.platform === 'darwin' && app.dock) {
            app.dock.show();
            app.setActivationPolicy('regular');
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: lastActiveJob ? `Start Backup (${lastActiveJob.name})` : 'Start Backup (no job selected)',
      enabled: Boolean(lastActiveJob) && !running,
      click: () => {
        if (lastActiveJob) handleRunJob(lastActiveJob);
      }
    },
    {
      label: lastActiveJob ? `Stop Backup (${lastActiveJob.name})` : 'Stop Backup',
      enabled: Boolean(lastActiveJob) && running,
      click: () => {
        if (lastActiveJob) rsyncService.killJob(lastActiveJob.id);
      }
    },
    { type: 'separator' },
    {
      label: 'Jobs',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          if (process.platform === 'darwin' && app.dock) {
            app.dock.show();
            app.setActivationPolicy('regular');
          }
          mainWindow.webContents.send('navigate-view', 'DASHBOARD');
        }
      }
    },
    {
      label: 'History',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          if (process.platform === 'darwin' && app.dock) {
            app.dock.show();
            app.setActivationPolicy('regular');
          }
          mainWindow.webContents.send('navigate-view', 'HISTORY');
        }
      }
    },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          if (process.platform === 'darwin' && app.dock) {
            app.dock.show();
            app.setActivationPolicy('regular');
          }
          mainWindow.webContents.send('navigate-view', 'APP_SETTINGS');
        }
      }
    },
    {
      label: 'Help',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          if (process.platform === 'darwin' && app.dock) {
            app.dock.show();
            app.setActivationPolicy('regular');
          }
          mainWindow.webContents.send('navigate-view', 'HELP');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      role: 'quit'
    }
  ]);
}

async function initApp() {
  configureUserDataRoot();
  prefs = await loadPreferences();
  app.setLoginItemSettings({ openAtLogin: prefs.startOnBoot });

  // Load persisted jobs before window creation
  jobsCache = await loadJobs();
  jobsCache = await loadJobs();
  scheduler.init(jobsCache);
  volumeWatcher.start();

  createWindow();

  // Only create tray if running in background mode
  if (prefs.runInBackground) {
    await createTray();
    // Set as accessory app (menu bar only, no dock on startup)
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide();
      app.setActivationPolicy('accessory');
    }
  }
}

app.whenReady().then(initApp);

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
    jobsCache = jobsCache.map(j => (j.id === jobId ? { ...j, lastRun: Date.now() } : j));
    await saveJobs(jobsCache);
    scheduler.updateJobs(jobsCache);
    if (prefs.notifications && Notification.isSupported()) {
      new Notification({
        title: `Backup ${result.success ? 'completed' : 'failed'}`,
        body: `${job.name}: ${result.success ? 'Success' : result.error || 'Error'}`
      }).show();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('rsync-complete', { jobId, ...result });
    }
    tray?.setContextMenu(buildTrayMenu());
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
  }
}

ipcMain.on('run-rsync', async (_event, job: SyncJob) => {
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
  scheduler.updateJobs(jobsCache);
  return { success: true, jobs: jobsCache };
});

ipcMain.handle('jobs:delete', async (_event, jobId: string) => {
  jobsCache = jobsCache.filter(j => j.id !== jobId);
  await saveJobs(jobsCache);
  scheduler.updateJobs(jobsCache);
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
    // Check if statfs is supported (Node 18.15+)
    if (fs.statfs) {
      const stats = await fs.statfs(volumePath);
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
  app.setLoginItemSettings({ openAtLogin: prefs.startOnBoot });

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

ipcMain.on('active-job', (_event, job: SyncJob) => {
  lastActiveJob = job;
  if (tray) tray.setContextMenu(buildTrayMenu());
});

app.on('before-quit', () => {
  tray?.destroy();
  volumeWatcher.stop();
});
