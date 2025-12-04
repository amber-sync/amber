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
    solid: 'bg-[var(--color-success)] text-white',
    subtle: 'bg-[var(--color-success-subtle)] text-[var(--color-success)]',
    outline: 'border border-[var(--color-success)] text-[var(--color-success)] bg-transparent',
  },
  warning: {
    solid: 'bg-[var(--color-warning)] text-white',
    subtle: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]',
    outline: 'border border-[var(--color-warning)] text-[var(--color-warning)] bg-transparent',
  },
  error: {
    solid: 'bg-[var(--color-error)] text-white',
    subtle: 'bg-[var(--color-error-subtle)] text-[var(--color-error)]',
    outline: 'border border-[var(--color-error)] text-[var(--color-error)] bg-transparent',
  },
  info: {
    solid: 'bg-[var(--color-info)] text-white',
    subtle: 'bg-[var(--color-info-subtle)] text-[var(--color-info)]',
    outline: 'border border-[var(--color-info)] text-[var(--color-info)] bg-transparent',
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
