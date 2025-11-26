import * as fs from 'fs';
import schedule from 'node-schedule';
import { SyncJob } from './types';
import { RsyncService } from './rsync-service';
import { VolumeWatcher } from './VolumeWatcher';

export class JobScheduler {
  private jobs: Map<string, schedule.Job> = new Map();
  private rsyncService: RsyncService;
  private volumeWatcher: VolumeWatcher;
  private registeredJobs: SyncJob[] = [];

  constructor(rsyncService: RsyncService, volumeWatcher: VolumeWatcher) {
    this.rsyncService = rsyncService;
    this.volumeWatcher = volumeWatcher;

    this.volumeWatcher.on('mount', (path: string) => {
      this.handleVolumeMount(path);
    });
  }

  public init(jobs: SyncJob[]) {
    this.registeredJobs = jobs;
    jobs.forEach(job => {
      if (job.schedule && job.schedule.enabled) {
        this.scheduleJob(job);
      }
    });
    console.log(`JobScheduler initialized with ${jobs.length} jobs.`);
  }

  public updateJobs(jobs: SyncJob[]) {
    // Cancel all existing schedules
    this.jobs.forEach(j => j.cancel());
    this.jobs.clear();
    
    // Re-init
    this.init(jobs);
  }

  public scheduleJob(job: SyncJob) {
    if (!job.schedule || !job.schedule.enabled || !job.schedule.cron) {
      return;
    }

    try {
      const scheduledJob = schedule.scheduleJob(job.schedule.cron, () => {
        console.log(`Executing scheduled job: ${job.name}`);
        // We need a way to log output, for now just console
        this.rsyncService.runBackup(job, (msg) => console.log(`[${job.name}] ${msg}`));
      });

      if (scheduledJob) {
        this.jobs.set(job.id, scheduledJob);
        console.log(`Scheduled job '${job.name}' with cron: ${job.schedule.cron}`);
      }
    } catch (error) {
      console.error(`Failed to schedule job ${job.name}:`, error);
    }
  }

  public cancelJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.cancel();
      this.jobs.delete(jobId);
      console.log(`Cancelled schedule for job ${jobId}`);
    }
  }

  private async handleVolumeMount(mountPath: string) {
    console.log(`Checking jobs for mount path: ${mountPath}`);
    
    for (const job of this.registeredJobs) {
      // Check if job destination starts with the mount path
      if (job.destPath.startsWith(mountPath)) {
        // Verify the destination actually exists or is accessible
        try {
          // We use fs.access to check visibility. 
          // Note: If the drive is mounted but the folder is missing, we might want to create it?
          // But usually we just want to know if the *drive* is the correct one.
          // Checking access to the destPath confirms the mount makes the dest available.
          await fs.promises.access(job.destPath);
          console.log(`Destination reachable for job '${job.name}'.`);

          if (this.isJobDue(job)) {
             console.log(`Job '${job.name}' is due. Starting backup...`);
             this.rsyncService.runBackup(job, (msg) => console.log(`[${job.name}] ${msg}`));
          }
        } catch (error) {
          console.log(`Job '${job.name}' matched mount path but destination not accessible: ${job.destPath}`);
        }
      }
    }
  }

  private isJobDue(job: SyncJob): boolean {
    // Simple logic: If it's a scheduled job, and we missed the last run?
    // Or maybe we just want to run it if the drive was missing during the scheduled time.
    // For this MVP, let's assume if it has a schedule, and the drive appears, we run it.
    // A better check would be: lastRun < expectedNextRun - interval
    
    if (!job.schedule || !job.schedule.enabled) return false;
    
    // If we had 'lastRun' timestamp in SyncJob, we could compare.
    // Assuming SyncJob has lastRun (we'll check types.ts).
    // If not, we might need to rely on file markers or just run it.
    
    // Placeholder logic until we confirm SyncJob has lastRun
    return true; 
  }
}
