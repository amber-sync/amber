import React, { useEffect, useRef } from 'react';

interface TerminalProps {
  logs: string[];
  isRunning: boolean;
}

export const Terminal: React.FC<TerminalProps> = ({ logs, isRunning }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-white dark:bg-[#1e1e1e] rounded-lg p-4 font-mono text-xs text-gray-800 dark:text-green-400 h-64 overflow-hidden flex flex-col shadow-inner border border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="text-gray-400 dark:text-gray-500 ml-2">sync_process — -zsh</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600" ref={scrollRef}>
        {logs.map((log, i) => (
          <div key={i} className="break-all whitespace-pre-wrap">
            <span className="text-gray-400 dark:text-gray-500 mr-2 select-none">[{new Date().toLocaleTimeString()}]</span>
            {log}
          </div>
        ))}
        {isRunning && (
          <div className="animate-pulse dark:text-green-400 text-gray-800">_</div>
        )}
      </div>
    </div>
  );
};
