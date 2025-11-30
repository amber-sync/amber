import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsQuickView } from '../StatsQuickView';
import { SyncJob, SyncMode, DestinationType, JobStatus } from '../../../types';

const createMockJob = (overrides: Partial<SyncJob> = {}): SyncJob => ({
  id: 'test-job-1',
  name: 'Test Backup',
  sourcePath: '/Users/test/Documents',
  destPath: '/Volumes/Backup',
  mode: SyncMode.TIME_MACHINE,
  destinationType: DestinationType.LOCAL,
  scheduleInterval: 1440, // Daily (in minutes)
  lastRun: Date.now() - 3600000, // 1 hour ago
  status: JobStatus.SUCCESS,
  config: {
    verbose: true,
    archive: true,
    compress: false,
    delete: false,
    recursive: true,
    excludePatterns: [],
    customFlags: '',
  },
  snapshots: [
    {
      id: 'snap-1',
      timestamp: Date.now() - 3600000,
      sizeBytes: 1024 * 1024 * 100, // 100 MB
      fileCount: 1000,
      changesCount: 50,
      status: 'Complete',
      restored: false,
      root: [],
    },
  ],
  ...overrides,
});

describe('StatsQuickView', () => {
  it('renders quick stats title', () => {
    const job = createMockJob();
    render(<StatsQuickView job={job} />);

    expect(screen.getByText('Quick Stats')).toBeInTheDocument();
  });

  it('displays last sync time', () => {
    const job = createMockJob({ lastRun: Date.now() - 3600000 });
    render(<StatsQuickView job={job} />);

    expect(screen.getByText('Last Sync')).toBeInTheDocument();
    // Should show time (format varies by locale)
    expect(screen.queryByText('Never')).not.toBeInTheDocument();
  });

  it('displays "Never" when no last run', () => {
    const job = createMockJob({ lastRun: undefined });
    render(<StatsQuickView job={job} />);

    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('displays schedule interval', () => {
    const job = createMockJob({ scheduleInterval: 1440 }); // Daily
    render(<StatsQuickView job={job} />);

    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });

  it('displays sync mode', () => {
    const job = createMockJob({ mode: SyncMode.TIME_MACHINE });
    render(<StatsQuickView job={job} />);

    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('Time Machine')).toBeInTheDocument();
  });

  it('displays total snapshots count', () => {
    const job = createMockJob({
      snapshots: [
        {
          id: '1',
          timestamp: Date.now(),
          sizeBytes: 100,
          fileCount: 10,
          changesCount: 5,
          status: 'Complete',
          restored: false,
          root: [],
        },
        {
          id: '2',
          timestamp: Date.now() - 86400000,
          sizeBytes: 100,
          fileCount: 10,
          changesCount: 5,
          status: 'Complete',
          restored: false,
          root: [],
        },
        {
          id: '3',
          timestamp: Date.now() - 172800000,
          sizeBytes: 100,
          fileCount: 10,
          changesCount: 5,
          status: 'Complete',
          restored: false,
          root: [],
        },
      ],
    });
    render(<StatsQuickView job={job} />);

    expect(screen.getByText('Total Snapshots')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('displays 0 snapshots when empty', () => {
    const job = createMockJob({ snapshots: [] });
    render(<StatsQuickView job={job} />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
