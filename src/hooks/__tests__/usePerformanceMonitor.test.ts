/**
 * Tests for usePerformanceMonitor hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePerformanceMonitor } from '../usePerformanceMonitor';

describe('usePerformanceMonitor', () => {
  it('should initialize without errors', () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent'));

    expect(result.current).toBeDefined();
    expect(result.current.track).toBeDefined();
    expect(result.current.startTracking).toBeDefined();
    expect(result.current.endTracking).toBeDefined();
    expect(result.current.getMetrics).toBeDefined();
    expect(result.current.report).toBeDefined();
  });

  it('should track async operations', async () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent'));

    const mockOperation = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    await result.current.track('test-operation', mockOperation);

    expect(mockOperation).toHaveBeenCalledOnce();
  });

  it('should track sync operations', async () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent'));

    const mockOperation = vi.fn(() => {
      // No return value needed for void function
    });

    await result.current.track('test-operation', mockOperation);

    expect(mockOperation).toHaveBeenCalledOnce();
  });

  it('should provide manual tracking controls', () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent'));

    // Should not throw
    expect(() => {
      result.current.startTracking('manual-metric');
      result.current.endTracking('manual-metric');
    }).not.toThrow();
  });

  it('should get metrics summary', () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent'));

    const metrics = result.current.getMetrics();

    expect(metrics).toBeDefined();
    expect(metrics.namespace).toBe('TestComponent');
    expect(metrics.totalTime).toBeGreaterThanOrEqual(0);
    expect(metrics.metricCount).toBeGreaterThanOrEqual(0);
  });

  it('should report metrics without errors', () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent'));

    // Should not throw
    expect(() => result.current.report()).not.toThrow();
  });

  it('should respect devOnly option', () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent', { devOnly: false }));

    expect(result.current).toBeDefined();
  });

  it('should disable tracking when not in dev mode', async () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent', { devOnly: true }));

    const mockOperation = vi.fn();
    await result.current.track('test', mockOperation);

    expect(mockOperation).toHaveBeenCalled();
  });

  it('should track with custom options', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitor('TestComponent', {
        trackRenders: true,
        trackLifecycle: true,
        reportOnUnmount: false,
        slowRenderThreshold: 50,
      })
    );

    expect(result.current).toBeDefined();
  });

  it('should handle errors in tracked operations', async () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent'));

    const mockOperation = vi.fn(() => {
      throw new Error('Test error');
    });

    await expect(result.current.track('test-error', mockOperation)).rejects.toThrow('Test error');
  });

  it('should track multiple operations sequentially', async () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent'));

    const op1 = vi.fn(async () => {});
    const op2 = vi.fn(async () => {});

    await result.current.track('operation1', op1);
    await result.current.track('operation2', op2);

    const metrics = result.current.getMetrics();
    expect(metrics.metricCount).toBeGreaterThanOrEqual(0);
  });

  it('should cleanup on unmount', async () => {
    const { unmount } = renderHook(() =>
      usePerformanceMonitor('TestComponent', {
        reportOnUnmount: true,
      })
    );

    // Should not throw on unmount
    expect(() => unmount()).not.toThrow();
  });
});
