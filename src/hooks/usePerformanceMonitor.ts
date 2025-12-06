/**
 * React hook for monitoring component performance
 * @module hooks/usePerformanceMonitor
 */

import { useEffect, useRef, useCallback } from 'react';
import { PerformanceTracker } from '../utils/performance';

export interface PerformanceMonitorOptions {
  trackRenders?: boolean;
  trackLifecycle?: boolean;
  reportOnUnmount?: boolean;
  slowRenderThreshold?: number;
  devOnly?: boolean;
}

export interface PerformanceMonitorResult {
  track: (label: string, fn: () => void | Promise<void>) => Promise<void>;
  startTracking: (label: string) => void;
  endTracking: (label: string) => void;
  getMetrics: () => ReturnType<PerformanceTracker['getSummary']>;
  report: () => void;
}

export function usePerformanceMonitor(
  componentName: string,
  options: PerformanceMonitorOptions = {}
): PerformanceMonitorResult {
  const {
    trackRenders = true,
    trackLifecycle = true,
    reportOnUnmount = true,
    slowRenderThreshold = 16,
    devOnly = true,
  } = options;

  const isEnabled = !devOnly || import.meta.env.DEV;

  const trackerRef = useRef<PerformanceTracker | null>(null);
  const renderCountRef = useRef(0);
  const mountTimeRef = useRef<number>(0);
  const lastRenderTimeRef = useRef<number>(0);

  if (!trackerRef.current && isEnabled) {
    trackerRef.current = new PerformanceTracker(componentName);
  }

  useEffect(() => {
    if (!isEnabled || !trackLifecycle || !trackerRef.current) return;

    mountTimeRef.current = performance.now();
    trackerRef.current.mark('mount');

    if (import.meta.env.DEV) {
      console.log(`[Performance] ${componentName} mounted`);
    }

    return () => {
      if (!trackerRef.current) return;

      const unmountTime = performance.now();
      const lifetimeMs = unmountTime - mountTimeRef.current;

      trackerRef.current.mark('unmount', {
        lifetimeMs,
        totalRenders: renderCountRef.current,
      });

      if (import.meta.env.DEV) {
        console.log(
          `[Performance] ${componentName} unmounted after ${lifetimeMs.toFixed(2)}ms (${renderCountRef.current} renders)`
        );

        if (reportOnUnmount) {
          trackerRef.current.report();
        }
      }
    };
  }, [isEnabled, trackLifecycle, componentName, reportOnUnmount]);

  useEffect(() => {
    if (!isEnabled || !trackRenders || !trackerRef.current) return;

    const renderTime = performance.now();
    renderCountRef.current += 1;

    if (lastRenderTimeRef.current > 0) {
      const timeSinceLastRender = renderTime - lastRenderTimeRef.current;

      if (timeSinceLastRender > slowRenderThreshold && import.meta.env.DEV) {
        console.warn(
          `[Performance] ${componentName} slow render #${renderCountRef.current}: ${timeSinceLastRender.toFixed(2)}ms ⚠️`
        );
      }

      trackerRef.current.mark(`render-${renderCountRef.current}`, {
        renderNumber: renderCountRef.current,
        timeSinceLastRender,
      });
    }

    lastRenderTimeRef.current = renderTime;
  });

  const track = useCallback(
    async (label: string, fn: () => void | Promise<void>): Promise<void> => {
      if (!isEnabled || !trackerRef.current) {
        await fn();
        return;
      }

      trackerRef.current.start(label);
      const startTime = performance.now();

      try {
        await fn();
      } finally {
        const duration = trackerRef.current.end(label);
        const endTime = performance.now();

        if (import.meta.env.DEV && duration) {
          const actualDuration = endTime - startTime;
          console.log(`[Performance] ${componentName}.${label}: ${actualDuration.toFixed(2)}ms`);
        }
      }
    },
    [componentName, isEnabled]
  );

  const startTracking = useCallback(
    (label: string) => {
      if (!isEnabled || !trackerRef.current) return;
      trackerRef.current.start(label);
    },
    [isEnabled]
  );

  const endTracking = useCallback(
    (label: string) => {
      if (!isEnabled || !trackerRef.current) return;
      const duration = trackerRef.current.end(label);

      if (import.meta.env.DEV && duration) {
        console.log(`[Performance] ${componentName}.${label}: ${duration.toFixed(2)}ms`);
      }
    },
    [componentName, isEnabled]
  );

  const getMetrics = useCallback(() => {
    if (!isEnabled || !trackerRef.current) {
      return {
        namespace: componentName,
        totalTime: 0,
        metricCount: 0,
        slowest: null,
        metrics: [],
      };
    }

    return trackerRef.current.getSummary();
  }, [componentName, isEnabled]);

  const report = useCallback(() => {
    if (!isEnabled || !trackerRef.current) return;
    trackerRef.current.report();
  }, [isEnabled]);

  return {
    track,
    startTracking,
    endTracking,
    getMetrics,
    report,
  };
}

export function useProfiler(
  componentName: string,
  onRender?: (
    id: string,
    phase: 'mount' | 'update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => void
): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const callback = (
      id: string,
      phase: 'mount' | 'update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      console.log(
        `[Profiler] ${componentName} ${phase}: ${actualDuration.toFixed(2)}ms (base: ${baseDuration.toFixed(2)}ms)`
      );

      if (onRender) {
        onRender(id, phase, actualDuration, baseDuration, startTime, commitTime);
      }
    };

    return () => {
      // Cleanup if needed
    };
  }, [componentName, onRender]);
}
