import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import log from 'electron-log';
import { RsyncService } from './rsync-service';
import { SyncJob } from './types';

log.initialize();

let mainWindow: BrowserWindow | null = null;
const rsyncService = new RsyncService();

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

  // In development, load from localhost
  // In production, load from dist/index.html
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- IPC Handlers ---

ipcMain.on('run-rsync', async (event, job: SyncJob) => {
  const jobId = job.id;
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('rsync-complete', { jobId, ...result });
    }
  } catch (error: any) {
    log.error(`Error in run-rsync: ${error.message}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('rsync-log', { jobId, message: `CRITICAL ERROR: ${error.message}` });
      mainWindow.webContents.send('rsync-complete', { jobId, success: false, error: error.message });
    }
  }
});

ipcMain.handle('read-dir', async (_, dirPath: string) => {
  try {
    const fs = require('fs/promises');
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    return items.map((item: any) => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      path: path.join(dirPath, item.name),
      size: 0, // TODO: get stats if needed, but slow for large dirs
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
});

ipcMain.handle('create-sandbox-dirs', async (_, sourcePath: string, destPath: string) => {
  try {
    const fs = require('fs/promises');
    // Ensure paths are absolute and safe-ish (simple check)
    if (!sourcePath.startsWith('/tmp') || !destPath.startsWith('/tmp')) {
        return { success: false, error: 'Sandbox paths must be in /tmp' };
    }
    await fs.mkdir(sourcePath, { recursive: true });
    await fs.mkdir(destPath, { recursive: true });
    
    // Ensure backup.marker exists in destination for safety check
    const markerPath = path.join(destPath, 'backup.marker');
    try {
        await fs.access(markerPath);
    } catch {
        await fs.writeFile(markerPath, '');
    }
    
    // Create a dummy file in source if empty
    const files = await fs.readdir(sourcePath);
    if (files.length < 100) {
        await fs.writeFile(path.join(sourcePath, 'hello.txt'), 'Hello Amber Sandbox!');
        await fs.writeFile(path.join(sourcePath, 'notes.md'), '# Sandbox Notes\nThis is a test.');
        
        // Create many small files to simulate load (10,000 files)
        for (let i = 0; i < 10000; i++) {
            // Write in batches to be faster
            if (i % 100 === 0) await new Promise(r => setTimeout(r, 0));
            await fs.writeFile(path.join(sourcePath, `dummy-${i}.dat`), Buffer.alloc(1024 * (Math.random() * 10 + 1), 'a')); // 1-10KB each
        }

        // Create a few large files (5 x 50MB)
        for (let i = 0; i < 5; i++) {
             await fs.writeFile(path.join(sourcePath, `large-file-${i}.bin`), Buffer.alloc(1024 * 1024 * 50, 'x'));
        }
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
