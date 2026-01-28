/**
 * TIM-218: Skeleton loading component
 *
 * Provides placeholder UI during content loading.
 * Uses subtle pulse animation for visual feedback.
 */

import React from 'react';
import { cn } from '@/utils/cn';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular';

interface SkeletonProps {
  /** Shape variant */
  variant?: SkeletonVariant;
  /** Width - can be number (px), string (e.g. '100%'), or Tailwind class */
  width?: number | string;
  /** Height - can be number (px), string, or Tailwind class */
  height?: number | string;
  /** Additional CSS classes */
  className?: string;
  /** Number of skeleton lines (for text variant) */
  lines?: number;
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: 'rounded-md',
  circular: 'rounded-full',
  rectangular: 'rounded-lg',
};

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className,
  lines = 1,
}) => {
  const baseStyles = cn('bg-layer-3 animate-pulse', variantStyles[variant], className);

  const getStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {};
    if (typeof width === 'number') style.width = `${width}px`;
    else if (width) style.width = width;
    if (typeof height === 'number') style.height = `${height}px`;
    else if (height) style.height = height;
    return style;
  };

  // Default dimensions based on variant
  const defaultHeight = variant === 'text' ? 'h-4' : variant === 'circular' ? 'h-10 w-10' : 'h-20';
  const defaultWidth = variant === 'text' ? 'w-full' : '';

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseStyles, defaultHeight, i === lines - 1 ? 'w-3/4' : defaultWidth)}
            style={i === 0 ? getStyle() : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseStyles, !width && defaultWidth, !height && defaultHeight)}
      style={getStyle()}
    />
  );
};

/**
 * Skeleton wrapper for cards/containers
 */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('bg-layer-1 border border-border-base rounded-lg p-4 space-y-3', className)}>
    <div className="flex items-center gap-3">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} />
      </div>
    </div>
    <Skeleton variant="text" lines={2} />
  </div>
);

/**
 * Skeleton for list items
 */
export const SkeletonListItem: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('flex items-center gap-3 p-3', className)}>
    <Skeleton variant="rectangular" width={40} height={40} />
    <div className="flex-1 space-y-2">
      <Skeleton width="70%" height={14} />
      <Skeleton width="50%" height={12} />
    </div>
  </div>
);
