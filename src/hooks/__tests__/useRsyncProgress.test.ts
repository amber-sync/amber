import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRsyncProgress } from '../useRsyncProgress';

// Mock the api module - return cleanup functions
const mockUnsubLog = vi.fn();
const mockUnsubProgress = vi.fn();
const mockUnsubComplete = vi.fn();

vi.mock('../../api', () => ({
  api: {
    onRsyncLog: vi.fn(() => mockUnsubLog),
    onRsyncProgress: vi.fn(() => mockUnsubProgress),
    onRsyncComplete: vi.fn(() => mockUnsubComplete),
  },
}));

describe('useRsyncProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial state with isRunning false', () => {
    const { result } = renderHook(() => useRsyncProgress());
    expect(result.current.isRunning).toBe(false);
  });

  it('should return initial state with empty logs array', () => {
    const { result } = renderHook(() => useRsyncProgress());
    expect(result.current.logs).toEqual([]);
  });

  it('should return initial state with null progress', () => {
    const { result } = renderHook(() => useRsyncProgress());
    expect(result.current.progress).toBeNull();
  });

  it('should provide setIsRunning function that updates state', () => {
    const { result } = renderHook(() => useRsyncProgress());

    act(() => {
      result.current.setIsRunning(true);
    });
    expect(result.current.isRunning).toBe(true);

    act(() => {
      result.current.setIsRunning(false);
    });
    expect(result.current.isRunning).toBe(false);
  });

  it('should provide clearLogs function that clears logs', () => {
    const { result } = renderHook(() => useRsyncProgress());

    act(() => {
      result.current.clearLogs();
    });
    expect(result.current.logs).toEqual([]);
  });

  it('should provide addLog function', () => {
    const { result } = renderHook(() => useRsyncProgress());

    // addLog is available as a function
    expect(typeof result.current.addLog).toBe('function');
  });

  it('should call cleanup functions on unmount', () => {
    const { unmount } = renderHook(() => useRsyncProgress());

    unmount();

    // Verify cleanup was called
    expect(mockUnsubLog).toHaveBeenCalled();
    expect(mockUnsubProgress).toHaveBeenCalled();
    expect(mockUnsubComplete).toHaveBeenCalled();
  });
});
