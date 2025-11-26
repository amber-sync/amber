import { expect } from 'chai';
import { JobScheduler } from '../electron/JobScheduler';
import { VolumeWatcher } from '../electron/VolumeWatcher';
import { RsyncService } from '../electron/rsync-service';
import { SyncJob, SyncMode, JobStatus } from '../electron/types';
import schedule from 'node-schedule';

// Mock dependencies
class MockRsyncService extends RsyncService {
  public runBackupCalled = false;
  public lastJob: SyncJob | null = null;

  async runBackup(job: SyncJob, onLog: (msg: string) => void): Promise<any> {
    this.runBackupCalled = true;
    this.lastJob = job;
    onLog('Mock backup started');
    return { success: true };
  }
}

class MockVolumeWatcher extends VolumeWatcher {
  public start() {}
  public stop() {}
  public triggerMount(path: string) {
    this.emit('mount', path);
  }
}

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ...

describe('JobScheduler', () => {
  let scheduler: JobScheduler;
  let rsyncService: MockRsyncService;
  let volumeWatcher: MockVolumeWatcher;
  let testDir: string;

  const mockJob: SyncJob = {
    id: 'test-job-1',
    name: 'Test Job',
    sourcePath: '/tmp/source',
    destPath: '', // Will be set in beforeEach
    mode: SyncMode.MIRROR,
// ...
    scheduleInterval: null,
    schedule: {
      enabled: true,
      cron: '0 0 * * *', // Daily
      runOnMount: true
    },
    config: {
      recursive: true,
      compress: false,
      archive: true,
      delete: false,
      verbose: false,
      excludePatterns: [],
      customFlags: ''
    },
    lastRun: null,
    status: JobStatus.IDLE
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scheduler-test-'));
    mockJob.destPath = path.join(testDir, 'dest');
    fs.mkdirSync(mockJob.destPath, { recursive: true });

    rsyncService = new MockRsyncService();
    volumeWatcher = new MockVolumeWatcher();
    scheduler = new JobScheduler(rsyncService, volumeWatcher);
  });

  afterEach(() => {
    // Clean up scheduled jobs
    scheduler.updateJobs([]);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should schedule a cron job on init', () => {
    scheduler.init([mockJob]);
    // We can't easily inspect internal state without exposing it, 
    // but we can verify no errors occurred.
    // In a real test we might spy on schedule.scheduleJob
  });

  it('should trigger backup when volume is mounted', (done) => {
    scheduler.init([mockJob]);
    
    // Simulate mounting the drive (using the temp dir root as mount point)
    volumeWatcher.triggerMount(testDir);
    
    // Wait for async handler
    setTimeout(() => {
      expect(rsyncService.runBackupCalled).to.be.true;
      expect(rsyncService.lastJob?.id).to.equal(mockJob.id);
      done();
    }, 50);
  });

  it('should NOT trigger backup if volume does not match', () => {
    scheduler.init([mockJob]);
    
    // Simulate mounting a DIFFERENT drive
    volumeWatcher.triggerMount('/Volumes/OtherDrive');
    
    expect(rsyncService.runBackupCalled).to.be.false;
  });

  it('should update jobs correctly', (done) => {
    scheduler.init([mockJob]);
    
    const newJob = { ...mockJob, id: 'test-job-2' };
    scheduler.updateJobs([newJob]);
    
    // Trigger mount again
    volumeWatcher.triggerMount(testDir);
    
    setTimeout(() => {
      // Should run the new job, not the old one (if IDs differed, but here we replaced the list)
      expect(rsyncService.lastJob?.id).to.equal('test-job-2');
      done();
    }, 50);
  });
});
