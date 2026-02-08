/**
 * RestoreOverlay Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { RestoreOverlay } from '../RestoreOverlay';
import { api } from '../../../../api';
import { DestinationType, JobStatus, SyncMode, type SyncJob } from '../../../../types';
import type { TimeMachineSnapshot } from '../../TimeMachinePage';

vi.mock('../../../../api', () => ({
  api: {
    selectDirectory: vi.fn(),
    restoreSnapshot: vi.fn(),
    openPath: vi.fn(),
  },
}));

vi.mock('../../../../components/IconComponents', () => ({
  Icons: {
    X: ({ size }: { size?: number }) => <div data-testid="icon-x">{size}</div>,
    Check: ({ size }: { size?: number }) => <div data-testid="icon-check">{size}</div>,
    FolderOpen: ({ size }: { size?: number }) => <div data-testid="icon-folder">{size}</div>,
    RefreshCw: ({ size, className }: { size?: number; className?: string }) => (
      <div data-testid="icon-refresh" className={className}>
        {size}
      </div>
    ),
    RotateCcw: ({ size }: { size?: number }) => <div data-testid="icon-rotate">{size}</div>,
    Info: ({ size }: { size?: number }) => <div data-testid="icon-info">{size}</div>,
    ChevronLeft: ({ size }: { size?: number }) => <div data-testid="icon-chevron-left">{size}</div>,
    ChevronRight: ({ size }: { size?: number }) => (
      <div data-testid="icon-chevron-right">{size}</div>
    ),
    AlertTriangle: ({ size }: { size?: number }) => (
      <div data-testid="icon-alert-triangle">{size}</div>
    ),
  },
}));

vi.mock('../../../../utils', () => ({
  formatBytes: (bytes: number) => `${bytes} B`,
}));

describe('RestoreOverlay', () => {
  const mockJob: SyncJob = {
    id: 'job-1',
    name: 'Test Job',
    sourcePath: '/source',
    destPath: '/destination',
    mode: SyncMode.TIME_MACHINE,
    destinationType: DestinationType.LOCAL,
    config: {
      recursive: true,
      compress: false,
      archive: true,
      delete: false,
      verbose: false,
      excludePatterns: [],
      customFlags: '',
    },
    scheduleInterval: null,
    lastRun: null,
    status: JobStatus.IDLE,
    snapshots: [],
  };

  const mockSnapshots: TimeMachineSnapshot[] = [
    {
      id: 'snap-1',
      jobId: 'job-1',
      jobName: 'Test Job',
      timestamp: new Date('2024-01-15T10:30:00').getTime(),
      sizeBytes: 1024000,
      fileCount: 100,
      changesCount: 10,
      status: 'Complete',
      path: '/destination/2024-01-15-103000',
    },
    {
      id: 'snap-2',
      jobId: 'job-1',
      jobName: 'Test Job',
      timestamp: new Date('2024-01-16T14:45:00').getTime(),
      sizeBytes: 2048000,
      fileCount: 150,
      changesCount: 20,
      status: 'Complete',
      path: '/destination/2024-01-16-144500',
    },
  ];

  const mockOnClose = vi.fn();
  type RestoreResponse = { success: boolean; error?: string };

  function renderOverlay(
    props: Partial<ComponentProps<typeof RestoreOverlay>> = {}
  ): ReturnType<typeof render> {
    return render(
      <RestoreOverlay
        isOpen
        job={mockJob}
        snapshot={mockSnapshots[0]}
        snapshots={mockSnapshots}
        onClose={mockOnClose}
        {...props}
      />
    );
  }

  async function proceedToConfirm(): Promise<void> {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText('Restore Summary')).toBeInTheDocument();
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders visible and hidden states', () => {
    const { rerender } = renderOverlay({ isOpen: true });

    expect(screen.getByText('Restore Files').closest('.tm-overlay')).toHaveClass(
      'tm-overlay--visible'
    );

    rerender(
      <RestoreOverlay
        isOpen={false}
        job={mockJob}
        snapshot={mockSnapshots[0]}
        snapshots={mockSnapshots}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Restore Files').closest('.tm-overlay')).not.toHaveClass(
      'tm-overlay--visible'
    );
  });

  it('shows snapshot options including placeholder', () => {
    renderOverlay({ snapshot: null });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map(option => option.textContent);

    expect(optionLabels[0]).toContain('Select a snapshot');
    expect(optionLabels.some(text => text?.includes('100 files'))).toBe(true);
    expect(optionLabels.some(text => text?.includes('150 files'))).toBe(true);
  });

  it('uses default target path and allows editing', async () => {
    const user = userEvent.setup();
    renderOverlay();

    const input = screen.getByPlaceholderText('/Users/you/Desktop') as HTMLInputElement;
    expect(input.value).toBe('/destination/restored');

    await user.clear(input);
    await user.type(input, '/custom/path');

    expect(input.value).toBe('/custom/path');
  });

  it('updates target path after browse selection', async () => {
    const user = userEvent.setup();
    vi.mocked(api.selectDirectory).mockResolvedValue('/selected/path');

    renderOverlay();

    await user.click(screen.getByRole('button', { name: /browse folder/i }));

    await waitFor(() => {
      const input = screen.getByPlaceholderText('/Users/you/Desktop') as HTMLInputElement;
      expect(input.value).toBe('/selected/path');
    });
  });

  it('disables Continue when required fields are missing', async () => {
    const user = userEvent.setup();
    renderOverlay({ snapshot: null });

    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeDisabled();

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'snap-1');

    const input = screen.getByPlaceholderText('/Users/you/Desktop') as HTMLInputElement;
    await user.clear(input);

    expect(continueButton).toBeDisabled();
  });

  it('calls restoreSnapshot with expected arguments', async () => {
    const user = userEvent.setup();
    vi.mocked(api.restoreSnapshot).mockResolvedValue({ success: true } as RestoreResponse);

    renderOverlay();
    await proceedToConfirm();

    await user.click(screen.getByRole('button', { name: /restore files/i }));

    expect(api.restoreSnapshot).toHaveBeenCalledWith(
      mockJob,
      mockSnapshots[0].path,
      '/destination/restored',
      false
    );
  });

  it('shows progress text while restore is running', async () => {
    const user = userEvent.setup();
    const deferred: { resolve: (value: RestoreResponse) => void } = {
      resolve: () => {},
    };
    const restorePromise = new Promise<RestoreResponse>(resolve => {
      deferred.resolve = resolve;
    });
    vi.mocked(api.restoreSnapshot).mockReturnValue(restorePromise);

    renderOverlay();
    await proceedToConfirm();

    await user.click(screen.getByRole('button', { name: /restore files/i }));
    expect(await screen.findByText('Restoring files...')).toBeInTheDocument();

    deferred.resolve({ success: true });

    await waitFor(() => {
      expect(screen.queryByText('Restoring files...')).not.toBeInTheDocument();
    });
  });

  it('surfaces restore errors', async () => {
    const user = userEvent.setup();
    vi.mocked(api.restoreSnapshot).mockResolvedValue({
      success: false,
      error: 'Failed to restore files',
    } as RestoreResponse);

    renderOverlay();
    await proceedToConfirm();

    await user.click(screen.getByRole('button', { name: /restore files/i }));

    expect(await screen.findByText('Failed to restore files')).toBeInTheDocument();
  });

  it('shows success state and opens destination in finder', async () => {
    const user = userEvent.setup();
    vi.mocked(api.restoreSnapshot).mockResolvedValue({ success: true } as RestoreResponse);

    renderOverlay();
    await proceedToConfirm();

    await user.click(screen.getByRole('button', { name: /restore files/i }));

    expect(await screen.findByText('Restore Complete')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open in finder/i }));
    expect(api.openPath).toHaveBeenCalledWith('/destination/restored');
  });

  it('handles missing snapshot path on restore', async () => {
    const user = userEvent.setup();
    const snapshotWithoutPath: TimeMachineSnapshot = { ...mockSnapshots[0], path: undefined };

    renderOverlay({ snapshot: snapshotWithoutPath, snapshots: [snapshotWithoutPath] });
    await proceedToConfirm();

    await user.click(screen.getByRole('button', { name: /restore files/i }));

    expect(await screen.findByText('No snapshot selected')).toBeInTheDocument();
  });

  it('invokes onClose from close affordances', async () => {
    const user = userEvent.setup();
    renderOverlay();

    await user.click(screen.getByTestId('icon-x').closest('button') as HTMLButtonElement);
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });
});
