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

  const fetchDiff = useCallback(async () => {
    if (!jobId || !snapshotA || !snapshotB) {
      setDiff(null);
      return;
    }

    if (snapshotA.timestamp === snapshotB.timestamp) {
      setDiff(null);
      setError('Cannot compare snapshot with itself');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.compareSnapshots(jobId, snapshotA.timestamp, snapshotB.timestamp);
      setDiff(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDiff(null);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, snapshotA?.timestamp, snapshotB?.timestamp]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  return { diff, isLoading, error, refetch: fetchDiff };
}
