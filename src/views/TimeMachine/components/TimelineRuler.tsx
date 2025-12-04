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

  // Selection position
  const selectionPosition = selectedTimestamp !== null ? getPosition(selectedTimestamp) : null;

  // Loading state
  if (loading) {
    return (
      <div className="tm-timeline">
        <div className="tm-timeline-track animate-pulse">
          <div className="absolute inset-x-0 top-1/2 h-1 bg-[var(--tm-dust)] rounded-full -translate-y-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="tm-timeline">
      {/* Timeline track */}
      <div ref={trackRef} className="tm-timeline-track" onClick={handleTrackClick}>
        {/* Month labels */}
        {monthLabels.map((label, i) => (
          <div key={i} className="tm-timeline-label" style={{ left: `${label.position}%` }}>
            {label.label}
          </div>
        ))}

        {/* Snapshot markers */}
        {clusteredMarkers.map((marker, i) => {
          const primary = marker.snapshots[0];
          const isSelected = marker.snapshots.some(s => s.timestamp === selectedTimestamp);
          const isHovered = hoveredMarker === marker;
          const hasFailed = marker.snapshots.some(s => s.status === 'Failed');
          const hasPartial = marker.snapshots.some(s => s.status === 'Partial');

          return (
            <div
              key={`${primary.timestamp}-${i}`}
              className="absolute"
              style={{ left: `${marker.position}%`, top: '50%' }}
            >
              {/* Marker */}
              <button
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

              {/* Tooltip */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-20 pointer-events-none tm-animate-fade-in">
                  <div className="bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg shadow-xl px-3 py-2 whitespace-nowrap">
                    {marker.isCluster ? (
                      <>
                        <div className="text-xs font-medium text-[var(--tm-text-bright)]">
                          {marker.snapshots.length} snapshots
                        </div>
                        <div className="text-[10px] text-[var(--tm-text-dim)]">
                          {format(new Date(marker.snapshots[0].timestamp), 'MMM d')} –{' '}
                          {format(
                            new Date(marker.snapshots[marker.snapshots.length - 1].timestamp),
                            'MMM d, yyyy'
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs font-medium text-[var(--tm-text-bright)]">
                          {format(new Date(primary.timestamp), 'MMM d, yyyy')}
                        </div>
                        <div className="text-[10px] text-[var(--tm-text-dim)]">
                          {format(new Date(primary.timestamp), 'h:mm a')}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="w-2 h-2 bg-[var(--tm-nebula)] border-b border-r border-[var(--tm-dust)] rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
                </div>
              )}
            </div>
          );
        })}

        {/* NOW indicator */}
        <div className="tm-now-indicator">
          <div className="tm-now-dot" />
          <span className="tm-now-label">Now</span>
        </div>
      </div>
    </div>
  );
}

export default TimelineRuler;
