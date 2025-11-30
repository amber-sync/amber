import { SyncJob } from '../../types';
import { JobAnalyticsData } from './JobAnalytics';

/**
 * Build snapshot folder name from timestamp
 * Format: YYYY-MM-DD-HHmmss
 */
export const buildSnapshotFolderName = (timestamp: number): string => {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}${min}${s}`;
};

/**
 * Calculate job statistics from file tree
 */
export const calculateJobStats = (
  fileNodes: SyncJob['snapshots'][number]['root']
): JobAnalyticsData => {
  const typesMap = new Map<string, number>();
  const allFiles: { name: string; size: number; path: string }[] = [];

  const traverse = (nodes: SyncJob['snapshots'][number]['root'], currentPath: string) => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === 'FILE') {
        const ext = node.name.includes('.')
          ? node.name.split('.').pop()?.toLowerCase() || 'unknown'
          : 'no-ext';
        typesMap.set(ext, (typesMap.get(ext) || 0) + 1);
        allFiles.push({ name: node.name, size: node.size, path: `${currentPath}/${node.name}` });
      } else if (node.children) {
        traverse(node.children, `${currentPath}/${node.name}`);
      }
    }
  };

  traverse(fileNodes, '');

  const fileTypes = Array.from(typesMap.entries())
    .map(([name, value]) => ({ name: `.${name}`, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const largestFiles = allFiles.sort((a, b) => b.size - a.size).slice(0, 5);

  return { fileTypes, largestFiles };
};

/**
 * Group snapshots by time period
 */
export const groupSnapshots = (
  snapshots: SyncJob['snapshots'],
  grouping: 'ALL' | 'DAY' | 'MONTH' | 'YEAR',
  sortBy: 'date' | 'size'
) => {
  // Sort first
  const sortedSnapshots = [...snapshots].sort((a, b) => {
    if (sortBy === 'date') {
      return b.timestamp - a.timestamp; // Newest first
    } else {
      return b.sizeBytes - a.sizeBytes; // Largest first
    }
  });

  if (grouping === 'ALL') {
    return sortedSnapshots.map(snap => ({ group: snap.id, label: null, snaps: [snap] }));
  }

  const groups: Record<string, typeof sortedSnapshots> = {};
  sortedSnapshots.forEach(snap => {
    const date = new Date(snap.timestamp);
    let key = '';
    if (grouping === 'DAY') {
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const snapDate = date.toDateString();
      if (snapDate === today) key = 'Today';
      else if (snapDate === yesterday) key = 'Yesterday';
      else
        key = date.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
    } else if (grouping === 'MONTH') {
      key = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } else if (grouping === 'YEAR') {
      key = date.getFullYear().toString();
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(snap);
  });

  return Object.entries(groups).map(([label, snaps]) => ({
    group: label,
    label,
    snaps,
  }));
};
