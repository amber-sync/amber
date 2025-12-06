import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Caption } from './ui';

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
        className={`h-full overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-text-tertiary font-mono text-xs p-4 ${className}`}
        ref={scrollRef}
      >
        {logs.map((log, i) => (
          <div key={i} className="break-all whitespace-pre-wrap">
            <Caption
              as="span"
              size="sm"
              className={`mr-2 select-none ${
                log.level === 'error'
                  ? 'text-[var(--color-error)]'
                  : log.level === 'warning'
                    ? 'text-[var(--color-warning)]'
                    : 'text-text-tertiary'
              }`}
            >
              [{new Date(log.timestamp).toLocaleTimeString()}]
            </Caption>
            <Caption
              as="span"
              size="sm"
              className={
                log.level === 'error'
                  ? 'text-[var(--color-error)]'
                  : log.level === 'warning'
                    ? 'text-[var(--color-warning)]'
                    : 'text-text-secondary'
              }
            >
              {log.message}
            </Caption>
          </div>
        ))}
        {isRunning && <div className="animate-pulse text-[var(--color-success)]">_</div>}
      </div>
    );
  }

  return (
    <div
      className={`bg-layer-1 rounded-lg p-4 font-mono text-xs text-text-primary h-64 overflow-hidden flex flex-col shadow-inner border border-border-base transition-colors duration-300 ${className}`}
    >
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border-base">
        <div className="w-3 h-3 rounded-full bg-[var(--color-error)]" />
        <div className="w-3 h-3 rounded-full bg-[var(--color-warning)]" />
        <div className="w-3 h-3 rounded-full bg-[var(--color-success)]" />
        <Caption color="tertiary" className="ml-2">
          sync_process — -zsh
        </Caption>
      </div>
      <div
        className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-text-tertiary"
        ref={scrollRef}
      >
        {logs.map((log, i) => (
          <div key={i} className="break-all whitespace-pre-wrap">
            <Caption
              as="span"
              size="sm"
              className={`mr-2 select-none ${
                log.level === 'error'
                  ? 'text-[var(--color-error)]'
                  : log.level === 'warning'
                    ? 'text-[var(--color-warning)]'
                    : 'text-text-tertiary'
              }`}
            >
              [{new Date(log.timestamp).toLocaleTimeString()}]
            </Caption>
            <Caption
              as="span"
              size="sm"
              className={
                log.level === 'error'
                  ? 'text-[var(--color-error)]'
                  : log.level === 'warning'
                    ? 'text-[var(--color-warning)]'
                    : ''
              }
            >
              {log.message}
            </Caption>
          </div>
        ))}
        {isRunning && <div className="animate-pulse text-[var(--color-success)]">_</div>}
      </div>
    </div>
  );
};
