import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import log from 'electron-log';
import { SyncJob } from './types';

const JOBS_FILENAME = 'jobs.json';

function getStorePath() {
  const userData = app.getPath('userData');
  return path.join(userData, JOBS_FILENAME);
}

async function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

export async function loadJobs(): Promise<SyncJob[]> {
  const filePath = getStorePath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as SyncJob[];
    }
    log.warn('jobs.json was not an array; resetting to empty.');
    return [];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    log.error(`Failed to load jobs: ${error.message}`);
    return [];
  }
}

export async function saveJobs(jobs: SyncJob[]): Promise<void> {
  const filePath = getStorePath();
  await ensureDir(filePath);
  await fs.writeFile(filePath, JSON.stringify(jobs, null, 2), 'utf-8');
}

export const jobStorePath = () => getStorePath();
