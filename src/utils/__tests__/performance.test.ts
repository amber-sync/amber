/**
 * Tests for performance utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  measureTime,
  measureTimeSync,
  PerformanceTracker,
  createPerformanceMark,
  measureBetweenMarks,
  clearPerformanceMetrics,
} from '../performance';

describe('Performance Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPerformanceMetrics();
  });

  afterEach(() => {
    clearPerformanceMetrics();
  });

  describe('measureTime', () => {
    it('should measure async function execution time', async () => {
      const mockFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      });

      const result = await measureTime('test-async', mockFn);

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledOnce();
    });

    it('should measure sync function execution time', async () => {
      const mockFn = vi.fn(() => 'result');

      const result = await measureTime('test-sync', mockFn);

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledOnce();
    });

    it('should rethrow errors from measured function', async () => {
      const mockFn = vi.fn(() => {
        throw new Error('Test error');
      });

      await expect(measureTime('test-error', mockFn)).rejects.toThrow('Test error');
    });
  });

  describe('measureTimeSync', () => {
    it('should measure sync function execution time', () => {
      const mockFn = vi.fn(() => 'result');

      const result = measureTimeSync('test-sync', mockFn);

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledOnce();
    });

    it('should rethrow errors from measured function', () => {
      const mockFn = vi.fn(() => {
        throw new Error('Test error');
      });

      expect(() => measureTimeSync('test-error', mockFn)).toThrow('Test error');
    });
  });

  describe('PerformanceTracker', () => {
    it('should track metrics with start/end', () => {
      const tracker = new PerformanceTracker('test-component');

      tracker.start('operation1');
      tracker.end('operation1');

      const metrics = tracker.getAll();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].label).toBe('operation1');
      expect(metrics[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should track multiple metrics', () => {
      const tracker = new PerformanceTracker('test-component');

      tracker.start('operation1');
      tracker.end('operation1');

      tracker.start('operation2');
      tracker.end('operation2');

      const metrics = tracker.getAll();
      expect(metrics).toHaveLength(2);
    });

    it('should get specific metric', () => {
      const tracker = new PerformanceTracker('test-component');

      tracker.start('operation1');
      tracker.end('operation1');

      const metric = tracker.get('operation1');
      expect(metric).toBeDefined();
      expect(metric?.label).toBe('operation1');
    });

    it('should get duration for specific metric', () => {
      const tracker = new PerformanceTracker('test-component');

      tracker.start('operation1');
      tracker.end('operation1');

      const duration = tracker.getDuration('operation1');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing metric gracefully', () => {
      const tracker = new PerformanceTracker('test-component');

      const duration = tracker.end('non-existent');
      expect(duration).toBeUndefined();
    });

    it('should mark a point in time', () => {
      const tracker = new PerformanceTracker('test-component');

      tracker.mark('checkpoint', { info: 'test' });

      const metric = tracker.get('checkpoint');
      expect(metric).toBeDefined();
      expect(metric?.duration).toBe(0);
      expect(metric?.metadata).toEqual({ info: 'test' });
    });

    it('should clear all metrics', () => {
      const tracker = new PerformanceTracker('test-component');

      tracker.start('operation1');
      tracker.end('operation1');

      expect(tracker.getAll()).toHaveLength(1);

      tracker.clear();

      expect(tracker.getAll()).toHaveLength(0);
    });

    it('should generate summary', () => {
      const tracker = new PerformanceTracker('test-component');

      tracker.start('operation1');
      tracker.end('operation1');

      tracker.start('operation2');
      tracker.end('operation2');

      const summary = tracker.getSummary();

      expect(summary.namespace).toBe('test-component');
      expect(summary.metricCount).toBe(2);
      expect(summary.totalTime).toBeGreaterThanOrEqual(0);
      expect(summary.slowest).toBeDefined();
      expect(summary.metrics).toHaveLength(2);
    });

    it('should handle empty metrics in summary', () => {
      const tracker = new PerformanceTracker('test-component');

      const summary = tracker.getSummary();

      expect(summary.namespace).toBe('test-component');
      expect(summary.metricCount).toBe(0);
      expect(summary.totalTime).toBe(0);
      expect(summary.slowest).toBeNull();
      expect(summary.metrics).toHaveLength(0);
    });
  });

  describe('Performance Marks', () => {
    it('should create performance mark', () => {
      // This test verifies the function doesn't throw
      expect(() => createPerformanceMark('test-mark')).not.toThrow();
    });

    it('should measure between marks', () => {
      createPerformanceMark('start-mark');
      createPerformanceMark('end-mark');

      const duration = measureBetweenMarks('test-measure', 'start-mark', 'end-mark');

      // Duration might be null if performance API is not available
      if (duration !== null) {
        expect(duration).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle missing marks gracefully', () => {
      const duration = measureBetweenMarks(
        'test-measure',
        'non-existent-start',
        'non-existent-end'
      );

      expect(duration).toBeNull();
    });

    it('should clear performance metrics', () => {
      createPerformanceMark('test-mark');

      // This test verifies the function doesn't throw
      expect(() => clearPerformanceMetrics()).not.toThrow();
    });
  });
});
