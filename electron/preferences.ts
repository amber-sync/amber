import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

export interface AppPreferences {
  runInBackground: boolean;
  startOnBoot: boolean;
  notifications: boolean;
}

const DEFAULT_PREFS: AppPreferences = {
  runInBackground: false,
  startOnBoot: false,
  notifications: true,
};

const prefsPath = path.join(app.getPath('userData'), 'preferences.json');

export async function loadPreferences(): Promise<AppPreferences> {
  try {
    const raw = await fs.readFile(prefsPath, 'utf-8');
    const data = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...data };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePreferences(prefs: AppPreferences): Promise<void> {
  try {
    await fs.mkdir(path.dirname(prefsPath), { recursive: true });
    await fs.writeFile(prefsPath, JSON.stringify(prefs, null, 2), 'utf-8');
  } catch (e) {
    // ignore persistence errors silently
  }
}
