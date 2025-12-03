import React from 'react';
import { Icons } from './IconComponents';

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
        dotColor: 'bg-orange-500',
        pulseColor: 'bg-orange-400',
        label: 'Syncing',
        icon: <Icons.RefreshCw size={12} className="animate-spin" />,
      };
    }
    if (mounted) {
      return {
        dotColor: 'bg-green-500',
        pulseColor: 'bg-green-400',
        label: isExternal ? volumeName || 'Connected' : 'Local',
        icon: null,
      };
    }
    return {
      dotColor: 'bg-gray-400 dark:bg-gray-600',
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
        <span className="text-xs text-text-secondary flex items-center gap-1">
          {config.icon}
          {config.label}
        </span>
      )}
    </div>
  );
};

/**
 * Badge variant for showing in job cards
 */
export const OfflineBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 ${className}`}
  >
    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
    Offline
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

  const dotColor = isRunning ? 'bg-orange-500' : mounted ? 'bg-green-500' : 'bg-gray-400';
  const pulseColor = isRunning ? 'bg-orange-400' : mounted ? 'bg-green-400' : '';

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
