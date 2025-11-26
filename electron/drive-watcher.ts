import fs from 'fs';
import path from 'path';
import log from 'electron-log';

type MountHandler = (volumePath: string) => void;

export function createDriveWatcher(onMount: MountHandler) {
  if (process.platform !== 'darwin') {
    // For now, only watch macOS /Volumes; extend as needed.
    return () => {};
  }

  const volumesDir = '/Volumes';
  let known = new Set<string>();

  try {
    known = new Set(fs.readdirSync(volumesDir));
  } catch (error: any) {
    log.warn(`Drive watcher: cannot read ${volumesDir}: ${error.message}`);
    return () => {};
  }

  const watcher = fs.watch(volumesDir, async (_event, filename) => {
    if (!filename) return;
    const fullPath = path.join(volumesDir, filename.toString());
    try {
      const stat = await fs.promises.stat(fullPath);
      if (stat.isDirectory() && !known.has(filename.toString())) {
        known.add(filename.toString());
        onMount(fullPath);
      }
    } catch {
      // Removal or transient; just update the known set
      known.delete(filename.toString());
    }
  });

  return () => watcher.close();
}
