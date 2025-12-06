import React from 'react';

export type StatusDotStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'idle';
export type StatusDotSize = 'sm' | 'md' | 'lg';

interface StatusDotProps {
  status?: StatusDotStatus;
  size?: StatusDotSize;
  pulse?: boolean;
  className?: string;
}

const sizeStyles: Record<StatusDotSize, string> = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

const statusColors: Record<StatusDotStatus, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
  neutral: 'bg-text-tertiary',
  idle: 'bg-text-quaternary',
};

export function StatusDot({
  status = 'neutral',
  size = 'md',
  pulse = false,
  className = '',
}: StatusDotProps) {
  const dotStyles =
    `inline-block rounded-full ${sizeStyles[size]} ${statusColors[status]} ${className}`.trim();

  if (pulse) {
    return (
      <span className="relative inline-flex">
        <span className={`${dotStyles} animate-ping absolute opacity-75`} />
        <span className={dotStyles} />
      </span>
    );
  }

  return <span className={dotStyles} />;
}
