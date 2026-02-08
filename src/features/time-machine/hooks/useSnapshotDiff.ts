/**
 * TIM-221: Hook for comparing two snapshots
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/api';
import type { Snapshot, SnapshotDiff } from '@/types';

interface UseSnapshotDiffResult {
  diff: SnapshotDiff | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSnapshotDiff(
  jobId: string | null,
  snapshotA: Snapshot | null,
  snapshotB: Snapshot | null
): UseSnapshotDiffResult {
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snapshotATimestamp = snapshotA?.timestamp ?? null;
  const snapshotBTimestamp = snapshotB?.timestamp ?? null;

  const fetchDiff = useCallback(async () => {
    if (!jobId || !snapshotATimestamp || !snapshotBTimestamp) {
      setDiff(null);
      return;
    }

    if (snapshotATimestamp === snapshotBTimestamp) {
      setDiff(null);
      setError('Cannot compare snapshot with itself');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.compareSnapshots(jobId, snapshotATimestamp, snapshotBTimestamp);
      setDiff(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDiff(null);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, snapshotATimestamp, snapshotBTimestamp]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  return { diff, isLoading, error, refetch: fetchDiff };
}
