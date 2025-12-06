/**
 * TIM-187: Mode badge component for displaying backup job modes
 * Extracted from JobCard.tsx for reusability
 */

import React from 'react';
import type { SyncJob } from '../../types';

export type BackupMode = SyncJob['mode'];

interface ModeBadgeProps {
  mode: BackupMode;
  className?: string;
}

const modeLabels: Record<BackupMode, string> = {
  MIRROR: 'Mirror',
  ARCHIVE: 'Archive',
  TIME_MACHINE: 'Time Machine',
};

/**
 * Badge component displaying the backup mode (Mirror, Archive, Time Machine)
 */
export function ModeBadge({ mode, className = '' }: ModeBadgeProps) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium text-text-tertiary bg-layer-2 rounded-md ${className}`}
    >
      {modeLabels[mode] || 'Mirror'}
    </span>
  );
}
