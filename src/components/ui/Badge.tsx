import React from 'react';

export type BadgeStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral';
export type BadgeVariant = 'solid' | 'subtle' | 'outline';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  status?: BadgeStatus;
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

const baseStyles = 'inline-flex items-center font-medium rounded-full';

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

const statusColors: Record<BadgeStatus, { solid: string; subtle: string; outline: string }> = {
  success: {
    solid: 'bg-success text-white',
    subtle: 'bg-success-subtle text-success',
    outline: 'border border-success text-success bg-transparent',
  },
  warning: {
    solid: 'bg-warning text-white',
    subtle: 'bg-warning-subtle text-warning',
    outline: 'border border-warning text-warning bg-transparent',
  },
  error: {
    solid: 'bg-error text-white',
    subtle: 'bg-error-subtle text-error',
    outline: 'border border-error text-error bg-transparent',
  },
  info: {
    solid: 'bg-info text-white',
    subtle: 'bg-info-subtle text-info',
    outline: 'border border-info text-info bg-transparent',
  },
  neutral: {
    solid: 'bg-layer-3 text-text-primary',
    subtle: 'bg-layer-2 text-text-secondary',
    outline: 'border border-border-base text-text-secondary bg-transparent',
  },
};

export function Badge({
  status = 'neutral',
  variant = 'subtle',
  size = 'md',
  children,
  className = '',
}: BadgeProps) {
  const badgeStyles =
    `${baseStyles} ${sizeStyles[size]} ${statusColors[status][variant]} ${className}`.trim();

  return <span className={badgeStyles}>{children}</span>;
}
