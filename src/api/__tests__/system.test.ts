import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { testNotification } from '../system';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('system api', () => {
  it('returns backend notification status', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(false);

    await expect(testNotification()).resolves.toBe(false);
    expect(invoke).toHaveBeenCalledWith('test_notification');
  });
});
