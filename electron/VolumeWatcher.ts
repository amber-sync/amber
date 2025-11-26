import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export class VolumeWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private volumesPath = '/Volumes';

  constructor() {
    super();
  }

  public start() {
    console.log('Starting VolumeWatcher on', this.volumesPath);
    
    // Ignore initial add events to avoid triggering for already mounted drives
    this.watcher = chokidar.watch(this.volumesPath, {
      depth: 0,
      ignoreInitial: true,
      persistent: true,
      usePolling: false, // Native events are better for /Volumes
    });

    this.watcher.on('addDir', (dirPath: string) => {
      // chokidar returns the full path
      console.log(`Volume mounted: ${dirPath}`);
      this.emit('mount', dirPath);
    });

    this.watcher.on('unlinkDir', (dirPath: string) => {
      console.log(`Volume unmounted: ${dirPath}`);
      this.emit('unmount', dirPath);
    });

    this.watcher.on('error', (error: Error) => {
      console.error('VolumeWatcher error:', error);
    });
  }

  public stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
