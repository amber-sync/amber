import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface TerminalProps {
  logs: LogEntry[];
  isRunning: boolean;
  variant?: 'default' | 'embedded';
  className?: string;
}

export const Terminal: React.FC<TerminalProps> = ({
  logs,
  isRunning,
  variant = 'default',
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (variant === 'embedded') {
    return (
      <div
        className={`h-full overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-600 font-mono text-xs p-4 ${className}`}
        ref={scrollRef}
      >
        {logs.map((log, i) => (
          <div key={i} className="break-all whitespace-pre-wrap">
            <span
              className={`mr-2 select-none ${
                log.level === 'error'
                  ? 'text-red-400'
                  : log.level === 'warning'
                    ? 'text-yellow-400'
                    : 'text-gray-500'
              }`}
            >
              [{new Date(log.timestamp).toLocaleTimeString()}]
            </span>
            <span
              className={
                log.level === 'error'
                  ? 'text-red-400'
                  : log.level === 'warning'
                    ? 'text-yellow-400'
                    : 'text-gray-300'
              }
            >
              {log.message}
            </span>
          </div>
        ))}
        {isRunning && <div className="animate-pulse text-green-400">_</div>}
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-[#1e1e1e] rounded-lg p-4 font-mono text-xs text-gray-800 dark:text-green-400 h-64 overflow-hidden flex flex-col shadow-inner border border-gray-200 dark:border-gray-700 transition-colors duration-300 ${className}`}
    >
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="text-gray-400 dark:text-gray-500 ml-2">sync_process — -zsh</span>
      </div>
      <div
        className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
        ref={scrollRef}
      >
        {logs.map((log, i) => (
          <div key={i} className="break-all whitespace-pre-wrap">
            <span
              className={`mr-2 select-none ${
                log.level === 'error'
                  ? 'text-red-500 dark:text-red-400'
                  : log.level === 'warning'
                    ? 'text-yellow-500 dark:text-yellow-400'
                    : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              [{new Date(log.timestamp).toLocaleTimeString()}]
            </span>
            <span
              className={
                log.level === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : log.level === 'warning'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : ''
              }
            >
              {log.message}
            </span>
          </div>
        ))}
        {isRunning && <div className="animate-pulse dark:text-green-400 text-gray-800">_</div>}
      </div>
    </div>
  );
};
