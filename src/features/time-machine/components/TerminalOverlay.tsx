/**
 * TerminalOverlay - Full-screen log viewer for sync operations
 *
 * Shows real-time rsync output with filtering and search capabilities.
 * Uses Observatory styling with monospace terminal aesthetic.
 */

import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { LogEntry, RsyncProgressData } from '../../../types';
import { Icons } from '../../../components/IconComponents';

interface TerminalOverlayProps {
  isOpen: boolean;
  logs: LogEntry[];
  progress: RsyncProgressData | null;
  isRunning: boolean;
  onClose: () => void;
  onStop?: () => void;
}

type LogFilter = 'all' | 'info' | 'warning' | 'error';

function TerminalOverlayComponent({
  isOpen,
  logs,
  progress,
  isRunning,
  onClose,
  onStop,
}: TerminalOverlayProps) {
  const [filter, setFilter] = useState<LogFilter>('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle scroll to detect manual scrolling
  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  // Filter and search logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Apply level filter
      if (filter !== 'all' && log.level !== filter) {
        return false;
      }

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        return log.message.toLowerCase().includes(searchLower);
      }

      return true;
    });
  }, [logs, filter, search]);

  // Count logs by level
  const logCounts = useMemo(() => {
    return {
      all: logs.length,
      info: logs.filter(l => l.level === 'info').length,
      warning: logs.filter(l => l.level === 'warning').length,
      error: logs.filter(l => l.level === 'error').length,
    };
  }, [logs]);

  return (
    <div className={`tm-overlay ${isOpen ? 'tm-overlay--visible' : ''}`}>
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel - wider for terminal */}
      <div className="tm-overlay-panel" style={{ width: '800px' }}>
        {/* Header */}
        <div className="tm-overlay-header">
          <div className="flex items-center gap-3">
            <h2 className="tm-overlay-title">Sync Output</h2>
            {isRunning && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--color-accent-secondary)] rounded-full text-xs text-[var(--color-accent-primary)]">
                <span className="w-1.5 h-1.5 bg-[var(--color-accent-primary)] rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
          <button onClick={onClose} className="tm-overlay-close">
            <Icons.X size={18} />
          </button>
        </div>

        {/* Progress bar (if running) */}
        {isRunning && progress && (
          <div className="px-4 py-3 border-b border-[var(--tm-dust)] bg-[var(--tm-void)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icons.RefreshCw
                  size={14}
                  className="text-[var(--color-accent-primary)] animate-spin"
                />
                <span className="text-sm text-[var(--tm-text-bright)]">
                  {progress.percentage}% complete
                </span>
              </div>
              {progress.eta && (
                <span className="text-xs text-[var(--tm-text-dim)]">ETA {progress.eta}</span>
              )}
            </div>
            <div className="h-1.5 bg-[var(--tm-dust)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent-primary)] transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            {progress.currentFile && (
              <div className="mt-2 text-xs text-[var(--tm-text-dim)] font-mono truncate">
                {progress.currentFile}
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-[var(--tm-dust)] bg-[var(--tm-nebula)] flex items-center gap-3">
          {/* Filter buttons */}
          <div className="flex gap-1">
            {(['all', 'info', 'warning', 'error'] as LogFilter[]).map(level => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  filter === level
                    ? level === 'error'
                      ? 'bg-[var(--tm-error)]/20 text-[var(--tm-error)]'
                      : level === 'warning'
                        ? 'bg-[var(--tm-warning)]/20 text-[var(--tm-warning)]'
                        : 'bg-[var(--color-accent-secondary)] text-[var(--color-accent-primary)]'
                    : 'text-[var(--tm-text-dim)] hover:text-[var(--tm-text-soft)]'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
                <span className="ml-1 opacity-60">({logCounts[level]})</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <Icons.Search
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--tm-text-muted)]"
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full pl-7 pr-3 py-1.5 bg-[var(--tm-void)] border border-[var(--tm-dust)] rounded text-xs text-[var(--tm-text-bright)] placeholder:text-[var(--tm-text-muted)] focus:outline-none focus:border-[var(--color-accent-primary)]"
            />
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded transition-colors ${
              autoScroll
                ? 'bg-[var(--color-accent-secondary)] text-[var(--color-accent-primary)]'
                : 'text-[var(--tm-text-dim)] hover:text-[var(--tm-text-soft)]'
            }`}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
          >
            <Icons.ArrowDown size={14} />
          </button>
        </div>

        {/* Log content */}
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto p-4 bg-[var(--tm-void)] font-mono text-xs"
          style={{ maxHeight: 'calc(100vh - 280px)' }}
        >
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--tm-text-dim)]">
              <Icons.Terminal size={32} className="mb-3 opacity-50" />
              <p>{logs.length === 0 ? 'No logs yet' : 'No matching logs'}</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredLogs.map((log, i) => (
                <LogLine key={i} log={log} />
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-4 py-3 border-t border-[var(--tm-dust)] bg-[var(--tm-nebula)] flex items-center justify-between">
          <span className="text-xs text-[var(--tm-text-dim)]">
            {filteredLogs.length} of {logs.length} entries
          </span>
          <div className="flex gap-2">
            {isRunning && onStop && (
              <button
                onClick={onStop}
                className="px-3 py-1.5 bg-[var(--tm-error)]/20 text-[var(--tm-error)] text-sm rounded-lg hover:bg-[var(--tm-error)]/30 transition-colors"
              >
                Stop Sync
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-[var(--tm-dust)] text-[var(--tm-text-soft)] text-sm rounded-lg hover:bg-[var(--tm-mist)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Individual log line
function LogLine({ log }: { log: LogEntry }) {
  const timestamp = new Date(log.timestamp).toLocaleTimeString();

  const levelColor =
    log.level === 'error'
      ? 'text-[var(--tm-error)]'
      : log.level === 'warning'
        ? 'text-[var(--tm-warning)]'
        : 'text-[var(--tm-text-dim)]';

  const levelIcon =
    log.level === 'error' ? (
      <Icons.AlertCircle size={12} />
    ) : log.level === 'warning' ? (
      <Icons.AlertTriangle size={12} />
    ) : (
      <Icons.Info size={12} />
    );

  return (
    <div className="flex items-start gap-2 py-0.5 hover:bg-[var(--tm-nebula)] rounded px-1 -mx-1">
      <span className="text-[var(--tm-text-muted)] shrink-0">{timestamp}</span>
      <span className={`shrink-0 ${levelColor}`}>{levelIcon}</span>
      <span className="text-[var(--tm-text-soft)] break-all">{log.message}</span>
    </div>
  );
}

export const TerminalOverlay = memo(TerminalOverlayComponent);
TerminalOverlay.displayName = 'TerminalOverlay';

export default TerminalOverlay;
