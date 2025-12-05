/**
 * RestoreOverlay Component Tests
 *
 * Tests the restore workflow overlay component including:
 * - Visibility control
 * - Snapshot selection
 * - Target path editing
 * - Browse functionality
 * - Restore operation
 * - Success state
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RestoreOverlay } from '../RestoreOverlay';
import { api } from '../../../../api';
import type { SyncJob } from '../../../../types';
import type { TimeMachineSnapshot } from '../../TimeMachinePage';

// Mock the api module
vi.mock('../../../../api', () => ({
  api: {
    selectDirectory: vi.fn(),
    restoreFiles: vi.fn(),
    openPath: vi.fn(),
  },
}));

// Mock the IconComponents module
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
  },
}));

// Mock the formatBytes utility
vi.mock('../../../../utils', () => ({
  formatBytes: (bytes: number) => `${bytes} B`,
}));

describe('RestoreOverlay', () => {
  const mockJob: SyncJob = {
    id: 'job-1',
    name: 'Test Job',
    sourcePath: '/source',
    destPath: '/destination',
    mode: 'TIME_MACHINE' as any,
    destinationType: 'LOCAL' as any,
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
    status: 'IDLE' as any,
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Renders when isOpen=true, hidden when false
  describe('Visibility', () => {
    it('should render overlay when isOpen is true', () => {
      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const overlay = screen.getByText('Restore Files').closest('.tm-overlay');
      expect(overlay).toHaveClass('tm-overlay--visible');
    });

    it('should hide overlay when isOpen is false', () => {
      render(
        <RestoreOverlay
          isOpen={false}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const overlay = screen.getByText('Restore Files').closest('.tm-overlay');
      expect(overlay).not.toHaveClass('tm-overlay--visible');
    });
  });

  // Test 2-3: Snapshot selector
  describe('Snapshot Selection', () => {
    it('should show snapshot selector with correct options', () => {
      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={null}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const select = screen.getByRole('combobox');
      const options = within(select).getAllByRole('option');

      // Should have placeholder + 2 snapshots
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent('Select a snapshot...');
      expect(options[1]).toHaveTextContent('1/15/2024');
      expect(options[1]).toHaveTextContent('100 files');
      expect(options[2]).toHaveTextContent('1/16/2024');
      expect(options[2]).toHaveTextContent('150 files');
    });

    it('should update selection state when snapshot is selected', async () => {
      const user = userEvent.setup();

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={null}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'snap-1');

      // Snapshot info should appear
      expect(await screen.findByText('Date:')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('1024000 B')).toBeInTheDocument();
    });
  });

  // Test 4: Target path input
  describe('Target Path Input', () => {
    it('should have editable target path input', async () => {
      const user = userEvent.setup();

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByPlaceholderText('/Users/you/Desktop') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('/destination/restored');

      await user.clear(input);
      await user.type(input, '/custom/path');

      expect(input.value).toBe('/custom/path');
    });
  });

  // Test 5: Browse button
  describe('Browse Functionality', () => {
    it('should call api.selectDirectory when browse button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(api.selectDirectory).mockResolvedValue('/selected/path');

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      // Find browse button (has FolderOpen icon)
      const browseButton = screen.getAllByTestId('icon-folder')[0].closest('button')!;
      await user.click(browseButton);

      expect(api.selectDirectory).toHaveBeenCalledTimes(1);

      // Wait for the path to update
      await waitFor(() => {
        const input = screen.getByPlaceholderText('/Users/you/Desktop') as HTMLInputElement;
        expect(input.value).toBe('/selected/path');
      });
    });

    it('should not update path if selectDirectory returns null', async () => {
      const user = userEvent.setup();
      vi.mocked(api.selectDirectory).mockResolvedValue(null);

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const originalPath = (screen.getByPlaceholderText('/Users/you/Desktop') as HTMLInputElement)
        .value;

      const browseButton = screen.getAllByTestId('icon-folder')[0].closest('button')!;
      await user.click(browseButton);

      await waitFor(() => {
        expect(api.selectDirectory).toHaveBeenCalled();
      });

      const input = screen.getByPlaceholderText('/Users/you/Desktop') as HTMLInputElement;
      expect(input.value).toBe(originalPath);
    });
  });

  // Test 6-7: Restore button disabled states
  describe('Restore Button Disabled States', () => {
    it('should disable restore button when no snapshot is selected', () => {
      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={null}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const restoreButton = screen.getByText('Restore Snapshot').closest('button')!;
      expect(restoreButton).toBeDisabled();
      expect(restoreButton).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('should disable restore button when no target path', async () => {
      const user = userEvent.setup();

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByPlaceholderText('/Users/you/Desktop') as HTMLInputElement;
      await user.clear(input);

      const restoreButton = screen.getByText('Restore Snapshot').closest('button')!;
      expect(restoreButton).toBeDisabled();
      expect(restoreButton).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('should enable restore button when both snapshot and path are set', () => {
      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const restoreButton = screen.getByText('Restore Snapshot').closest('button')!;
      expect(restoreButton).not.toBeDisabled();
      expect(restoreButton).not.toHaveClass('opacity-50');
    });
  });

  // Test 8: Clicking Restore calls api.restoreFiles
  describe('Restore Operation', () => {
    it('should call api.restoreFiles with correct arguments when restore is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(api.restoreFiles).mockResolvedValue({ success: true });

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const restoreButton = screen.getByText('Restore Snapshot').closest('button')!;
      await user.click(restoreButton);

      expect(api.restoreFiles).toHaveBeenCalledWith(
        mockJob,
        mockSnapshots[0].path,
        [],
        '/destination/restored'
      );
    });

    it('should show progress message during restore', async () => {
      const user = userEvent.setup();
      // Create a promise that we control
      let resolveRestore: (value: { success: boolean }) => void;
      const restorePromise = new Promise<{ success: boolean }>(resolve => {
        resolveRestore = resolve;
      });
      vi.mocked(api.restoreFiles).mockReturnValue(restorePromise);

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const restoreButton = screen.getByText('Restore Snapshot').closest('button')!;
      await user.click(restoreButton);

      // Should show progress
      expect(await screen.findByText('Preparing restore...')).toBeInTheDocument();

      // Resolve the restore
      resolveRestore!({ success: true });

      // Progress should disappear
      await waitFor(() => {
        expect(screen.queryByText('Preparing restore...')).not.toBeInTheDocument();
      });
    });

    it('should handle restore errors', async () => {
      const user = userEvent.setup();
      vi.mocked(api.restoreFiles).mockResolvedValue({
        success: false,
        error: 'Failed to restore files',
      });

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const restoreButton = screen.getByText('Restore Snapshot').closest('button')!;
      await user.click(restoreButton);

      expect(await screen.findByText('Failed to restore files')).toBeInTheDocument();
    });

    it('should handle exceptions during restore', async () => {
      const user = userEvent.setup();
      vi.mocked(api.restoreFiles).mockRejectedValue(new Error('Network error'));

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const restoreButton = screen.getByText('Restore Snapshot').closest('button')!;
      await user.click(restoreButton);

      expect(await screen.findByText('Network error')).toBeInTheDocument();
    });
  });

  // Test 9: Success state
  describe('Success State', () => {
    it('should show success state after restore completes', async () => {
      const user = userEvent.setup();
      vi.mocked(api.restoreFiles).mockResolvedValue({ success: true });

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const restoreButton = screen.getByText('Restore Snapshot').closest('button')!;
      await user.click(restoreButton);

      // Wait for success state
      expect(await screen.findByText('Restore Complete')).toBeInTheDocument();
      expect(screen.getByText('Files have been restored to:')).toBeInTheDocument();
      expect(screen.getByText('/destination/restored')).toBeInTheDocument();
      expect(screen.getByText('Open in Finder')).toBeInTheDocument();
    });

    it('should call api.openPath when Open in Finder is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(api.restoreFiles).mockResolvedValue({ success: true });

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const restoreButton = screen.getByText('Restore Snapshot').closest('button')!;
      await user.click(restoreButton);

      // Wait for success state
      const openButton = await screen.findByText('Open in Finder');
      await user.click(openButton.closest('button')!);

      expect(api.openPath).toHaveBeenCalledWith('/destination/restored');
    });
  });

  // Test 10-11: Close functionality
  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      // Find close button (X icon)
      const closeButton = screen.getByTestId('icon-x').closest('button')!;
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByText('Cancel').closest('button')!;
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      // The backdrop is the first child with flex-1 class
      const overlay = screen.getByText('Restore Files').closest('.tm-overlay')!;
      const backdrop = overlay.querySelector('.flex-1')!;
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  // Additional: State reset on open
  describe('State Management', () => {
    it('should reset error and success state when overlay reopens', () => {
      const { rerender } = render(
        <RestoreOverlay
          isOpen={false}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      // Reopen overlay
      rerender(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      // Should not show error or success state
      expect(screen.queryByText('Restore Complete')).not.toBeInTheDocument();
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it('should update selected snapshot when prop changes', () => {
      const { rerender } = render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('snap-1');

      // Update snapshot prop
      rerender(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[1]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      expect(select.value).toBe('snap-2');
    });

    it('should set default target path based on job destination', () => {
      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByPlaceholderText('/Users/you/Desktop') as HTMLInputElement;
      expect(input.value).toBe('/destination/restored');
    });
  });

  // Edge cases
  describe('Edge Cases', () => {
    it('should handle snapshot without path', async () => {
      const user = userEvent.setup();
      const snapshotWithoutPath = { ...mockSnapshots[0], path: undefined };

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={snapshotWithoutPath}
          snapshots={[snapshotWithoutPath]}
          onClose={mockOnClose}
        />
      );

      const restoreButton = screen.getByText('Restore Snapshot').closest('button')!;
      await user.click(restoreButton);

      expect(await screen.findByText('No snapshot selected')).toBeInTheDocument();
    });

    it('should disable controls during restore', async () => {
      const user = userEvent.setup();
      let resolveRestore: (value: { success: boolean }) => void;
      const restorePromise = new Promise<{ success: boolean }>(resolve => {
        resolveRestore = resolve;
      });
      vi.mocked(api.restoreFiles).mockReturnValue(restorePromise);

      render(
        <RestoreOverlay
          isOpen={true}
          job={mockJob}
          snapshot={mockSnapshots[0]}
          snapshots={mockSnapshots}
          onClose={mockOnClose}
        />
      );

      const restoreButton = screen.getByText('Restore Snapshot').closest('button')!;
      await user.click(restoreButton);

      // Controls should be disabled
      const select = screen.getByRole('combobox');
      const input = screen.getByPlaceholderText('/Users/you/Desktop');
      const browseButton = screen.getAllByTestId('icon-folder')[0].closest('button')!;

      expect(select).toBeDisabled();
      expect(input).toBeDisabled();
      expect(browseButton).toBeDisabled();

      // Resolve restore
      resolveRestore!({ success: true });

      await waitFor(() => {
        expect(screen.queryByText('Preparing restore...')).not.toBeInTheDocument();
      });
    });
  });
});
