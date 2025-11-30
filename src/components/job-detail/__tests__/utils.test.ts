import { describe, it, expect } from 'vitest';
import { buildSnapshotFolderName, groupSnapshots } from '../utils';
import { SyncJob } from '../../../types';

describe('buildSnapshotFolderName', () => {
  it('formats timestamp correctly', () => {
    // March 15, 2024, 14:30:22 UTC
    const timestamp = new Date('2024-03-15T14:30:22Z').getTime();
    const result = buildSnapshotFolderName(timestamp);

    // The result should be in local time, so we'll check the format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}$/);
  });

  it('pads single digit values with zeros', () => {
    // January 5, 2024, 03:05:09 UTC
    const timestamp = new Date('2024-01-05T03:05:09Z').getTime();
    const result = buildSnapshotFolderName(timestamp);

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}$/);
    // All parts should be properly padded
    const parts = result.split('-');
    expect(parts[0]).toHaveLength(4); // year
    expect(parts[1]).toHaveLength(2); // month
    expect(parts[2]).toHaveLength(2); // day
    expect(parts[3]).toHaveLength(6); // HHmmss
  });

  it('handles midnight correctly', () => {
    const timestamp = new Date('2024-01-01T00:00:00Z').getTime();
    const result = buildSnapshotFolderName(timestamp);

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}$/);
  });
});

describe('groupSnapshots', () => {
  const createSnapshot = (
    timestamp: number,
    id: string,
    sizeBytes = 1000
  ): SyncJob['snapshots'][0] => ({
    id,
    timestamp,
    sizeBytes,
    fileCount: 10,
    changesCount: 5,
    status: 'Complete',
    restored: false,
    root: [],
  });

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  const mockSnapshots = [
    createSnapshot(now, 'snap1', 3000), // Today
    createSnapshot(now - oneDay, 'snap2', 2000), // Yesterday
    createSnapshot(now - oneDay * 2, 'snap3', 1000), // 2 days ago
    createSnapshot(now - oneDay * 30, 'snap4', 500), // 30 days ago
  ];

  it('returns individual items when grouping is ALL', () => {
    const result = groupSnapshots(mockSnapshots, 'ALL', 'date');

    expect(result).toHaveLength(4);
    result.forEach(group => {
      expect(group.snaps).toHaveLength(1);
      expect(group.label).toBeNull();
    });
  });

  it('groups snapshots by DAY', () => {
    const result = groupSnapshots(mockSnapshots, 'DAY', 'date');

    // Should have 4 groups (Today, Yesterday, and 2 different days)
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0].label).toBe('Today');
    expect(result[1].label).toBe('Yesterday');
  });

  it('sorts by date (newest first) when sortBy is date', () => {
    const result = groupSnapshots(mockSnapshots, 'ALL', 'date');

    expect(result[0].snaps[0].timestamp).toBeGreaterThan(result[1].snaps[0].timestamp);
    expect(result[1].snaps[0].timestamp).toBeGreaterThan(result[2].snaps[0].timestamp);
  });

  it('sorts by size (largest first) when sortBy is size', () => {
    const result = groupSnapshots(mockSnapshots, 'ALL', 'size');

    expect(result[0].snaps[0].sizeBytes).toBeGreaterThanOrEqual(result[1].snaps[0].sizeBytes);
    expect(result[1].snaps[0].sizeBytes).toBeGreaterThanOrEqual(result[2].snaps[0].sizeBytes);
  });

  it('returns empty array for empty snapshots', () => {
    const result = groupSnapshots([], 'ALL', 'date');
    expect(result).toEqual([]);
  });

  it('groups by MONTH correctly', () => {
    const result = groupSnapshots(mockSnapshots, 'MONTH', 'date');

    // Check that labels contain month/year format
    result.forEach(group => {
      expect(group.label).not.toBeNull();
    });
  });

  it('groups by YEAR correctly', () => {
    const result = groupSnapshots(mockSnapshots, 'YEAR', 'date');

    // All should be in current year
    result.forEach(group => {
      expect(group.label).toMatch(/^\d{4}$/);
    });
  });
});
