/**
 * TIM-186: Filesystem-related API operations
 * Extracted from monolithic AmberAPI class for better organization
 */

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { desktopDir } from '@tauri-apps/api/path';
import type { DirEntry, FileNode, VolumeInfo, MountStatus } from '../types';
import { getErrorMessage } from '../types';

// ===== Filesystem =====

export async function readDir(path: string): Promise<DirEntry[]> {
  return invoke('read_dir', { path });
}

export async function selectDirectory(): Promise<string | null> {
  const selected = await open({ directory: true });
  return selected as string | null;
}

export async function openPath(path: string): Promise<void> {
  return invoke('open_path', { path });
}

export async function showItemInFolder(path: string): Promise<void> {
  return invoke('show_item_in_folder', { path });
}

export async function getDiskStats(path: string): Promise<{
  success: boolean;
  stats?: { total: number; free: number; status: 'AVAILABLE' | 'UNAVAILABLE' };
  error?: string;
}> {
  try {
    const result = await invoke<{ totalBytes: number; availableBytes: number }>('get_volume_info', {
      path,
    });
    return {
      success: true,
      stats: {
        total: result.totalBytes,
        free: result.availableBytes,
        status: 'AVAILABLE',
      },
    };
  } catch (e: unknown) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function readFilePreview(filePath: string, maxLines?: number): Promise<string> {
  return invoke('read_file_preview', { filePath, maxLines });
}

export async function readFileAsBase64(filePath: string): Promise<string> {
  return invoke('read_file_as_base64', { filePath });
}

export async function getDesktopPath(): Promise<string> {
  return desktopDir();
}

// ===== Volume Search (TIM-47) =====

/**
 * List mounted external volumes
 */
export async function listVolumes(): Promise<VolumeInfo[]> {
  return invoke('list_volumes');
}

/**
 * Search files in a volume by pattern (fuzzy match)
 */
export async function searchVolume(
  volumePath: string,
  pattern: string,
  limit?: number
): Promise<FileNode[]> {
  return invoke('search_volume', { volumePath, pattern, limit });
}

// ===== Mount Detection (TIM-109) =====

/**
 * Check if a single path is accessible/mounted
 */
export async function isPathMounted(path: string): Promise<MountStatus> {
  return invoke('is_path_mounted', { path });
}

/**
 * Check mount status for multiple destination paths at once
 * More efficient than calling isPathMounted for each path
 */
export async function checkDestinations(paths: string[]): Promise<MountStatus[]> {
  return invoke('check_destinations', { paths });
}
