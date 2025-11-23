import { useState, useEffect, useCallback, useRef } from 'react';
import { LogEntry, RsyncProgressData } from '../types';

const PROGRESS_UPDATE_INTERVAL_MS = 200;
const LOG_FLUSH_INTERVAL_MS = 200;
const MAX_LOG_ENTRIES = 500;

export function useRsyncProgress() {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<RsyncProgressData | null>(null);
  const logBufferRef = useRef<LogEntry[]>([]);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Log subscription
    const unsubLog = window.electronAPI.onRsyncLog((data) => {
      logBufferRef.current.push({
        message: data.message,
        timestamp: Date.now(),
        level: data.message.includes('ERROR') ? 'error' :
               data.message.includes('WARNING') || data.message.includes('⚠️') ? 'warning' : 'info'
      });
    });

    // Flush logs periodically
    const logInterval = setInterval(() => {
      if (logBufferRef.current.length > 0) {
        setLogs(prev => {
          const combined = [...prev, ...logBufferRef.current];
          logBufferRef.current = [];
          return combined.length > MAX_LOG_ENTRIES
            ? combined.slice(-MAX_LOG_ENTRIES)
            : combined;
        });
      }
    }, LOG_FLUSH_INTERVAL_MS);

    // Progress subscription
    const unsubProgress = window.electronAPI.onRsyncProgress((data) => {
      setProgress({
        percentage: data.percentage,
        speed: data.speed,
        transferred: data.transferred,
        eta: data.eta,
        currentFile: data.currentFile
      });
    });

    // Complete subscription
    const unsubComplete = window.electronAPI.onRsyncComplete((data) => {
      setIsRunning(false);
      setProgress(null);

      const message = data.success
        ? 'Sync Completed Successfully.'
        : `Sync Failed: ${data.error || 'Unknown error'}`;

      logBufferRef.current.push({
        message,
        timestamp: Date.now(),
        level: data.success ? 'info' : 'error'
      });
    });

    return () => {
      unsubLog();
      unsubProgress();
      unsubComplete();
      clearInterval(logInterval);
    };
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    logBufferRef.current = [];
  }, []);

  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info') => {
    logBufferRef.current.push({ message, timestamp: Date.now(), level });
  }, []);

  return {
    isRunning,
    setIsRunning,
    logs,
    progress,
    clearLogs,
    addLog
  };
}
