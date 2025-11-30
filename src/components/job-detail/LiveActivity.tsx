import React, { useEffect, useState } from 'react';
import { Icons } from '../IconComponents';
import { Terminal } from '../Terminal';
import { LogEntry, RsyncProgressData } from '../../types';

interface LiveActivityProps {
  isRunning: boolean;
  progress: RsyncProgressData | null;
  logs: LogEntry[];
  isTerminalExpanded: boolean;
  onExpand: () => void;
}

export const LiveActivity: React.FC<LiveActivityProps> = ({
  isRunning,
  progress,
  logs,
  isTerminalExpanded,
  onExpand,
}) => {
  const [showLogs, setShowLogs] = useState(false);

  // Auto-expand logs when running starts
  useEffect(() => {
    if (isRunning && !showLogs) {
      setShowLogs(true);
    }
  }, [isRunning, showLogs]);

  return (
    <div className={`flex flex-col ${isTerminalExpanded ? 'h-full' : ''}`}>
      {/* Minimal Header */}
      <div className="flex items-center justify-between mb-3">
        <h3
          className={`text-base font-bold text-text-primary flex items-center gap-2 ${isTerminalExpanded ? 'text-white' : ''}`}
        >
          <Icons.Activity size={18} className="text-indigo-500" /> Activity
          {isRunning && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          )}
        </h3>
        {!isTerminalExpanded && (
          <button
            onClick={onExpand}
            className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            title="Fullscreen"
          >
            <Icons.Maximize2 size={14} />
          </button>
        )}
      </div>

      {/* Compact Activity Card */}
      <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm overflow-hidden transition-all duration-300">
        {/* Status Bar - Always Visible */}
        <div className="px-4 py-3 flex items-center gap-3">
          {isRunning ? (
            <>
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Icons.RefreshCw
                    size={16}
                    className="text-indigo-600 dark:text-indigo-400 animate-spin"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-text-primary">
                    {progress?.percentage && progress.percentage > 0
                      ? `Syncing... ${progress.percentage}%`
                      : 'Starting sync...'}
                  </span>
                  {progress?.eta && (
                    <span className="text-xs text-text-secondary">ETA {progress.eta}</span>
                  )}
                </div>
                <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  {progress?.percentage && progress.percentage > 0 ? (
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out rounded-full"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  ) : (
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 w-1/3 animate-progress-pulse rounded-full" />
                  )}
                </div>
                {progress?.currentFile && (
                  <p className="mt-1 text-xs text-text-secondary truncate">
                    {progress.currentFile}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-layer-2 flex items-center justify-center">
                <Icons.CheckCircle size={16} className="text-gray-400 dark:text-gray-500" />
              </div>
              <div className="flex-1">
                <span className="text-sm text-text-secondary">
                  {logs.length > 0 ? 'Last sync completed' : 'Ready to sync'}
                </span>
              </div>
            </>
          )}

          {/* Toggle Logs Button */}
          <button
            onClick={() => setShowLogs(!showLogs)}
            className={`p-2 rounded-lg transition-all ${
              showLogs
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={showLogs ? 'Hide logs' : 'Show logs'}
          >
            <Icons.Terminal size={16} />
          </button>
        </div>

        {/* Collapsible Logs Section */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            showLogs ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="border-t border-gray-200/50 dark:border-gray-700/50">
            <div className={isTerminalExpanded ? 'flex-1' : 'h-64'}>
              <Terminal logs={logs} isRunning={isRunning} variant="embedded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
