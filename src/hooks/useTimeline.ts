import { useState, useMemo, useCallback } from 'react';
import { SyncJob, Snapshot } from '../types';

export type ZoomLevel = 'day' | 'week' | 'month' | 'year';

export interface TimelineSnapshot extends Snapshot {
  jobId: string;
  jobName: string;
}

export interface TimelineState {
  snapshots: TimelineSnapshot[];
  selectedTimestamp: number | null;
  selectedSnapshot: TimelineSnapshot | null;
  zoomLevel: ZoomLevel;
  timeRange: { start: number; end: number };
}

export interface TimelineActions {
  selectTimestamp: (timestamp: number | null) => void;
  selectSnapshot: (snapshot: TimelineSnapshot | null) => void;
  setZoomLevel: (level: ZoomLevel) => void;
  nextSnapshot: () => void;
  prevSnapshot: () => void;
  jumpToFirst: () => void;
  jumpToLast: () => void;
  jumpToDate: (date: Date) => void;
}

export function useTimeline(jobs: SyncJob[]): TimelineState & TimelineActions {
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');

  // Aggregate all snapshots from all jobs
  const snapshots = useMemo(() => {
    const allSnapshots: TimelineSnapshot[] = jobs.flatMap(job =>
      (job.snapshots || []).map(snapshot => ({
        ...snapshot,
        jobId: job.id,
        jobName: job.name,
      }))
    );

    // Sort by timestamp ascending (oldest first)
    return allSnapshots.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [jobs]);

  // Calculate time range
  const timeRange = useMemo(() => {
    if (snapshots.length === 0) {
      const now = Date.now();
      return { start: now - 30 * 24 * 60 * 60 * 1000, end: now };
    }

    const timestamps = snapshots.map(s => s.timestamp || 0).filter(t => t > 0);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    // Add some padding to the range
    const padding = (maxTime - minTime) * 0.05 || 24 * 60 * 60 * 1000; // 5% padding or 1 day
    return {
      start: minTime - padding,
      end: Math.max(maxTime + padding, Date.now()),
    };
  }, [snapshots]);

  // Get currently selected snapshot
  const selectedSnapshot = useMemo(() => {
    if (selectedTimestamp === null) return null;
    return snapshots.find(s => s.timestamp === selectedTimestamp) || null;
  }, [snapshots, selectedTimestamp]);

  // Get index of currently selected snapshot
  const selectedIndex = useMemo(() => {
    if (selectedTimestamp === null) return -1;
    return snapshots.findIndex(s => s.timestamp === selectedTimestamp);
  }, [snapshots, selectedTimestamp]);

  // Select by timestamp
  const selectTimestamp = useCallback((timestamp: number | null) => {
    setSelectedTimestamp(timestamp);
  }, []);

  // Select by snapshot object
  const selectSnapshot = useCallback((snapshot: TimelineSnapshot | null) => {
    setSelectedTimestamp(snapshot?.timestamp || null);
  }, []);

  // Navigate to next snapshot
  const nextSnapshot = useCallback(() => {
    if (snapshots.length === 0) return;

    if (selectedIndex === -1 || selectedIndex >= snapshots.length - 1) {
      // Select the last snapshot if none selected or at the end
      setSelectedTimestamp(snapshots[snapshots.length - 1].timestamp || null);
    } else {
      setSelectedTimestamp(snapshots[selectedIndex + 1].timestamp || null);
    }
  }, [snapshots, selectedIndex]);

  // Navigate to previous snapshot
  const prevSnapshot = useCallback(() => {
    if (snapshots.length === 0) return;

    if (selectedIndex === -1 || selectedIndex <= 0) {
      // Select the first snapshot if none selected or at the beginning
      setSelectedTimestamp(snapshots[0].timestamp || null);
    } else {
      setSelectedTimestamp(snapshots[selectedIndex - 1].timestamp || null);
    }
  }, [snapshots, selectedIndex]);

  // Jump to first snapshot
  const jumpToFirst = useCallback(() => {
    if (snapshots.length > 0) {
      setSelectedTimestamp(snapshots[0].timestamp || null);
    }
  }, [snapshots]);

  // Jump to last snapshot
  const jumpToLast = useCallback(() => {
    if (snapshots.length > 0) {
      setSelectedTimestamp(snapshots[snapshots.length - 1].timestamp || null);
    }
  }, [snapshots]);

  // Jump to closest snapshot to a given date
  const jumpToDate = useCallback(
    (date: Date) => {
      if (snapshots.length === 0) return;

      const targetTime = date.getTime();

      // Find the closest snapshot
      let closestSnapshot = snapshots[0];
      let closestDiff = Math.abs((closestSnapshot.timestamp || 0) - targetTime);

      for (const snapshot of snapshots) {
        const diff = Math.abs((snapshot.timestamp || 0) - targetTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestSnapshot = snapshot;
        }
      }

      setSelectedTimestamp(closestSnapshot.timestamp || null);
    },
    [snapshots]
  );

  return {
    // State
    snapshots,
    selectedTimestamp,
    selectedSnapshot,
    zoomLevel,
    timeRange,

    // Actions
    selectTimestamp,
    selectSnapshot,
    setZoomLevel,
    nextSnapshot,
    prevSnapshot,
    jumpToFirst,
    jumpToLast,
    jumpToDate,
  };
}
