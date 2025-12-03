import React, { useRef, useCallback, useMemo, useState, useEffect, memo } from 'react';
import {
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  addDays,
  addWeeks,
  addMonths,
  addYears,
} from 'date-fns';
import { Icons } from '../IconComponents';
import { TimelineSnapshot, ZoomLevel } from '../../hooks/useTimeline';

interface TimelineStripProps {
  snapshots: TimelineSnapshot[];
  selectedTimestamp: number | null;
  timeRange: { start: number; end: number };
  zoomLevel: ZoomLevel;
  onSelectSnapshot: (snapshot: TimelineSnapshot | null) => void;
  onZoomChange: (level: ZoomLevel) => void;
}

interface DateLabel {
  position: number;
  label: string;
  isMinor: boolean;
}

interface ClusteredMarker {
  position: number;
  snapshots: TimelineSnapshot[];
  isCluster: boolean;
}

const ZOOM_LEVELS: ZoomLevel[] = ['day', 'week', 'month', 'year'];
const CLUSTER_THRESHOLD_PX = 20; // Minimum pixels between markers before clustering
const MAX_VISIBLE_MARKERS = 100; // Max markers to render (for extreme cases)

// Memoized marker component for performance
const TimelineMarker = memo<{
  marker: ClusteredMarker;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (snapshot: TimelineSnapshot) => void;
  onHover: (snapshot: TimelineSnapshot | null) => void;
}>(({ marker, isSelected, isHovered, onSelect, onHover }) => {
  const primarySnapshot = marker.snapshots[0];
  const hasFailures = marker.snapshots.some(s => s.status === 'Failed');
  const hasPartials = marker.snapshots.some(s => s.status === 'Partial');

  const getMarkerColor = () => {
    if (hasFailures) return 'bg-red-500';
    if (hasPartials) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const markerSize = marker.isCluster ? Math.min(24, 16 + marker.snapshots.length * 2) : 16;

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 transform -translate-x-1/2 z-10"
      style={{ left: `${marker.position}%` }}
    >
      {/* Tooltip */}
      {(isHovered || isSelected) && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none z-20 animate-fade-in">
          <div className="bg-layer-1 border border-border-base rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
            {marker.isCluster ? (
              <>
                <div className="text-xs font-medium text-text-primary">
                  {marker.snapshots.length} snapshots
                </div>
                <div className="text-[10px] text-text-secondary">
                  {format(new Date(marker.snapshots[0].timestamp || 0), 'MMM d')} -{' '}
                  {format(
                    new Date(marker.snapshots[marker.snapshots.length - 1].timestamp || 0),
                    'MMM d, yyyy'
                  )}
                </div>
                <div className="text-[10px] text-text-tertiary mt-0.5">Click to select first</div>
              </>
            ) : (
              <>
                <div className="text-xs font-medium text-text-primary">
                  {primarySnapshot.jobName}
                </div>
                <div className="text-[10px] text-text-secondary">
                  {primarySnapshot.timestamp
                    ? format(new Date(primarySnapshot.timestamp), 'MMM d, yyyy h:mm a')
                    : 'Unknown date'}
                </div>
                {primarySnapshot.sizeBytes && (
                  <div className="text-[10px] text-text-tertiary mt-0.5">
                    {(primarySnapshot.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  </div>
                )}
              </>
            )}
          </div>
          <div className="w-2 h-2 bg-layer-1 border-b border-r border-border-base transform rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
        </div>
      )}

      {/* Marker */}
      <button
        onClick={e => {
          e.stopPropagation();
          onSelect(primarySnapshot);
        }}
        onMouseEnter={() => onHover(primarySnapshot)}
        onMouseLeave={() => onHover(null)}
        className={`
          relative rounded-full transition-all duration-200
          ${getMarkerColor()}
          ${isSelected ? 'ring-4 ring-accent-primary/30 scale-125' : ''}
          ${isHovered && !isSelected ? 'scale-110' : ''}
          hover:scale-125
          focus:outline-none focus:ring-4 focus:ring-accent-primary/30
        `}
        style={{ width: markerSize, height: markerSize }}
      >
        {/* Cluster count badge */}
        {marker.isCluster && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-layer-1 border border-border-base rounded-full text-[8px] font-bold text-text-primary flex items-center justify-center">
            {marker.snapshots.length > 9 ? '9+' : marker.snapshots.length}
          </span>
        )}
        {/* Inner dot for selected state */}
        {isSelected && <span className="absolute inset-1 rounded-full bg-white/50" />}
      </button>
    </div>
  );
});

TimelineMarker.displayName = 'TimelineMarker';

export const TimelineStrip: React.FC<TimelineStripProps> = ({
  snapshots,
  selectedTimestamp,
  timeRange,
  zoomLevel,
  onSelectSnapshot,
  onZoomChange,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoveredSnapshot, setHoveredSnapshot] = useState<TimelineSnapshot | null>(null);

  // Calculate position for a timestamp (0-100%)
  const getPosition = useCallback(
    (timestamp: number): number => {
      const range = timeRange.end - timeRange.start;
      if (range <= 0) return 0;
      return ((timestamp - timeRange.start) / range) * 100;
    },
    [timeRange]
  );

  // Get timestamp from position
  const getTimestampFromPosition = useCallback(
    (position: number): number => {
      const range = timeRange.end - timeRange.start;
      return timeRange.start + (position / 100) * range;
    },
    [timeRange]
  );

  // Cluster nearby markers for performance
  const clusteredMarkers = useMemo((): ClusteredMarker[] => {
    if (snapshots.length === 0) return [];

    // Sort by timestamp
    const sorted = [...snapshots].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // Calculate positions
    const withPositions = sorted.map(s => ({
      snapshot: s,
      position: getPosition(s.timestamp || 0),
    }));

    // Cluster markers that are too close together
    const clusters: ClusteredMarker[] = [];
    let currentCluster: TimelineSnapshot[] = [];
    let clusterStartPosition = 0;

    for (let i = 0; i < withPositions.length; i++) {
      const { snapshot, position } = withPositions[i];

      if (currentCluster.length === 0) {
        currentCluster.push(snapshot);
        clusterStartPosition = position;
      } else {
        // Check if this marker is close to the cluster
        const distancePercent = position - clusterStartPosition;
        // Assume track width ~800px, so 1% ≈ 8px
        const distancePx = distancePercent * 8;

        if (distancePx < CLUSTER_THRESHOLD_PX) {
          currentCluster.push(snapshot);
        } else {
          // Finish current cluster
          const avgPosition =
            currentCluster.reduce((acc, s) => acc + getPosition(s.timestamp || 0), 0) /
            currentCluster.length;

          clusters.push({
            position: avgPosition,
            snapshots: currentCluster,
            isCluster: currentCluster.length > 1,
          });

          // Start new cluster
          currentCluster = [snapshot];
          clusterStartPosition = position;
        }
      }
    }

    // Don't forget the last cluster
    if (currentCluster.length > 0) {
      const avgPosition =
        currentCluster.reduce((acc, s) => acc + getPosition(s.timestamp || 0), 0) /
        currentCluster.length;

      clusters.push({
        position: avgPosition,
        snapshots: currentCluster,
        isCluster: currentCluster.length > 1,
      });
    }

    // Limit to max visible markers
    if (clusters.length > MAX_VISIBLE_MARKERS) {
      // Sample evenly across the timeline
      const step = clusters.length / MAX_VISIBLE_MARKERS;
      const sampled: ClusteredMarker[] = [];
      for (let i = 0; i < MAX_VISIBLE_MARKERS; i++) {
        const index = Math.floor(i * step);
        sampled.push(clusters[index]);
      }
      return sampled;
    }

    return clusters;
  }, [snapshots, getPosition]);

  // Generate date labels based on zoom level - memoized
  const dateLabels = useMemo((): DateLabel[] => {
    const labels: DateLabel[] = [];
    const startDate = new Date(timeRange.start);
    const endDate = new Date(timeRange.end);

    let current: Date;
    let addFn: (date: Date, amount: number) => Date;
    let formatStr: string;

    switch (zoomLevel) {
      case 'day':
        current = startOfDay(startDate);
        addFn = addDays;
        formatStr = 'MMM d';
        break;
      case 'week':
        current = startOfWeek(startDate);
        addFn = addWeeks;
        formatStr = 'MMM d';
        break;
      case 'month':
        current = startOfMonth(startDate);
        addFn = addMonths;
        formatStr = 'MMM yyyy';
        break;
      case 'year':
        current = startOfYear(startDate);
        addFn = addYears;
        formatStr = 'yyyy';
        break;
    }

    // Generate major labels (limit to prevent too many)
    let count = 0;
    const maxLabels = 12;
    while (current <= endDate && count < maxLabels) {
      const position = getPosition(current.getTime());
      if (position >= 0 && position <= 100) {
        labels.push({
          position,
          label: format(current, formatStr),
          isMinor: false,
        });
        count++;
      }
      current = addFn(current, 1);
    }

    return labels;
  }, [timeRange, zoomLevel, getPosition]);

  // Handle click on track
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const position = (x / rect.width) * 100;
      const timestamp = getTimestampFromPosition(position);

      // Find closest snapshot
      let closestSnapshot: TimelineSnapshot | null = null;
      let closestDiff = Infinity;

      for (const snapshot of snapshots) {
        const diff = Math.abs((snapshot.timestamp || 0) - timestamp);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestSnapshot = snapshot;
        }
      }

      // Only select if within reasonable distance (5% of total range)
      const maxDiff = (timeRange.end - timeRange.start) * 0.05;
      if (closestSnapshot && closestDiff < maxDiff) {
        onSelectSnapshot(closestSnapshot);
      }
    },
    [snapshots, timeRange, getTimestampFromPosition, onSelectSnapshot]
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();

        const currentIndex = selectedTimestamp
          ? snapshots.findIndex(s => s.timestamp === selectedTimestamp)
          : -1;

        let newIndex = currentIndex;

        switch (e.key) {
          case 'ArrowLeft':
            newIndex = Math.max(0, currentIndex - 1);
            break;
          case 'ArrowRight':
            newIndex = Math.min(snapshots.length - 1, currentIndex + 1);
            break;
          case 'Home':
            newIndex = 0;
            break;
          case 'End':
            newIndex = snapshots.length - 1;
            break;
        }

        if (newIndex >= 0 && newIndex < snapshots.length) {
          onSelectSnapshot(snapshots[newIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [snapshots, selectedTimestamp, onSelectSnapshot]);

  // Check if a snapshot is selected (memoized check)
  const isSnapshotSelected = useCallback(
    (snapshot: TimelineSnapshot) => snapshot.timestamp === selectedTimestamp,
    [selectedTimestamp]
  );

  const isSnapshotHovered = useCallback(
    (snapshot: TimelineSnapshot) => hoveredSnapshot?.id === snapshot.id,
    [hoveredSnapshot]
  );

  // Find if selected snapshot is in any cluster
  const selectedMarkerPosition = useMemo(() => {
    if (!selectedTimestamp) return null;
    for (const marker of clusteredMarkers) {
      if (marker.snapshots.some(s => s.timestamp === selectedTimestamp)) {
        return marker.position;
      }
    }
    return null;
  }, [clusteredMarkers, selectedTimestamp]);

  return (
    <div className="bg-layer-1 rounded-2xl border border-border-base overflow-hidden">
      {/* Header with zoom controls */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-base">
        <div className="flex items-center gap-2">
          <Icons.History size={16} className="text-accent-primary" />
          <span className="text-sm font-semibold text-text-primary">Timeline</span>
          <span className="text-xs text-text-tertiary">
            {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
            {clusteredMarkers.length < snapshots.length && (
              <span className="ml-1 text-text-quaternary">({clusteredMarkers.length} visible)</span>
            )}
          </span>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-layer-2 rounded-lg p-0.5">
          {ZOOM_LEVELS.map(level => (
            <button
              key={level}
              onClick={() => onZoomChange(level)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                zoomLevel === level
                  ? 'bg-layer-1 text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline track */}
      <div className="px-5 py-6">
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative h-14 cursor-pointer group"
          tabIndex={0}
          role="slider"
          aria-label="Timeline navigation"
          aria-valuemin={timeRange.start}
          aria-valuemax={timeRange.end}
          aria-valuenow={selectedTimestamp || undefined}
        >
          {/* Track background with gradient */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-layer-3 via-layer-2 to-layer-3 rounded-full" />

          {/* Active track fill */}
          {selectedMarkerPosition !== null && (
            <div
              className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${selectedMarkerPosition}%` }}
            />
          )}

          {/* Date labels */}
          {dateLabels.map((label, index) => (
            <div
              key={index}
              className="absolute bottom-0 transform -translate-x-1/2"
              style={{ left: `${label.position}%` }}
            >
              <div className="w-px h-2 bg-border-base mb-1" />
              <span
                className={`text-[10px] whitespace-nowrap ${
                  label.isMinor ? 'text-text-tertiary' : 'text-text-secondary'
                }`}
              >
                {label.label}
              </span>
            </div>
          ))}

          {/* Clustered markers */}
          {clusteredMarkers.map((marker, index) => {
            const primarySnapshot = marker.snapshots[0];
            const isSelected = marker.snapshots.some(s => isSnapshotSelected(s));
            const isHovered = marker.snapshots.some(s => isSnapshotHovered(s));
            const isLatest = index === clusteredMarkers.length - 1;

            return (
              <React.Fragment key={primarySnapshot.id || index}>
                <TimelineMarker
                  marker={marker}
                  isSelected={isSelected}
                  isHovered={isHovered}
                  onSelect={onSelectSnapshot}
                  onHover={setHoveredSnapshot}
                />
                {/* Pulse animation for latest */}
                {isLatest && !isSelected && !marker.isCluster && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 transform -translate-x-1/2 z-0"
                    style={{ left: `${marker.position}%` }}
                  >
                    <span className="absolute w-4 h-4 rounded-full bg-green-500 animate-ping opacity-50" />
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* Now indicator */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <div className="w-0.5 h-6 bg-accent-primary rounded-full" />
            <span className="text-[10px] font-medium text-accent-primary uppercase tracking-wider">
              Now
            </span>
          </div>
        </div>
      </div>

      {/* Navigation hint */}
      <div className="px-5 pb-3 flex items-center justify-center gap-4 text-[10px] text-text-tertiary">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-layer-2 rounded text-text-secondary">←</kbd>
          <kbd className="px-1.5 py-0.5 bg-layer-2 rounded text-text-secondary">→</kbd>
          Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-layer-2 rounded text-text-secondary">Home</kbd>
          <kbd className="px-1.5 py-0.5 bg-layer-2 rounded text-text-secondary">End</kbd>
          Jump
        </span>
      </div>
    </div>
  );
};
