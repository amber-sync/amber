import path from 'path';
import { SyncJob } from './types';

type SchedulerOptions = {
  runJob: (job: SyncJob) => Promise<void>;
  isRunning: (jobId: string) => boolean;
  onBeforeRun?: (job: SyncJob) => Promise<void> | void;
};

export class JobScheduler {
  private jobs: SyncJob[] = [];
  private timer: NodeJS.Timeout | null = null;
  private lastTriggered = new Map<string, number>();
  private readonly tickMs: number;

  constructor(private options: SchedulerOptions, tickSeconds = 30) {
    this.tickMs = tickSeconds * 1000;
  }

  setJobs(jobs: SyncJob[]) {
    this.jobs = jobs;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.checkDue(), this.tickMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  handleVolumeMounted(volumePath: string) {
    const normalized = path.normalize(volumePath);
    const candidates = this.jobs.filter((job) => {
      if (!job.destPath) return false;
      if (!job.destPath.startsWith(normalized)) return false;
      if (!job.scheduleInterval) return false;
      return true;
    });
    candidates.forEach((job) => this.maybeRun(job));
  }

  private checkDue() {
    const now = Date.now();
    this.jobs.forEach((job) => {
      if (!job.scheduleInterval) return;
      this.maybeRun(job, now);
    });
  }

  private async maybeRun(job: SyncJob, now: number = Date.now()) {
    if (this.options.isRunning(job.id)) return;
    const intervalMs = job.scheduleInterval! * 60 * 1000;
    const last = job.lastRun ?? this.lastTriggered.get(job.id) ?? 0;
    if (now - last < intervalMs) return;

    this.lastTriggered.set(job.id, now);
    if (this.options.onBeforeRun) {
      await this.options.onBeforeRun(job);
    }
    await this.options.runJob(job);
  }
}
