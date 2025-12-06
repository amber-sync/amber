/**
 * TimelineRuler - THE primary navigation component
 *
 * A horizontal timeline showing all snapshots as markers.
 * The central axis for navigating through backup history.
 */

import React, { useRef, useMemo, useCallback, useState } from 'react';
import { format, startOfMonth, addMonths, differenceInMonths } from 'date-fns';
import { TimeMachineSnapshot } from '../TimeMachinePage';
import { Body, Caption } from '../../../components/ui';

interface TimelineRulerProps {
  snapshots: TimeMachineSnapshot[];
  selectedTimestamp: number | null;
  timeRange: { start: number; end: number };
  onSelectSnapshot: (timestamp: number) => void;
  loading?: boolean;
}

interface ClusteredMarker {
  position: number; // 0-100%
  snapshots: TimeMachineSnapshot[];
  isCluster: boolean;
}

const CLUSTER_THRESHOLD_PERCENT = 2; // Minimum % between markers before clustering
const MAX_MARKERS = 80;

// Timeline display margins - shrinks the visual timeline to leave breathing room
const TIMELINE_MARGIN_LEFT = 4; // % from left edge
const TIMELINE_MARGIN_RIGHT = 4; // % from right edge
const TIMELINE_USABLE_WIDTH = 100 - TIMELINE_MARGIN_LEFT - TIMELINE_MARGIN_RIGHT;

// Maps logical position (0-100%) to display position with margins
const toDisplayPosition = (position: number): number => {
  return TIMELINE_MARGIN_LEFT + (position / 100) * TIMELINE_USABLE_WIDTH;
};

export const TimelineRuler = React.memo<TimelineRulerProps>(
  function TimelineRuler({
    snapshots,
    selectedTimestamp,
    timeRange,
    onSelectSnapshot,
    loading = false,
  }) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [hoveredMarker, setHoveredMarker] = useState<ClusteredMarker | null>(null);

    // Calculate position for a timestamp (0-100%)
    const getPosition = useCallback(
      (timestamp: number): number => {
        const range = timeRange.end - timeRange.start;
        if (range <= 0) return 100;
        return Math.min(100, Math.max(0, ((timestamp - timeRange.start) / range) * 100));
      },
      [timeRange]
    );

    // Cluster nearby markers for performance and readability
    const clusteredMarkers = useMemo((): ClusteredMarker[] => {
      if (snapshots.length === 0) return [];

      const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
      const withPositions = sorted.map(s => ({
        snapshot: s,
        position: getPosition(s.timestamp),
      }));

      const clusters: ClusteredMarker[] = [];
      let currentCluster: TimeMachineSnapshot[] = [];
      let clusterStartPosition = 0;

      for (let i = 0; i < withPositions.length; i++) {
        const { snapshot, position } = withPositions[i];

        if (currentCluster.length === 0) {
          currentCluster.push(snapshot);
          clusterStartPosition = position;
        } else {
          const distance = position - clusterStartPosition;
          if (distance < CLUSTER_THRESHOLD_PERCENT) {
            currentCluster.push(snapshot);
          } else {
            // Finish current cluster
            const avgPos =
              currentCluster.reduce((acc, s) => acc + getPosition(s.timestamp), 0) /
              currentCluster.length;
            clusters.push({
              position: avgPos,
              snapshots: currentCluster,
              isCluster: currentCluster.length > 1,
            });
            currentCluster = [snapshot];
            clusterStartPosition = position;
          }
        }
      }

      // Add last cluster
      if (currentCluster.length > 0) {
        const avgPos =
          currentCluster.reduce((acc, s) => acc + getPosition(s.timestamp), 0) /
          currentCluster.length;
        clusters.push({
          position: avgPos,
          snapshots: currentCluster,
          isCluster: currentCluster.length > 1,
        });
      }

      // Limit markers if too many
      if (clusters.length > MAX_MARKERS) {
        const step = clusters.length / MAX_MARKERS;
        return Array.from({ length: MAX_MARKERS }, (_, i) => clusters[Math.floor(i * step)]);
      }

      return clusters;
    }, [snapshots, getPosition]);

    // Generate month labels with smart density and collision detection
    const monthLabels = useMemo(() => {
      const startDate = new Date(timeRange.start);
      const endDate = new Date(timeRange.end);
      const months = differenceInMonths(endDate, startDate);

      if (months < 0) return [];

      // Generate all candidate labels first
      const candidates: { position: number; date: Date; isFirstOfYear: boolean }[] = [];

      for (let i = 0; i <= months; i++) {
        const date = addMonths(startOfMonth(startDate), i);
        const pos = getPosition(date.getTime());

        // Only include labels within visible range
        if (pos >= 0 && pos <= 95) {
          candidates.push({
            position: pos,
            date,
            isFirstOfYear: date.getMonth() === 0 || i === 0,
          });
        }
      }

      if (candidates.length === 0) return [];

      // Smart collision detection - minimum spacing between labels
      // Each label is ~60-80px, timeline is ~800px, so ~8-10% minimum spacing
      const MIN_LABEL_SPACING = 8; // % between labels to prevent overlap

      const filtered: typeof candidates = [];
      let lastPosition = -Infinity;

      for (const candidate of candidates) {
        const spacing = candidate.position - lastPosition;

        // Always show first label and year changes, otherwise check spacing
        if (filtered.length === 0 || candidate.isFirstOfYear || spacing >= MIN_LABEL_SPACING) {
          filtered.push(candidate);
          lastPosition = candidate.position;
        }
      }

      // Adaptive formatting based on label density
      // If sparse (few labels): show full "Aug 2025"
      // If dense (many labels): show short "Aug", but always show year on first label and year changes
      const labelDensity = filtered.length / Math.max(1, months);
      const useSparseFormat = labelDensity < 0.3 || months <= 6;

      return filtered.map((item, index) => {
        let labelFormat: string;

        if (index === 0 || item.isFirstOfYear) {
          // Always show year on first label and when year changes
          labelFormat = 'MMM yyyy';
        } else if (useSparseFormat) {
          // Sparse timeline: show full format
          labelFormat = 'MMM yyyy';
        } else {
          // Dense timeline: show short format
          labelFormat = 'MMM';
        }

        return {
          position: item.position,
          label: format(item.date, labelFormat),
        };
      });
    }, [timeRange, getPosition]);

    // Handle track click
    const handleTrackClick = useCallback(
      (e: React.MouseEvent) => {
        if (!trackRef.current || snapshots.length === 0) return;

        const rect = trackRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickPosition = (x / rect.width) * 100;

        // Find closest snapshot
        let closest: TimeMachineSnapshot | null = null;
        let minDiff = Infinity;

        for (const s of snapshots) {
          const pos = getPosition(s.timestamp);
          const diff = Math.abs(pos - clickPosition);
          if (diff < minDiff) {
            minDiff = diff;
            closest = s;
          }
        }

        if (closest && minDiff < 5) {
          onSelectSnapshot(closest.timestamp);
        }
      },
      [snapshots, getPosition, onSelectSnapshot]
    );

    // Find the hovered/selected marker for tooltip positioning
    const activeMarker =
      hoveredMarker ||
      clusteredMarkers.find(m => m.snapshots.some(s => s.timestamp === selectedTimestamp));

    // Loading state
    if (loading) {
      return (
        <div className="tm-timeline">
          <div className="tm-timeline-tooltip-zone" />
          <div className="tm-timeline-track animate-pulse">
            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[var(--tm-dust)] rounded-full -translate-y-1/2" />
          </div>
          <div className="tm-timeline-labels" />
        </div>
      );
    }

    return (
      <div className="tm-timeline">
        {/* Zone 1: Tooltip area (above track) */}
        <div className="tm-timeline-tooltip-zone">
          {activeMarker && (
            <div
              className="tm-timeline-tooltip tm-animate-fade-in"
              style={{ left: `${toDisplayPosition(activeMarker.position)}%` }}
            >
              <div className="tm-timeline-tooltip-content">
                {activeMarker.isCluster ? (
                  <>
                    <Body size="sm" weight="semibold" className="text-[var(--tm-text-bright)]">
                      {activeMarker.snapshots.length} snapshots
                    </Body>
                    <Caption className="text-[var(--tm-text-dim)] mt-0.5">
                      {format(new Date(activeMarker.snapshots[0].timestamp), 'MMM d')} –{' '}
                      {format(
                        new Date(
                          activeMarker.snapshots[activeMarker.snapshots.length - 1].timestamp
                        ),
                        'MMM d, yyyy'
                      )}
                    </Caption>
                  </>
                ) : (
                  <>
                    <Body size="sm" weight="semibold" className="text-[var(--tm-text-bright)]">
                      {format(new Date(activeMarker.snapshots[0].timestamp), 'MMM d, yyyy')}
                    </Body>
                    <Caption className="text-[var(--tm-text-dim)] mt-0.5">
                      {format(new Date(activeMarker.snapshots[0].timestamp), 'h:mm a')}
                    </Caption>
                  </>
                )}
              </div>
              <div className="tm-timeline-tooltip-arrow" />
            </div>
          )}
        </div>

        {/* Zone 2: Timeline track with markers */}
        <div ref={trackRef} className="tm-timeline-track" onClick={handleTrackClick}>
          {/* Snapshot markers */}
          {clusteredMarkers.map((marker, i) => {
            const primary = marker.snapshots[0];
            const isSelected = marker.snapshots.some(s => s.timestamp === selectedTimestamp);
            const hasFailed = marker.snapshots.some(s => s.status === 'Failed');
            const hasPartial = marker.snapshots.some(s => s.status === 'Partial');

            return (
              <button
                key={`${primary.timestamp}-${i}`}
                onClick={e => {
                  e.stopPropagation();
                  onSelectSnapshot(primary.timestamp);
                }}
                onMouseEnter={() => setHoveredMarker(marker)}
                onMouseLeave={() => setHoveredMarker(null)}
                className={`
                tm-marker
                ${isSelected ? 'tm-marker--selected' : ''}
                ${hasFailed ? 'tm-marker--failed' : ''}
                ${hasPartial && !hasFailed ? 'tm-marker--partial' : ''}
                ${marker.isCluster ? 'tm-marker--cluster' : ''}
              `}
                style={{ left: `${toDisplayPosition(marker.position)}%` }}
              />
            );
          })}
        </div>

        {/* Zone 3: Month labels (below track) */}
        <div className="tm-timeline-labels">
          {monthLabels.map((label, i) => (
            <span
              key={i}
              className="tm-timeline-label"
              style={{ left: `${toDisplayPosition(label.position)}%` }}
            >
              {label.label}
            </span>
          ))}
          {/* Now marker - just a label like months */}
          <span
            className="tm-timeline-label tm-timeline-label--now"
            style={{ left: `${toDisplayPosition(100)}%` }}
          >
            Now
          </span>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - return true if props are equal (skip re-render)
    return (
      prevProps.snapshots.length === nextProps.snapshots.length &&
      prevProps.selectedTimestamp === nextProps.selectedTimestamp &&
      prevProps.timeRange.start === nextProps.timeRange.start &&
      prevProps.timeRange.end === nextProps.timeRange.end &&
      prevProps.loading === nextProps.loading &&
      prevProps.onSelectSnapshot === nextProps.onSelectSnapshot
    );
  }
);

export default TimelineRuler;
