/**
 * Centralized configuration for Amber Backup
 */

import { RsyncConfig, SyncMode } from '../types';

// TIM-185: Re-export constants for convenient access
export { FILE_TYPE, isDirectory, isFile } from './constants';
export type { FileType } from './constants';

/**
 * Base rsync configuration used as foundation for all modes.
 * Individual mode presets may override specific values.
 */
export const BASE_RSYNC_CONFIG: RsyncConfig = {
  recursive: true,
  archive: true,
  compress: true,
  delete: false,
  verbose: true,
  excludePatterns: [],
  customFlags: '',
  customCommand: undefined,
};

/**
 * Mode-specific rsync presets.
 * Each mode has optimized settings for its use case.
 */
export const MODE_PRESETS: Record<SyncMode, RsyncConfig> = {
  [SyncMode.MIRROR]: {
    ...BASE_RSYNC_CONFIG,
    delete: true, // Mirror mode deletes files not in source
  },
  [SyncMode.ARCHIVE]: {
    ...BASE_RSYNC_CONFIG,
    delete: false, // Archive mode preserves all files
  },
  [SyncMode.TIME_MACHINE]: {
    ...BASE_RSYNC_CONFIG,
    delete: false, // Time Machine mode preserves history
  },
};

/**
 * Default config for new jobs (Time Machine mode by default)
 */
export const DEFAULT_JOB_CONFIG = MODE_PRESETS[SyncMode.TIME_MACHINE];

/**
 * Get the preset config for a given sync mode
 */
export function getConfigForMode(mode: SyncMode): RsyncConfig {
  return { ...MODE_PRESETS[mode] };
}
