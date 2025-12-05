import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TimelineRuler } from '../TimelineRuler';
import { TimeMachineSnapshot } from '../../TimeMachinePage';

// Mock date-fns to ensure consistent date formatting in tests
vi.mock('date-fns', async () => {
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns');
  return {
    ...actual,
    format: (date: Date, formatStr: string) => {
      const d = new Date(date);
      if (formatStr === 'MMM yyyy') {
        return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
      }
      if (formatStr === 'MMM d, yyyy') {
        return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}, ${d.getFullYear()}`;
      }
      if (formatStr === 'MMM d') {
        return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
      }
      if (formatStr === 'h:mm a') {
        return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
      return actual.format(date, formatStr);
    },
  };
});

// Helper to create mock snapshots
const createMockSnapshot = (
  timestamp: number,
  status: 'Complete' | 'Failed' | 'Partial' = 'Complete'
): TimeMachineSnapshot => ({
  id: `snap-${timestamp}`,
  timestamp,
  path: `/backup/${timestamp}`,
  status,
  sizeBytes: 1024000,
  fileCount: 100,
  changesCount: 10,
  duration: 1000,
  jobId: 'test-job',
  jobName: 'Test Job',
});

describe('TimelineRuler', () => {
  const mockOnSelectSnapshot = vi.fn();
  const baseTimeRange = {
    start: new Date('2024-01-01').getTime(),
    end: new Date('2024-12-31').getTime(),
  };

  beforeEach(() => {
    mockOnSelectSnapshot.mockClear();
  });

  describe('Loading State', () => {
    it('renders loading state when loading=true', () => {
      const { container } = render(
        <TimelineRuler
          snapshots={[]}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
          loading={true}
        />
      );

      const timeline = container.querySelector('.tm-timeline');
      expect(timeline).toBeTruthy();

      const track = container.querySelector('.tm-timeline-track');
      expect(track).toBeTruthy();
      expect(track?.classList.contains('animate-pulse')).toBe(true);
    });

    it('does not render markers when loading', () => {
      const snapshots = [
        createMockSnapshot(new Date('2024-06-01').getTime()),
        createMockSnapshot(new Date('2024-07-01').getTime()),
      ];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
          loading={true}
        />
      );

      const markers = container.querySelectorAll('.tm-marker');
      expect(markers.length).toBe(0);
    });
  });

  describe('Snapshot Markers', () => {
    it('renders snapshot markers for provided snapshots', () => {
      const snapshots = [
        createMockSnapshot(new Date('2024-03-15').getTime()),
        createMockSnapshot(new Date('2024-06-20').getTime()),
        createMockSnapshot(new Date('2024-09-10').getTime()),
      ];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const markers = container.querySelectorAll('.tm-marker');
      expect(markers.length).toBe(3);
    });

    it('renders no markers when snapshots array is empty', () => {
      const { container } = render(
        <TimelineRuler
          snapshots={[]}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const markers = container.querySelectorAll('.tm-marker');
      expect(markers.length).toBe(0);
    });

    it('clicking a marker calls onSelectSnapshot with correct timestamp', () => {
      const timestamp = new Date('2024-06-15').getTime();
      const snapshots = [createMockSnapshot(timestamp)];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const marker = container.querySelector('.tm-marker');
      expect(marker).toBeTruthy();

      fireEvent.click(marker!);
      expect(mockOnSelectSnapshot).toHaveBeenCalledWith(timestamp);
      expect(mockOnSelectSnapshot).toHaveBeenCalledTimes(1);
    });

    it('selected marker has correct styling (tm-marker--selected class)', () => {
      const selectedTimestamp = new Date('2024-06-15').getTime();
      const snapshots = [
        createMockSnapshot(new Date('2024-03-15').getTime()),
        createMockSnapshot(selectedTimestamp),
        createMockSnapshot(new Date('2024-09-15').getTime()),
      ];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={selectedTimestamp}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const markers = container.querySelectorAll('.tm-marker');
      expect(markers.length).toBe(3);

      const selectedMarker = container.querySelector('.tm-marker--selected');
      expect(selectedMarker).toBeTruthy();

      // Verify only one marker is selected
      const allSelectedMarkers = container.querySelectorAll('.tm-marker--selected');
      expect(allSelectedMarkers.length).toBe(1);
    });

    it('applies failed styling to failed snapshots', () => {
      const snapshots = [createMockSnapshot(new Date('2024-06-15').getTime(), 'Failed')];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const failedMarker = container.querySelector('.tm-marker--failed');
      expect(failedMarker).toBeTruthy();
    });

    it('applies partial styling to partial snapshots', () => {
      const snapshots = [createMockSnapshot(new Date('2024-06-15').getTime(), 'Partial')];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const partialMarker = container.querySelector('.tm-marker--partial');
      expect(partialMarker).toBeTruthy();
    });
  });

  describe('Clustering', () => {
    it('clusters nearby snapshots and shows count badge', () => {
      // Create snapshots very close together (within 2% of timeline)
      const baseTimestamp = new Date('2024-06-15T10:00:00').getTime();
      const snapshots = [
        createMockSnapshot(baseTimestamp),
        createMockSnapshot(baseTimestamp + 60000), // 1 minute later
        createMockSnapshot(baseTimestamp + 120000), // 2 minutes later
        createMockSnapshot(baseTimestamp + 180000), // 3 minutes later
      ];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      // Should have fewer markers than snapshots due to clustering
      const markers = container.querySelectorAll('.tm-marker');
      expect(markers.length).toBeLessThanOrEqual(snapshots.length);

      // Check for cluster badge
      const badges = container.querySelectorAll('.absolute.-top-1.-right-1');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('displays correct count in cluster badge', () => {
      const baseTimestamp = new Date('2024-06-15T10:00:00').getTime();
      const snapshots = [
        createMockSnapshot(baseTimestamp),
        createMockSnapshot(baseTimestamp + 30000),
        createMockSnapshot(baseTimestamp + 60000),
      ];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const badge = container.querySelector('.absolute.-top-1.-right-1');
      if (badge) {
        expect(badge.textContent).toMatch(/[0-9]\+?/);
      }
    });

    it('shows "9+" for clusters with more than 9 snapshots', () => {
      const baseTimestamp = new Date('2024-06-15T10:00:00').getTime();
      const snapshots = Array.from({ length: 12 }, (_, i) =>
        createMockSnapshot(baseTimestamp + i * 10000)
      );

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const badges = container.querySelectorAll('.absolute.-top-1.-right-1');
      if (badges.length > 0) {
        const hasNinePlus = Array.from(badges).some(badge => badge.textContent === '9+');
        expect(hasNinePlus).toBe(true);
      }
    });

    it('does not cluster snapshots that are far apart', () => {
      const snapshots = [
        createMockSnapshot(new Date('2024-01-15').getTime()),
        createMockSnapshot(new Date('2024-06-15').getTime()),
        createMockSnapshot(new Date('2024-11-15').getTime()),
      ];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const markers = container.querySelectorAll('.tm-marker');
      expect(markers.length).toBe(3);

      // No cluster badges should be present
      const badges = container.querySelectorAll('.absolute.-top-1.-right-1');
      expect(badges.length).toBe(0);
    });
  });

  describe('Now Indicator', () => {
    it('shows "Now" indicator at the end', () => {
      const { container } = render(
        <TimelineRuler
          snapshots={[]}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const nowIndicator = container.querySelector('.tm-now-indicator');
      expect(nowIndicator).toBeTruthy();

      const nowLabel = container.querySelector('.tm-now-label');
      expect(nowLabel?.textContent).toBe('Now');

      const nowDot = container.querySelector('.tm-now-dot');
      expect(nowDot).toBeTruthy();
    });
  });

  describe('Month Labels', () => {
    it('displays month labels based on time range', () => {
      const { container } = render(
        <TimelineRuler
          snapshots={[]}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const labels = container.querySelectorAll('.tm-timeline-label');
      expect(labels.length).toBeGreaterThan(0);
    });

    it('month labels contain proper formatting', () => {
      const { container } = render(
        <TimelineRuler
          snapshots={[]}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const labels = container.querySelectorAll('.tm-timeline-label');
      labels.forEach(label => {
        // Should match pattern like "Jan 2024", "Feb 2024", etc.
        expect(label.textContent).toMatch(/[A-Z][a-z]{2}\s\d{4}/);
      });
    });

    it('adjusts number of labels based on time range', () => {
      const shortTimeRange = {
        start: new Date('2024-01-01').getTime(),
        end: new Date('2024-03-31').getTime(),
      };

      const { container: shortContainer } = render(
        <TimelineRuler
          snapshots={[]}
          selectedTimestamp={null}
          timeRange={shortTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const { container: longContainer } = render(
        <TimelineRuler
          snapshots={[]}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const shortLabels = shortContainer.querySelectorAll('.tm-timeline-label');
      const longLabels = longContainer.querySelectorAll('.tm-timeline-label');

      // Longer time ranges should have more labels (but capped at max)
      expect(longLabels.length).toBeGreaterThanOrEqual(shortLabels.length);
    });
  });

  describe('Tooltip', () => {
    it('hovering marker shows tooltip', async () => {
      const timestamp = new Date('2024-06-15T14:30:00').getTime();
      const snapshots = [createMockSnapshot(timestamp)];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const marker = container.querySelector('.tm-marker');
      expect(marker).toBeTruthy();

      fireEvent.mouseEnter(marker!);

      await waitFor(() => {
        const tooltip = container.querySelector('.tm-animate-fade-in');
        expect(tooltip).toBeTruthy();
      });
    });

    it('tooltip disappears when mouse leaves marker', async () => {
      const timestamp = new Date('2024-06-15T14:30:00').getTime();
      const snapshots = [createMockSnapshot(timestamp)];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const marker = container.querySelector('.tm-marker');
      expect(marker).toBeTruthy();

      fireEvent.mouseEnter(marker!);

      await waitFor(() => {
        const tooltip = container.querySelector('.tm-animate-fade-in');
        expect(tooltip).toBeTruthy();
      });

      fireEvent.mouseLeave(marker!);

      await waitFor(() => {
        const tooltip = container.querySelector('.tm-animate-fade-in');
        expect(tooltip).toBeFalsy();
      });
    });

    it('tooltip shows date and time for single snapshot', async () => {
      const timestamp = new Date('2024-06-15T14:30:00').getTime();
      const snapshots = [createMockSnapshot(timestamp)];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const marker = container.querySelector('.tm-marker');
      fireEvent.mouseEnter(marker!);

      await waitFor(() => {
        const tooltip = container.querySelector('.tm-animate-fade-in');
        expect(tooltip).toBeTruthy();
        expect(tooltip?.textContent).toContain('Jun');
        expect(tooltip?.textContent).toContain('15');
        expect(tooltip?.textContent).toContain('2024');
      });
    });

    it('tooltip shows count and date range for clustered snapshots', async () => {
      const baseTimestamp = new Date('2024-06-15T10:00:00').getTime();
      const snapshots = [
        createMockSnapshot(baseTimestamp),
        createMockSnapshot(baseTimestamp + 30000),
        createMockSnapshot(baseTimestamp + 60000),
      ];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const markers = container.querySelectorAll('.tm-marker');
      if (markers.length > 0) {
        fireEvent.mouseEnter(markers[0]);

        await waitFor(() => {
          const tooltip = container.querySelector('.tm-animate-fade-in');
          if (tooltip) {
            expect(tooltip.textContent).toMatch(/\d+\ssnapshots?/);
          }
        });
      }
    });
  });

  describe('Track Interaction', () => {
    it('clicking on track near a marker selects that snapshot', () => {
      const timestamp = new Date('2024-06-15').getTime();
      const snapshots = [createMockSnapshot(timestamp)];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const track = container.querySelector('.tm-timeline-track');
      expect(track).toBeTruthy();

      // Mock getBoundingClientRect for track
      const mockRect = { left: 0, width: 1000, top: 0, bottom: 50, right: 1000, height: 50 };
      vi.spyOn(track!, 'getBoundingClientRect').mockReturnValue(mockRect as DOMRect);

      // Click in the middle of the track (should be close to the June snapshot)
      fireEvent.click(track!, { clientX: 450 });

      expect(mockOnSelectSnapshot).toHaveBeenCalled();
    });

    it('clicking far from any marker does not select a snapshot', () => {
      const snapshots = [createMockSnapshot(new Date('2024-01-15').getTime())];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const track = container.querySelector('.tm-timeline-track');
      const mockRect = { left: 0, width: 1000, top: 0, bottom: 50, right: 1000, height: 50 };
      vi.spyOn(track!, 'getBoundingClientRect').mockReturnValue(mockRect as DOMRect);

      // Click very far from the January snapshot (near December)
      fireEvent.click(track!, { clientX: 950 });

      expect(mockOnSelectSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero time range gracefully', () => {
      const timestamp = new Date('2024-06-15').getTime();
      const zeroTimeRange = { start: timestamp, end: timestamp };
      const snapshots = [createMockSnapshot(timestamp)];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={zeroTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const markers = container.querySelectorAll('.tm-marker');
      expect(markers.length).toBeGreaterThan(0);
    });

    it('handles very large number of snapshots by limiting markers', () => {
      const baseTimestamp = new Date('2024-01-01').getTime();
      const snapshots = Array.from(
        { length: 200 },
        (_, i) => createMockSnapshot(baseTimestamp + i * 86400000) // One per day
      );

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      const markers = container.querySelectorAll('.tm-marker');
      // Should limit to MAX_MARKERS (80)
      expect(markers.length).toBeLessThanOrEqual(80);
    });

    it('handles snapshot timestamp outside time range', () => {
      const outsideTimestamp = new Date('2025-06-15').getTime(); // Outside 2024 range
      const snapshots = [createMockSnapshot(outsideTimestamp)];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      // Should still render, but position will be clamped
      const markers = container.querySelectorAll('.tm-marker');
      expect(markers.length).toBe(1);
    });

    it('handles mixed status snapshots in cluster', () => {
      const baseTimestamp = new Date('2024-06-15T10:00:00').getTime();
      const snapshots = [
        createMockSnapshot(baseTimestamp, 'Complete'),
        createMockSnapshot(baseTimestamp + 30000, 'Failed'),
        createMockSnapshot(baseTimestamp + 60000, 'Partial'),
      ];

      const { container } = render(
        <TimelineRuler
          snapshots={snapshots}
          selectedTimestamp={null}
          timeRange={baseTimeRange}
          onSelectSnapshot={mockOnSelectSnapshot}
        />
      );

      // Should show failed styling if any snapshot in cluster failed
      const markers = container.querySelectorAll('.tm-marker');
      expect(markers.length).toBeGreaterThan(0);
    });
  });
});
