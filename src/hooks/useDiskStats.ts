import { useState, useEffect, useMemo } from 'react';
import { DiskStats } from '../types';
import { api } from '../api';

const DISK_STATS_REFRESH_INTERVAL_MS = 10000;

export function useDiskStats(paths: string[]) {
  const [stats, setStats] = useState<Record<string, DiskStats>>({});

  // Create stable unique paths array
  const uniquePaths = useMemo(() => Array.from(new Set(paths.filter(Boolean))), [paths]);

  useEffect(() => {
    const fetchStats = async () => {
      const newStats: Record<string, DiskStats> = {};

      for (const path of uniquePaths) {
        try {
          const result = await api.getDiskStats(path);
          newStats[path] =
            result.success && result.stats
              ? result.stats
              : {
                  total: 0,
                  free: 0,
                  status: 'UNAVAILABLE',
                };
        } catch {
          newStats[path] = {
            total: 0,
            free: 0,
            status: 'UNAVAILABLE',
          };
        }
      }

      setStats(newStats);
    };

    fetchStats();
    const interval = setInterval(fetchStats, DISK_STATS_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [uniquePaths]);

  return stats;
}
