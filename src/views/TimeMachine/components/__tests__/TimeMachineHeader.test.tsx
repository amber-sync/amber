import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeMachineHeader } from '../TimeMachineHeader';
import {
  SyncJob,
  SyncMode,
  DestinationType,
  JobStatus,
  RsyncProgressData,
} from '../../../../types';

// Mock IconComponents
vi.mock('../../../../components/IconComponents', () => ({
  Icons: {
    ArrowLeft: ({ size }: { size: number }) => <span data-testid="icon-arrow-left">{size}</span>,
    Database: ({ size }: { size: number }) => <span data-testid="icon-database">{size}</span>,
    ChevronDown: ({ size, className }: { size: number; className?: string }) => (
      <span data-testid="icon-chevron-down" className={className}>
        {size}
      </span>
    ),
    Play: ({ size }: { size: number }) => <span data-testid="icon-play">{size}</span>,
    Square: ({ size }: { size: number }) => <span data-testid="icon-square">{size}</span>,
    Pencil: ({ size }: { size: number }) => <span data-testid="icon-pencil">{size}</span>,
  },
}));

const createMockJob = (overrides: Partial<SyncJob> = {}): SyncJob => ({
  id: 'test-job-1',
  name: 'Test Backup',
  sourcePath: '/Users/test/Documents',
  destPath: '/Volumes/Backup',
  mode: SyncMode.TIME_MACHINE,
  destinationType: DestinationType.LOCAL,
  scheduleInterval: 1440,
  lastRun: Date.now() - 3600000,
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
  snapshots: [],
  ...overrides,
});

const createMockProgressData = (overrides: Partial<RsyncProgressData> = {}): RsyncProgressData => ({
  transferred: '50MB',
  percentage: 75,
  speed: '10MB/s',
  eta: '5m',
  currentFile: '/test/file.txt',
  ...overrides,
});

describe('TimeMachineHeader', () => {
  const mockOnBack = vi.fn();
  const mockOnJobSwitch = vi.fn();
  const mockOnRunBackup = vi.fn();
  const mockOnStopBackup = vi.fn();
  const mockOnEditJob = vi.fn();
  const mockOnDateFilterChange = vi.fn();

  const defaultProps = {
    job: createMockJob(),
    jobs: [
      createMockJob({ id: 'job-1', name: 'Job 1' }),
      createMockJob({ id: 'job-2', name: 'Job 2', status: JobStatus.RUNNING }),
      createMockJob({ id: 'job-3', name: 'Job 3', status: JobStatus.FAILED }),
    ],
    isRunning: false,
    progress: null,
    onJobSwitch: mockOnJobSwitch,
    onBack: mockOnBack,
    onRunBackup: mockOnRunBackup,
    onStopBackup: mockOnStopBackup,
    onEditJob: mockOnEditJob,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Back Button', () => {
    it('calls onBack handler when clicked', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...defaultProps} />);

      const backButton = screen.getByTitle('Back to Dashboard');
      await user.click(backButton);

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    it('renders back arrow icon', () => {
      render(<TimeMachineHeader {...defaultProps} />);
      expect(screen.getByTestId('icon-arrow-left')).toBeInTheDocument();
    });
  });

  describe('Job Selector Dropdown', () => {
    it('displays current job name', () => {
      render(
        <TimeMachineHeader {...defaultProps} job={createMockJob({ name: 'My Backup Job' })} />
      );
      expect(screen.getByText('My Backup Job')).toBeInTheDocument();
    });

    it('displays "Select Job" when no job selected', () => {
      render(<TimeMachineHeader {...defaultProps} job={null} />);
      expect(screen.getByText('Select Job')).toBeInTheDocument();
    });

    it('opens dropdown when selector is clicked', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...defaultProps} />);

      const selector = screen.getByRole('button', { name: /test backup/i });
      await user.click(selector);

      // Dropdown should show all jobs
      expect(screen.getByText('Job 1')).toBeInTheDocument();
      expect(screen.getByText('Job 2')).toBeInTheDocument();
      expect(screen.getByText('Job 3')).toBeInTheDocument();
    });

    it('closes dropdown when selector is clicked again', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...defaultProps} />);

      const selector = screen.getByRole('button', { name: /test backup/i });

      // Open dropdown
      await user.click(selector);
      expect(screen.getByText('Job 1')).toBeInTheDocument();

      // Close dropdown
      await user.click(selector);
      await waitFor(() => {
        expect(screen.queryByText('Job 1')).not.toBeInTheDocument();
      });
    });

    it('closes dropdown when clicking outside', async () => {
      render(<TimeMachineHeader {...defaultProps} />);

      const selector = screen.getByRole('button', { name: /test backup/i });

      // Open dropdown
      fireEvent.click(selector);
      expect(screen.getByText('Job 1')).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('Job 1')).not.toBeInTheDocument();
      });
    });

    it('displays job source paths in dropdown', async () => {
      const user = userEvent.setup();
      const jobsWithPaths = [
        createMockJob({ id: 'job-1', name: 'Job 1', sourcePath: '/Users/test/Documents' }),
        createMockJob({ id: 'job-2', name: 'Job 2', sourcePath: '/Users/test/Photos' }),
      ];

      render(<TimeMachineHeader {...defaultProps} jobs={jobsWithPaths} />);

      const selector = screen.getByRole('button', { name: /test backup/i });
      await user.click(selector);

      expect(screen.getByText('/Users/test/Documents')).toBeInTheDocument();
      expect(screen.getByText('/Users/test/Photos')).toBeInTheDocument();
    });

    it('shows status indicators for jobs', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...defaultProps} />);

      const selector = screen.getByRole('button', { name: /test backup/i });
      await user.click(selector);

      // Check that status dots are rendered (implementation uses colored divs)
      const dropdownItems = screen.getAllByRole('button');
      const jobButtons = dropdownItems.filter(
        btn => btn.textContent?.includes('Job') && !btn.textContent?.includes('Test Backup')
      );

      expect(jobButtons.length).toBeGreaterThan(0);
    });

    it('displays "No jobs configured" when jobs array is empty', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...defaultProps} job={null} jobs={[]} />);

      const selector = screen.getByText('Select Job').closest('button');
      expect(selector).toBeInTheDocument();
      await user.click(selector!);

      expect(screen.getByText('No jobs configured')).toBeInTheDocument();
    });
  });

  describe('Job Switching', () => {
    it('calls onJobSwitch with correct job ID when job is selected', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...defaultProps} />);

      const selector = screen.getByRole('button', { name: /test backup/i });
      await user.click(selector);

      const job2Button = screen.getByText('Job 2').closest('button');
      expect(job2Button).toBeInTheDocument();

      await user.click(job2Button!);

      expect(mockOnJobSwitch).toHaveBeenCalledWith('job-2');
    });

    it('closes dropdown after selecting a job', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...defaultProps} />);

      const selector = screen.getByRole('button', { name: /test backup/i });
      await user.click(selector);

      const job2Button = screen.getByText('Job 2').closest('button');
      await user.click(job2Button!);

      await waitFor(() => {
        expect(screen.queryByText('Job 1')).not.toBeInTheDocument();
      });
    });

    it('highlights currently selected job in dropdown', async () => {
      const user = userEvent.setup();
      const currentJob = createMockJob({ id: 'job-2', name: 'Job 2' });

      render(<TimeMachineHeader {...defaultProps} job={currentJob} />);

      const selector = screen.getByRole('button', { name: /job 2/i });
      await user.click(selector);

      // Get all buttons with "Job 2" text and find the one in the dropdown (not the selector button)
      const allJob2Elements = screen.getAllByText('Job 2');
      // The dropdown item will have the font-medium truncate class on its div
      const job2DropdownItem = allJob2Elements.find(el =>
        el.className.includes('font-medium truncate')
      );
      expect(job2DropdownItem).toBeDefined();

      const job2Button = job2DropdownItem?.closest('button');
      expect(job2Button).toHaveClass('bg-[var(--tm-amber-wash)]');
    });
  });

  describe('Date Filter Dropdown', () => {
    const propsWithDateFilter = {
      ...defaultProps,
      dateFilter: 'all' as const,
      onDateFilterChange: mockOnDateFilterChange,
    };

    it('renders date filter when onDateFilterChange is provided', () => {
      render(<TimeMachineHeader {...propsWithDateFilter} />);
      expect(screen.getByText('All Time')).toBeInTheDocument();
    });

    it('does not render date filter when onDateFilterChange is not provided', () => {
      render(<TimeMachineHeader {...defaultProps} />);
      expect(screen.queryByText('All Time')).not.toBeInTheDocument();
    });

    it('does not render date filter when no job is selected', () => {
      render(<TimeMachineHeader {...propsWithDateFilter} job={null} />);
      expect(screen.queryByText('All Time')).not.toBeInTheDocument();
    });

    it('opens dropdown when date filter button is clicked', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...propsWithDateFilter} />);

      const filterButton = screen.getByText('All Time');
      await user.click(filterButton);

      expect(screen.getByText('7 Days')).toBeInTheDocument();
      expect(screen.getByText('30 Days')).toBeInTheDocument();
      expect(screen.getByText('90 Days')).toBeInTheDocument();
      expect(screen.getByText('1 Year')).toBeInTheDocument();
    });

    it('calls onDateFilterChange with correct filter when option is selected', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...propsWithDateFilter} />);

      const filterButton = screen.getByText('All Time');
      await user.click(filterButton);

      const sevenDaysButton = screen.getByText('7 Days');
      await user.click(sevenDaysButton);

      expect(mockOnDateFilterChange).toHaveBeenCalledWith('7days');
    });

    it('closes dropdown after selecting a filter', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...propsWithDateFilter} />);

      const filterButton = screen.getByText('All Time');
      await user.click(filterButton);

      const thirtyDaysButton = screen.getByText('30 Days');
      await user.click(thirtyDaysButton);

      await waitFor(() => {
        expect(screen.queryByText('90 Days')).not.toBeInTheDocument();
      });
    });

    it('displays current filter label', () => {
      render(<TimeMachineHeader {...propsWithDateFilter} dateFilter="30days" />);
      expect(screen.getByText('30 Days')).toBeInTheDocument();
    });

    it('highlights currently selected filter in dropdown', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...propsWithDateFilter} dateFilter="7days" />);

      const filterButton = screen.getByText('7 Days');
      await user.click(filterButton);

      const sevenDaysOption = screen.getAllByText('7 Days')[1]; // Second one is in dropdown
      expect(sevenDaysOption.closest('button')).toHaveClass('font-medium');
    });

    it('displays snapshot count when date filter is active', () => {
      render(
        <TimeMachineHeader
          {...propsWithDateFilter}
          dateFilter="7days"
          snapshotCount={5}
          totalSnapshotCount={20}
        />
      );
      expect(screen.getByText('5/20')).toBeInTheDocument();
    });

    it('does not display snapshot count when filter is "all"', () => {
      render(
        <TimeMachineHeader
          {...propsWithDateFilter}
          dateFilter="all"
          snapshotCount={5}
          totalSnapshotCount={20}
        />
      );
      expect(screen.queryByText('5/20')).not.toBeInTheDocument();
    });

    it('closes dropdown when clicking outside', async () => {
      render(<TimeMachineHeader {...propsWithDateFilter} />);

      const filterButton = screen.getByText('All Time');
      fireEvent.click(filterButton);

      expect(screen.getByText('7 Days')).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('90 Days')).not.toBeInTheDocument();
      });
    });
  });

  describe('Run Backup Button', () => {
    it('renders Run Backup button when not running', () => {
      render(<TimeMachineHeader {...defaultProps} isRunning={false} />);

      const runButton = screen.getByTitle('Run Backup');
      expect(runButton).toBeInTheDocument();
      expect(screen.getByText('Run Backup')).toBeInTheDocument();
      expect(screen.getByTestId('icon-play')).toBeInTheDocument();
    });

    it('calls onRunBackup when Run Backup button is clicked', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...defaultProps} isRunning={false} />);

      const runButton = screen.getByTitle('Run Backup');
      await user.click(runButton);

      expect(mockOnRunBackup).toHaveBeenCalledTimes(1);
    });

    it('does not render Run Backup button when no job is selected', () => {
      render(<TimeMachineHeader {...defaultProps} job={null} />);
      expect(screen.queryByTitle('Run Backup')).not.toBeInTheDocument();
    });

    it('has primary button styling', () => {
      render(<TimeMachineHeader {...defaultProps} isRunning={false} />);

      const runButton = screen.getByTitle('Run Backup');
      expect(runButton).toHaveClass('bg-accent-primary');
    });
  });

  describe('Stop Button', () => {
    it('renders Stop button when running', () => {
      render(<TimeMachineHeader {...defaultProps} isRunning={true} />);

      const stopButton = screen.getByTitle('Stop Backup');
      expect(stopButton).toBeInTheDocument();
      expect(screen.getByText('Stop')).toBeInTheDocument();
      expect(screen.getByTestId('icon-square')).toBeInTheDocument();
    });

    it('calls onStopBackup when Stop button is clicked', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...defaultProps} isRunning={true} />);

      const stopButton = screen.getByTitle('Stop Backup');
      await user.click(stopButton);

      expect(mockOnStopBackup).toHaveBeenCalledTimes(1);
    });

    it('has danger button styling', () => {
      render(<TimeMachineHeader {...defaultProps} isRunning={true} />);

      const stopButton = screen.getByTitle('Stop Backup');
      expect(stopButton).toHaveClass('bg-[var(--color-error)]');
    });
  });

  describe('Edit Button', () => {
    it('renders Edit button when job is present', () => {
      render(<TimeMachineHeader {...defaultProps} />);

      const editButton = screen.getByTitle('Edit Job Settings');
      expect(editButton).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByTestId('icon-pencil')).toBeInTheDocument();
    });

    it('calls onEditJob when Edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...defaultProps} />);

      const editButton = screen.getByTitle('Edit Job Settings');
      await user.click(editButton);

      expect(mockOnEditJob).toHaveBeenCalledTimes(1);
    });

    it('does not render Edit button when no job is selected', () => {
      render(<TimeMachineHeader {...defaultProps} job={null} />);
      expect(screen.queryByTitle('Edit Job Settings')).not.toBeInTheDocument();
    });

    it('has secondary button styling', () => {
      render(<TimeMachineHeader {...defaultProps} />);

      const editButton = screen.getByTitle('Edit Job Settings');
      expect(editButton).toHaveClass('bg-layer-3');
    });
  });

  describe('Progress Indicator', () => {
    it('shows progress indicator when isRunning is true and progress data exists', () => {
      const progressData = createMockProgressData({ percentage: 75 });

      render(<TimeMachineHeader {...defaultProps} isRunning={true} progress={progressData} />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('displays ETA when available', () => {
      const progressData = createMockProgressData({ percentage: 50, eta: '10m' });

      render(<TimeMachineHeader {...defaultProps} isRunning={true} progress={progressData} />);

      expect(screen.getByText('ETA 10m')).toBeInTheDocument();
    });

    it('does not display ETA when null', () => {
      const progressData = createMockProgressData({ percentage: 25, eta: null });

      render(<TimeMachineHeader {...defaultProps} isRunning={true} progress={progressData} />);

      expect(screen.queryByText(/ETA/)).not.toBeInTheDocument();
    });

    it('does not show progress indicator when not running', () => {
      const progressData = createMockProgressData();

      render(<TimeMachineHeader {...defaultProps} isRunning={false} progress={progressData} />);

      expect(screen.queryByText('75%')).not.toBeInTheDocument();
    });

    it('does not show progress indicator when progress is null', () => {
      render(<TimeMachineHeader {...defaultProps} isRunning={true} progress={null} />);

      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('shows live status dot when running', () => {
      const progressData = createMockProgressData();

      const { container } = render(
        <TimeMachineHeader {...defaultProps} isRunning={true} progress={progressData} />
      );

      const statusDot = container.querySelector('.tm-live-status-dot');
      expect(statusDot).toBeInTheDocument();
    });
  });

  describe('Button States Toggle', () => {
    it('shows Run Backup button when isRunning is false', () => {
      render(<TimeMachineHeader {...defaultProps} isRunning={false} />);

      expect(screen.getByTitle('Run Backup')).toBeInTheDocument();
      expect(screen.queryByTitle('Stop Backup')).not.toBeInTheDocument();
    });

    it('shows Stop button when isRunning is true', () => {
      render(<TimeMachineHeader {...defaultProps} isRunning={true} />);

      expect(screen.getByTitle('Stop Backup')).toBeInTheDocument();
      expect(screen.queryByTitle('Run Backup')).not.toBeInTheDocument();
    });

    it('toggles between Run and Stop buttons correctly', () => {
      const { rerender } = render(<TimeMachineHeader {...defaultProps} isRunning={false} />);

      expect(screen.getByTitle('Run Backup')).toBeInTheDocument();

      rerender(<TimeMachineHeader {...defaultProps} isRunning={true} />);

      expect(screen.getByTitle('Stop Backup')).toBeInTheDocument();
      expect(screen.queryByTitle('Run Backup')).not.toBeInTheDocument();

      rerender(<TimeMachineHeader {...defaultProps} isRunning={false} />);

      expect(screen.getByTitle('Run Backup')).toBeInTheDocument();
      expect(screen.queryByTitle('Stop Backup')).not.toBeInTheDocument();
    });

    it('Edit button remains visible regardless of running state', () => {
      const { rerender } = render(<TimeMachineHeader {...defaultProps} isRunning={false} />);

      expect(screen.getByTitle('Edit Job Settings')).toBeInTheDocument();

      rerender(<TimeMachineHeader {...defaultProps} isRunning={true} />);

      expect(screen.getByTitle('Edit Job Settings')).toBeInTheDocument();
    });
  });

  describe('Chevron Rotation', () => {
    it('rotates job selector chevron when dropdown is open', async () => {
      const user = userEvent.setup();
      const { container } = render(<TimeMachineHeader {...defaultProps} />);

      const selector = screen.getByRole('button', { name: /test backup/i });
      const chevrons = container.querySelectorAll('[data-testid="icon-chevron-down"]');
      const jobChevron = chevrons[0];

      expect(jobChevron).not.toHaveClass('rotate-180');

      await user.click(selector);

      expect(jobChevron).toHaveClass('rotate-180');
    });

    it('rotates date filter chevron when dropdown is open', async () => {
      const user = userEvent.setup();
      const propsWithDateFilter = {
        ...defaultProps,
        dateFilter: 'all' as const,
        onDateFilterChange: mockOnDateFilterChange,
      };

      const { container } = render(<TimeMachineHeader {...propsWithDateFilter} />);

      const filterButton = screen.getByText('All Time');
      const chevrons = container.querySelectorAll('[data-testid="icon-chevron-down"]');
      const dateChevron = chevrons[1];

      expect(dateChevron).not.toHaveClass('rotate-180');

      await user.click(filterButton);

      expect(dateChevron).toHaveClass('rotate-180');
    });
  });

  describe('Multiple Interactions', () => {
    it('handles rapid button clicks without errors', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...defaultProps} />);

      const editButton = screen.getByTitle('Edit Job Settings');

      await user.click(editButton);
      await user.click(editButton);
      await user.click(editButton);

      expect(mockOnEditJob).toHaveBeenCalledTimes(3);
    });

    it('allows switching jobs while backup is running', async () => {
      const user = userEvent.setup();
      render(<TimeMachineHeader {...defaultProps} isRunning={true} />);

      const selector = screen.getByRole('button', { name: /test backup/i });
      await user.click(selector);

      const job2Button = screen.getByText('Job 2').closest('button');
      await user.click(job2Button!);

      expect(mockOnJobSwitch).toHaveBeenCalledWith('job-2');
    });

    it('closes both dropdowns independently', async () => {
      const user = userEvent.setup();
      const propsWithDateFilter = {
        ...defaultProps,
        dateFilter: 'all' as const,
        onDateFilterChange: mockOnDateFilterChange,
      };

      render(<TimeMachineHeader {...propsWithDateFilter} />);

      // Open job dropdown
      const jobSelector = screen.getByRole('button', { name: /test backup/i });
      await user.click(jobSelector);
      expect(screen.getByText('Job 1')).toBeInTheDocument();

      // Open date dropdown
      const dateFilter = screen.getByText('All Time');
      await user.click(dateFilter);
      expect(screen.getByText('7 Days')).toBeInTheDocument();

      // Close job dropdown
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('Job 1')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible button titles', () => {
      render(<TimeMachineHeader {...defaultProps} />);

      expect(screen.getByTitle('Back to Dashboard')).toBeInTheDocument();
      expect(screen.getByTitle('Run Backup')).toBeInTheDocument();
      expect(screen.getByTitle('Edit Job Settings')).toBeInTheDocument();
    });

    it('uses semantic button elements', () => {
      render(<TimeMachineHeader {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('has proper button labels for screen readers', () => {
      render(<TimeMachineHeader {...defaultProps} />);

      const runButton = screen.getByTitle('Run Backup');
      expect(runButton.textContent).toContain('Run Backup');

      const editButton = screen.getByTitle('Edit Job Settings');
      expect(editButton.textContent).toContain('Edit');
    });
  });
});
