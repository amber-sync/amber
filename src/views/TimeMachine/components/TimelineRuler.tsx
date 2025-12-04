/**
 * TimelineRuler - THE primary navigation component
 *
 * A horizontal timeline showing all snapshots as markers.
 * The central axis for navigating through backup history.
 */

import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { format, startOfMonth, addMonths, differenceInMonths } from 'date-fns';
import { TimeMachineSnapshot } from '../TimeMachine';

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

export function TimelineRuler({
  snapshots,
  selectedTimestamp,
  timeRange,
  onSelectSnapshot,
  loading = false,
}: TimelineRulerProps) {
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

  // Generate month labels
  const monthLabels = useMemo(() => {
    const labels: { position: number; label: string }[] = [];
    const startDate = new Date(timeRange.start);
    const endDate = new Date(timeRange.end);
    const months = differenceInMonths(endDate, startDate);

    const current = startOfMonth(startDate);
    const maxLabels = Math.min(12, months + 1);
    const step = Math.max(1, Math.floor(months / maxLabels));

    for (let i = 0; i <= months; i += step) {
      const date = addMonths(startOfMonth(startDate), i);
      const pos = getPosition(date.getTime());
      if (pos >= 0 && pos <= 95) {
        labels.push({
          position: pos,
          label: format(date, 'MMM yyyy'),
        });
      }
    }

    return labels;
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
            style={{ left: `${activeMarker.position}%` }}
          >
            <div className="tm-timeline-tooltip-content">
              {activeMarker.isCluster ? (
                <>
                  <div className="text-sm font-semibold text-[var(--tm-text-bright)]">
                    {activeMarker.snapshots.length} snapshots
                  </div>
                  <div className="text-xs text-[var(--tm-text-dim)] mt-0.5">
                    {format(new Date(activeMarker.snapshots[0].timestamp), 'MMM d')} –{' '}
                    {format(
                      new Date(activeMarker.snapshots[activeMarker.snapshots.length - 1].timestamp),
                      'MMM d, yyyy'
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-[var(--tm-text-bright)]">
                    {format(new Date(activeMarker.snapshots[0].timestamp), 'MMM d, yyyy')}
                  </div>
                  <div className="text-xs text-[var(--tm-text-dim)] mt-0.5">
                    {format(new Date(activeMarker.snapshots[0].timestamp), 'h:mm a')}
                  </div>
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
              `}
              style={{
                left: `${marker.position}%`,
                width: marker.isCluster ? 16 : 12,
                height: marker.isCluster ? 16 : 12,
              }}
            >
              {/* Cluster count badge */}
              {marker.isCluster && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-full text-[8px] font-bold text-[var(--tm-text-bright)] flex items-center justify-center">
                  {marker.snapshots.length > 9 ? '9+' : marker.snapshots.length}
                </span>
              )}
            </button>
          );
        })}

        {/* NOW indicator */}
        <div className="tm-now-indicator">
          <div className="tm-now-dot" />
          <span className="tm-now-label">Now</span>
        </div>
      </div>

      {/* Zone 3: Month labels (below track) */}
      <div className="tm-timeline-labels">
        {monthLabels.map((label, i) => (
          <span key={i} className="tm-timeline-label" style={{ left: `${label.position}%` }}>
            {label.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default TimelineRuler;
