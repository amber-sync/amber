import { useState, useEffect } from 'react';
import { DiskStats } from '../types';

const DISK_STATS_REFRESH_INTERVAL_MS = 10000;

export function useDiskStats(paths: string[]) {
  const [stats, setStats] = useState<Record<string, DiskStats>>({});

  useEffect(() => {
    if (!window.electronAPI) return;

    const fetchStats = async () => {
      const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
      const newStats: Record<string, DiskStats> = {};

      for (const path of uniquePaths) {
        try {
          const result = await window.electronAPI.getDiskStats(path);
          newStats[path] = result.success ? result.stats : {
            total: 0,
            free: 0,
            status: 'UNAVAILABLE'
          };
        } catch (error) {
          newStats[path] = {
            total: 0,
            free: 0,
            status: 'UNAVAILABLE'
          };
        }
      }

      setStats(newStats);
    };

    fetchStats();
    const interval = setInterval(fetchStats, DISK_STATS_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [paths.join(',')]); // Stable dependency

  return stats;
}
