/**
 * LiveActivityBar - Fixed bottom bar showing sync progress
 *
 * Appears during active sync operations, showing:
 * - Progress bar
 * - Current file being synced
 * - ETA
 * - Expand button to view full logs
 */

import { memo } from 'react';
import { LogEntry, RsyncProgressData } from '../../../types';
import { Icons } from '../../../components/IconComponents';

interface LiveActivityBarProps {
  isRunning: boolean;
  progress: RsyncProgressData | null;
  logs: LogEntry[];
  onExpand: () => void;
}

function LiveActivityBarComponent({ isRunning, progress, logs, onExpand }: LiveActivityBarProps) {
  // Only show when running
  if (!isRunning) {
    return null;
  }

  const percentage = progress?.percentage ?? 0;
  const currentFile = progress?.currentFile ?? 'Preparing...';
  const eta = progress?.eta ?? null;

  return (
    <div className={`tm-live-bar ${isRunning ? 'tm-live-bar--visible' : ''}`}>
      {/* Progress bar at top */}
      <div className="tm-live-progress" style={{ width: `${percentage}%` }} />

      {/* Spinning indicator */}
      <div className="tm-live-indicator">
        <Icons.RefreshCw size={18} />
      </div>

      {/* Status info */}
      <div className="tm-live-info">
        <div className="tm-live-status">
          {percentage > 0 ? `Syncing... ${percentage}%` : 'Starting sync...'}
        </div>
        <div className="tm-live-file tm-font-mono">{currentFile}</div>
      </div>

      {/* ETA */}
      {eta && <div className="tm-live-eta">ETA {eta}</div>}

      {/* Expand button */}
      <button onClick={onExpand} className="tm-live-expand" title="View logs">
        <Icons.Terminal size={16} />
      </button>
    </div>
  );
}

export const LiveActivityBar = memo(LiveActivityBarComponent);
LiveActivityBar.displayName = 'LiveActivityBar';

export default LiveActivityBar;
