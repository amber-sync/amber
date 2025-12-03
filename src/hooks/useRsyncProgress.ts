import { useState, useEffect, useCallback, useRef } from 'react';
import { LogEntry, RsyncProgressData } from '../types';
import { api } from '../api';

const PROGRESS_UPDATE_INTERVAL_MS = 200;
const LOG_FLUSH_INTERVAL_MS = 200;
const MAX_LOG_ENTRIES = 500;

/**
 * Hook for subscribing to rsync progress events.
 * @param jobId - Optional job ID to filter events. If provided, only events
 *                for this job will be processed. If null/undefined, all events
 *                are processed (backwards compatible).
 */
export function useRsyncProgress(jobId?: string | null) {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<RsyncProgressData | null>(null);
  const logBufferRef = useRef<LogEntry[]>([]);

  useEffect(() => {
    // Log subscription - filter by jobId if provided
    const unsubLog = api.onRsyncLog(data => {
      // TIM-124: Filter events by jobId to prevent cross-job log pollution
      if (jobId && data.jobId !== jobId) return;

      logBufferRef.current.push({
        message: data.message,
        timestamp: Date.now(),
        level: data.message.includes('ERROR')
          ? 'error'
          : data.message.includes('WARNING') || data.message.includes('⚠️')
            ? 'warning'
            : 'info',
      });
    });

    // Flush logs periodically
    const logInterval = setInterval(() => {
      if (logBufferRef.current.length > 0) {
        setLogs(prev => {
          const combined = [...prev, ...logBufferRef.current];
          logBufferRef.current = [];
          return combined.length > MAX_LOG_ENTRIES ? combined.slice(-MAX_LOG_ENTRIES) : combined;
        });
      }
    }, LOG_FLUSH_INTERVAL_MS);

    // Progress subscription - filter by jobId if provided
    const unsubProgress = api.onRsyncProgress(data => {
      // TIM-124: Filter events by jobId to prevent cross-job progress pollution
      if (jobId && data.jobId !== jobId) return;

      setProgress({
        percentage: data.percentage,
        speed: data.speed,
        transferred: data.transferred,
        eta: data.eta,
        currentFile: data.currentFile,
      });
    });

    // Complete subscription - filter by jobId if provided
    const unsubComplete = api.onRsyncComplete(data => {
      // TIM-124: Filter events by jobId to prevent cross-job completion pollution
      if (jobId && data.jobId !== jobId) return;

      setIsRunning(false);
      setProgress(null);

      const message = data.success
        ? 'Sync Completed Successfully.'
        : `Sync Failed: ${data.error || 'Unknown error'}`;

      logBufferRef.current.push({
        message,
        timestamp: Date.now(),
        level: data.success ? 'info' : 'error',
      });
    });

    return () => {
      unsubLog();
      unsubProgress();
      unsubComplete();
      clearInterval(logInterval);
    };
  }, [jobId]);

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
    addLog,
  };
}
