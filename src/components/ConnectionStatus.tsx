import React from 'react';
import { Icons } from './IconComponents';
import { Caption } from './ui';

interface ConnectionStatusProps {
  mounted: boolean;
  isExternal: boolean;
  volumeName?: string;
  isRunning?: boolean;
  className?: string;
  showLabel?: boolean;
}

/**
 * Shows the connection status of a backup destination
 * - Green dot = mounted and accessible
 * - Orange dot = mounted and currently syncing
 * - Gray dot = not mounted / offline
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  mounted,
  isExternal,
  volumeName,
  isRunning = false,
  className = '',
  showLabel = false,
}) => {
  const getStatusConfig = () => {
    if (isRunning) {
      return {
        dotColor: 'bg-accent-primary',
        pulseColor: 'bg-accent-primary/70',
        label: 'Syncing',
        icon: <Icons.RefreshCw size={12} className="animate-spin" />,
      };
    }
    if (mounted) {
      return {
        dotColor: 'bg-[var(--color-success)]',
        pulseColor: 'bg-[var(--color-success)]/70',
        label: isExternal ? volumeName || 'Connected' : 'Local',
        icon: null,
      };
    }
    return {
      dotColor: 'bg-text-tertiary',
      pulseColor: '',
      label: 'Offline',
      icon: null,
    };
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Pulse animation for active states */}
        {(mounted || isRunning) && (
          <span
            className={`absolute inline-flex h-2.5 w-2.5 rounded-full ${config.pulseColor} opacity-75 animate-ping`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
      </div>
      {showLabel && (
        <Caption color="secondary" className="flex items-center gap-1">
          {config.icon}
          {config.label}
        </Caption>
      )}
    </div>
  );
};

/**
 * Badge variant for showing in job cards
 */
export const OfflineBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-elevated text-text-secondary ${className}`}
  >
    <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
    <Caption size="sm" className="font-bold uppercase tracking-wide">
      Offline
    </Caption>
  </span>
);

/**
 * Inline status indicator for compact display
 */
export const ConnectionDot: React.FC<{
  mounted: boolean;
  isRunning?: boolean;
  size?: 'sm' | 'md';
}> = ({ mounted, isRunning = false, size = 'sm' }) => {
  const sizeClass = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const pulseSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  const dotColor = isRunning
    ? 'bg-accent-primary'
    : mounted
      ? 'bg-[var(--color-success)]'
      : 'bg-text-tertiary';
  const pulseColor = isRunning
    ? 'bg-accent-primary/70'
    : mounted
      ? 'bg-[var(--color-success)]/70'
      : '';

  return (
    <span className="relative inline-flex items-center justify-center">
      {(mounted || isRunning) && pulseColor && (
        <span
          className={`absolute inline-flex ${pulseSize} rounded-full ${pulseColor} opacity-75 animate-ping`}
        />
      )}
      <span className={`relative inline-flex rounded-full ${sizeClass} ${dotColor}`} />
    </span>
  );
};

export default ConnectionStatus;
