import { useState, useEffect } from 'react';
import { JobAggregateStats, SnapshotDensity } from '../types';
import { api } from '../api';

interface UseJobStatsResult {
  stats: JobAggregateStats | null;
  density: SnapshotDensity[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch job aggregate stats and snapshot density from the Rust backend.
 * (TIM-132)
 *
 * @param destPath - The destination path of the backup job
 * @param jobId - The job ID
 * @param period - The period for density data ('day' | 'month' | 'year')
 */
export function useJobStats(
  destPath: string | undefined,
  jobId: string | undefined,
  period: 'day' | 'month' | 'year' = 'month'
): UseJobStatsResult {
  const [stats, setStats] = useState<JobAggregateStats | null>(null);
  const [density, setDensity] = useState<SnapshotDensity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!destPath || !jobId) {
      setStats(null);
      setDensity([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch both stats and density in parallel
      const [statsResult, densityResult] = await Promise.all([
        api.getJobAggregateStatsOnDestination(destPath, jobId),
        api.getSnapshotDensityOnDestination(destPath, jobId, period),
      ]);

      setStats(statsResult);
      setDensity(densityResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stats';
      setError(message);
      console.error('Failed to fetch job stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [destPath, jobId, period]);

  return {
    stats,
    density,
    loading,
    error,
    refetch: fetchStats,
  };
}

export default useJobStats;
