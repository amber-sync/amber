import { useMemo } from 'react';
import type { Snapshot } from '../types';

/**
 * Hook to filter snapshots by year and month.
 *
 * @param snapshots - The full list of snapshots
 * @param year - The year to filter by
 * @param month - The month to filter by (0-11), or null for all months in the year
 * @returns Filtered snapshots, sorted by timestamp descending (newest first)
 */
export function useFilteredSnapshots(
  snapshots: Snapshot[],
  year: number,
  month: number | null
): Snapshot[] {
  return useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];

    const filtered = snapshots.filter(snapshot => {
      const date = new Date(snapshot.timestamp);
      const snapshotYear = date.getFullYear();
      const snapshotMonth = date.getMonth();

      // Filter by year
      if (snapshotYear !== year) return false;

      // If month is specified (not null), filter by month too
      if (month !== null && snapshotMonth !== month) return false;

      return true;
    });

    // Sort by timestamp descending (newest first)
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [snapshots, year, month]);
}

/**
 * Get available years from a list of snapshots.
 * Returns years in descending order (newest first).
 */
export function getAvailableYears(snapshots: Snapshot[]): number[] {
  if (!snapshots || snapshots.length === 0) {
    return [new Date().getFullYear()];
  }

  const years = new Set<number>();
  snapshots.forEach(s => years.add(new Date(s.timestamp).getFullYear()));

  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Get the count of snapshots per month for a given year.
 * Returns an array of 12 numbers (Jan=0 to Dec=11).
 */
export function getMonthCounts(snapshots: Snapshot[], year: number): number[] {
  const counts = new Array(12).fill(0);

  snapshots.forEach(s => {
    const date = new Date(s.timestamp);
    if (date.getFullYear() === year) {
      counts[date.getMonth()]++;
    }
  });

  return counts;
}
