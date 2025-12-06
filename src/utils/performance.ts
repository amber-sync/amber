/**
 * Performance measurement utilities for tracking execution times and bottlenecks
 * @module utils/performance
 */

/**
 * Performance metric data structure
 */
export interface PerformanceMetric {
  label: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Measure the execution time of a function
 * Logs the result in development mode
 */
export async function measureTime<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (import.meta.env.DEV) {
      console.log(
        `[Performance] ${label}: ${duration.toFixed(2)}ms`,
        duration > 1000 ? '⚠️ SLOW' : ''
      );
    }

    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (import.meta.env.DEV) {
      console.error(`[Performance] ${label} failed after ${duration.toFixed(2)}ms`, error);
    }

    throw error;
  }
}

/**
 * Synchronous version of measureTime for non-async functions
 */
export function measureTimeSync<T>(label: string, fn: () => T): T {
  const startTime = performance.now();

  try {
    const result = fn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (import.meta.env.DEV) {
      console.log(
        `[Performance] ${label}: ${duration.toFixed(2)}ms`,
        duration > 100 ? '⚠️ SLOW' : ''
      );
    }

    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (import.meta.env.DEV) {
      console.error(`[Performance] ${label} failed after ${duration.toFixed(2)}ms`, error);
    }

    throw error;
  }
}

/**
 * Class for tracking multiple performance metrics over time
 */
export class PerformanceTracker {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  start(label: string, metadata?: Record<string, unknown>): void {
    this.metrics.set(label, {
      label,
      startTime: performance.now(),
      metadata,
    });
  }

  end(label: string): number | undefined {
    const metric = this.metrics.get(label);
    if (!metric) {
      if (import.meta.env.DEV) {
        console.warn(`[PerformanceTracker] No metric found for label: ${label}`);
      }
      return undefined;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    return metric.duration;
  }

  mark(label: string, metadata?: Record<string, unknown>): void {
    this.metrics.set(label, {
      label,
      startTime: performance.now(),
      endTime: performance.now(),
      duration: 0,
      metadata,
    });
  }

  get(label: string): PerformanceMetric | undefined {
    return this.metrics.get(label);
  }

  getDuration(label: string): number | undefined {
    return this.metrics.get(label)?.duration;
  }

  getAll(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  clear(): void {
    this.metrics.clear();
  }

  report(): void {
    if (!import.meta.env.DEV) return;

    console.group(`[PerformanceTracker] ${this.namespace}`);

    const metrics = this.getAll();
    if (metrics.length === 0) {
      console.log('No metrics recorded');
      console.groupEnd();
      return;
    }

    const sortedMetrics = metrics
      .filter(m => m.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));

    const totalTime = sortedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);

    console.table(
      sortedMetrics.map(m => ({
        Label: m.label,
        'Duration (ms)': m.duration?.toFixed(2),
        '% of Total': ((m.duration! / totalTime) * 100).toFixed(1) + '%',
        Warning: m.duration! > 1000 ? '⚠️ SLOW' : '',
      }))
    );

    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    console.groupEnd();
  }

  getSummary(): {
    namespace: string;
    totalTime: number;
    metricCount: number;
    slowest: { label: string; duration: number } | null;
    metrics: Array<{ label: string; duration: number }>;
  } {
    const metrics = this.getAll().filter(m => m.duration !== undefined);
    const totalTime = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);

    const sortedMetrics = metrics.sort((a, b) => (b.duration || 0) - (a.duration || 0));

    return {
      namespace: this.namespace,
      totalTime,
      metricCount: metrics.length,
      slowest:
        sortedMetrics.length > 0
          ? { label: sortedMetrics[0].label, duration: sortedMetrics[0].duration! }
          : null,
      metrics: sortedMetrics.map(m => ({
        label: m.label,
        duration: m.duration!,
      })),
    };
  }
}

export function createPerformanceMark(name: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name);
  }
}

export function measureBetweenMarks(
  name: string,
  startMark: string,
  endMark: string
): number | null {
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name);
      if (entries.length > 0) {
        return entries[entries.length - 1].duration;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[Performance] Failed to measure:', error);
      }
    }
  }
  return null;
}

export function clearPerformanceMetrics(): void {
  if (typeof performance !== 'undefined') {
    performance.clearMarks();
    performance.clearMeasures();
  }
}
