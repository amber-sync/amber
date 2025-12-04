import { describe, it, expect } from 'vitest';
import { formatBytes, formatSchedule, formatSnapshotDate, truncateMiddle } from '../formatters';

describe('formatBytes', () => {
  it('returns "0 B" for zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes correctly', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes correctly', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });

  it('formats gigabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
  });

  it('formats terabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
  });

  it('handles decimal precision', () => {
    expect(formatBytes(1234567890)).toBe('1.15 GB');
  });
});

describe('formatSchedule', () => {
  it('returns "Manual Only" for null', () => {
    expect(formatSchedule(null)).toBe('Manual Only');
  });

  it('returns "Heartbeat" for 5 minutes', () => {
    expect(formatSchedule(5)).toBe('Heartbeat');
  });

  it('returns "Hourly" for 60 minutes', () => {
    expect(formatSchedule(60)).toBe('Hourly');
  });

  it('returns "Daily" for 1440 minutes', () => {
    expect(formatSchedule(1440)).toBe('Daily');
  });

  it('returns "Weekly" for 10080 minutes', () => {
    expect(formatSchedule(10080)).toBe('Weekly');
  });

  it('returns custom format for other values', () => {
    expect(formatSchedule(30)).toBe('Every 30 mins');
    expect(formatSchedule(120)).toBe('Every 120 mins');
  });
});

describe('formatSnapshotDate', () => {
  it('formats date with zero-padded values', () => {
    const date = new Date(2024, 0, 5, 3, 5, 9); // Jan 5, 2024, 03:05:09
    const result = formatSnapshotDate(date);

    expect(result).toBe('2024-01-05-030509');
  });

  it('formats date with double-digit values', () => {
    const date = new Date(2024, 11, 25, 14, 30, 22); // Dec 25, 2024, 14:30:22
    const result = formatSnapshotDate(date);

    expect(result).toBe('2024-12-25-143022');
  });

  it('handles midnight correctly', () => {
    const date = new Date(2024, 0, 1, 0, 0, 0);
    const result = formatSnapshotDate(date);

    expect(result).toBe('2024-01-01-000000');
  });
});

describe('truncateMiddle', () => {
  it('returns empty string for empty input', () => {
    expect(truncateMiddle('', 10)).toBe('');
  });

  it('returns original string if shorter than maxLength', () => {
    expect(truncateMiddle('hello', 10)).toBe('hello');
  });

  it('returns original string if equal to maxLength', () => {
    expect(truncateMiddle('hello', 5)).toBe('hello');
  });

  it('truncates long strings in the middle', () => {
    const result = truncateMiddle('hello world foo bar', 15);
    expect(result.length).toBeLessThanOrEqual(15);
    expect(result).toContain('...');
    expect(result.startsWith('hello')).toBe(true);
    expect(result.endsWith('bar')).toBe(true);
  });

  it('handles paths correctly', () => {
    const path = '/Users/test/Documents/very/long/path/to/file.txt';
    const result = truncateMiddle(path, 30);

    expect(result.length).toBeLessThanOrEqual(30);
    expect(result).toContain('...');
    expect(result.startsWith('/')).toBe(true);
    expect(result.endsWith('.txt')).toBe(true);
  });
});
