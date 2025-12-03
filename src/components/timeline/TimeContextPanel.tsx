import React, { useEffect, useState, useRef } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Icons } from '../IconComponents';
import { TimelineSnapshot } from '../../hooks/useTimeline';
import { formatBytes } from '../../utils/formatters';

interface TimeContextPanelProps {
  selectedSnapshot: TimelineSnapshot | null;
  onBrowseSnapshot?: (snapshot: TimelineSnapshot) => void;
}

// Animated number component for smooth stat transitions
const AnimatedNumber: React.FC<{ value: number; format?: (n: number) => string }> = ({
  value,
  format: formatFn = n => n.toLocaleString(),
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;

    const startValue = prevValue.current;
    const endValue = value;
    const duration = 300;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
    prevValue.current = value;
  }, [value]);

  return <>{formatFn(displayValue)}</>;
};

export const TimeContextPanel: React.FC<TimeContextPanelProps> = ({
  selectedSnapshot,
  onBrowseSnapshot,
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevSnapshotId = useRef<string | null>(null);

  // Detect snapshot changes for transition animation
  useEffect(() => {
    const currentId = selectedSnapshot?.id || null;
    if (currentId !== prevSnapshotId.current && currentId !== null) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 50);
      prevSnapshotId.current = currentId;
      return () => clearTimeout(timer);
    }
    prevSnapshotId.current = currentId;
  }, [selectedSnapshot?.id]);

  if (!selectedSnapshot) {
    return (
      <div className="bg-layer-1 rounded-2xl border border-border-base h-full flex flex-col">
        <div className="px-5 py-4 border-b border-border-base">
          <div className="flex items-center gap-2">
            <Icons.Calendar size={16} className="text-text-tertiary" />
            <span className="text-sm font-semibold text-text-primary">Snapshot Details</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-layer-2 flex items-center justify-center mb-4 animate-pulse-subtle">
            <Icons.Clock size={28} className="text-text-tertiary" />
          </div>
          <h3 className="text-sm font-medium text-text-primary mb-1">No snapshot selected</h3>
          <p className="text-xs text-text-tertiary max-w-[200px]">
            Click on a marker in the timeline to view snapshot details
          </p>
        </div>
      </div>
    );
  }

  const timestamp = selectedSnapshot.timestamp || 0;
  const date = new Date(timestamp);
  const relativeTime = formatDistanceToNow(date, { addSuffix: true });

  // Determine status styling
  const getStatusStyle = () => {
    switch (selectedSnapshot.status) {
      case 'Failed':
        return {
          bg: 'bg-red-100 dark:bg-red-900/30',
          text: 'text-red-600 dark:text-red-400',
          icon: Icons.XCircle,
        };
      case 'Partial':
        return {
          bg: 'bg-amber-100 dark:bg-amber-900/30',
          text: 'text-amber-600 dark:text-amber-400',
          icon: Icons.AlertTriangle,
        };
      default:
        return {
          bg: 'bg-green-100 dark:bg-green-900/30',
          text: 'text-green-600 dark:text-green-400',
          icon: Icons.CheckCircle,
        };
    }
  };

  const statusStyle = getStatusStyle();
  const StatusIcon = statusStyle.icon;

  return (
    <div className="bg-layer-1 rounded-2xl border border-border-base h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-base">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.Calendar size={16} className="text-accent-primary" />
            <span className="text-sm font-semibold text-text-primary">Snapshot Details</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-300 ${statusStyle.bg}`}
          >
            <StatusIcon
              size={12}
              className={`${statusStyle.text} transition-colors duration-300`}
            />
            <span
              className={`text-xs font-medium ${statusStyle.text} transition-colors duration-300`}
            >
              {selectedSnapshot.status || 'Complete'}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        key={selectedSnapshot.id}
        className={`flex-1 overflow-y-auto p-5 space-y-5 ${isTransitioning ? 'opacity-0' : 'opacity-100 animate-fade-in-up'}`}
        style={{ transition: 'opacity 0.15s ease-out' }}
      >
        {/* Date & Time */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center">
              <Icons.Clock size={16} className="text-accent-primary" />
            </div>
            <div>
              <div className="text-sm font-medium text-text-primary">
                {format(date, 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="text-xs text-text-tertiary">
                {format(date, 'h:mm:ss a')} ({relativeTime})
              </div>
            </div>
          </div>
        </div>

        {/* Job Info */}
        <div className="p-3 bg-layer-2 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Icons.Database size={14} className="text-text-tertiary" />
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Job
            </span>
          </div>
          <div className="text-sm font-medium text-text-primary">{selectedSnapshot.jobName}</div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Size */}
          <div className="p-3 bg-layer-2 rounded-xl transition-all duration-200 hover:bg-layer-3 hover:scale-[1.02]">
            <div className="flex items-center gap-2 mb-1">
              <Icons.HardDrive size={14} className="text-blue-500" />
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                Size
              </span>
            </div>
            <div className="text-lg font-bold text-text-primary tabular-nums">
              {selectedSnapshot.sizeBytes ? (
                <AnimatedNumber value={selectedSnapshot.sizeBytes} format={n => formatBytes(n)} />
              ) : (
                '--'
              )}
            </div>
          </div>

          {/* Files */}
          <div className="p-3 bg-layer-2 rounded-xl transition-all duration-200 hover:bg-layer-3 hover:scale-[1.02]">
            <div className="flex items-center gap-2 mb-1">
              <Icons.File size={14} className="text-purple-500" />
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                Files
              </span>
            </div>
            <div className="text-lg font-bold text-text-primary tabular-nums">
              {selectedSnapshot.fileCount ? (
                <AnimatedNumber value={selectedSnapshot.fileCount} />
              ) : (
                '--'
              )}
            </div>
          </div>

          {/* Changes */}
          <div className="p-3 bg-layer-2 rounded-xl transition-all duration-200 hover:bg-layer-3 hover:scale-[1.02]">
            <div className="flex items-center gap-2 mb-1">
              <Icons.RefreshCw size={14} className="text-orange-500" />
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                Changes
              </span>
            </div>
            <div className="text-lg font-bold text-text-primary tabular-nums">
              {selectedSnapshot.changesCount !== undefined ? (
                <AnimatedNumber value={selectedSnapshot.changesCount} />
              ) : (
                '--'
              )}
            </div>
          </div>

          {/* Duration */}
          <div className="p-3 bg-layer-2 rounded-xl transition-all duration-200 hover:bg-layer-3 hover:scale-[1.02]">
            <div className="flex items-center gap-2 mb-1">
              <Icons.Zap size={14} className="text-green-500" />
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                Duration
              </span>
            </div>
            <div className="text-lg font-bold text-text-primary tabular-nums">
              {selectedSnapshot.duration ? (
                <>
                  <AnimatedNumber value={Math.round(selectedSnapshot.duration / 1000)} />s
                </>
              ) : (
                '--'
              )}
            </div>
          </div>
        </div>

        {/* Path Info */}
        {selectedSnapshot.path && (
          <div className="p-3 bg-layer-2 rounded-xl transition-all duration-200 hover:bg-layer-3">
            <div className="flex items-center gap-2 mb-2">
              <Icons.Folder size={14} className="text-text-tertiary" />
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Location
              </span>
            </div>
            <div
              className="text-xs font-mono text-text-secondary truncate transition-colors duration-200"
              title={selectedSnapshot.path}
            >
              {selectedSnapshot.path}
            </div>
          </div>
        )}

        {/* Restored indicator */}
        {selectedSnapshot.restored && (
          <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 animate-scale-in">
            <Icons.RotateCcw size={14} className="text-green-600 dark:text-green-400" />
            <div>
              <div className="text-xs font-medium text-green-700 dark:text-green-300">
                Previously Restored
              </div>
              {selectedSnapshot.restoredDate && (
                <div className="text-[10px] text-green-600 dark:text-green-400">
                  {format(new Date(selectedSnapshot.restoredDate), 'MMM d, yyyy h:mm a')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      {onBrowseSnapshot && (
        <div className="p-4 border-t border-border-base animate-slide-in-up">
          <button
            onClick={() => onBrowseSnapshot(selectedSnapshot)}
            className="group w-full flex items-center justify-center gap-2 bg-accent-primary text-accent-text px-4 py-2.5 rounded-xl font-medium transition-all duration-200 hover:bg-accent-secondary hover:shadow-lg hover:shadow-accent-primary/20 active:scale-[0.98]"
          >
            <Icons.FolderOpen
              size={16}
              className="transition-transform duration-200 group-hover:scale-110"
            />
            <span>Browse Snapshot</span>
          </button>
        </div>
      )}
    </div>
  );
};
