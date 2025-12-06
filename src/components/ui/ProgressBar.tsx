/**
 * ProgressBar - Linear progress indicator component
 *
 * TIM-166: Reusable progress bar with design token support
 */

import React from 'react';

export type ProgressBarVariant = 'default' | 'success' | 'warning' | 'error';
export type ProgressBarSize = 'sm' | 'md' | 'lg';

interface ProgressBarProps {
  /** Progress value from 0 to 100 */
  progress: number;
  /** Visual variant */
  variant?: ProgressBarVariant;
  /** Size variant */
  size?: ProgressBarSize;
  /** Show percentage label */
  showLabel?: boolean;
  /** Custom label (overrides percentage) */
  label?: string;
  /** Animated stripe effect for indeterminate state */
  animated?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const sizeStyles: Record<ProgressBarSize, { track: string; label: string }> = {
  sm: {
    track: 'h-1.5',
    label: 'text-xs',
  },
  md: {
    track: 'h-2',
    label: 'text-sm',
  },
  lg: {
    track: 'h-3',
    label: 'text-sm',
  },
};

const variantStyles: Record<ProgressBarVariant, string> = {
  default: 'bg-accent-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  variant = 'default',
  size = 'md',
  showLabel = false,
  label,
  animated = false,
  className = '',
}) => {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const styles = sizeStyles[size];

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className={`flex justify-between items-center mb-1.5 ${styles.label}`}>
          <span className="text-text-secondary font-medium">{label || 'Progress'}</span>
          <span className="text-text-tertiary">{Math.round(clampedProgress)}%</span>
        </div>
      )}
      <div
        className={`w-full bg-layer-3 rounded-full overflow-hidden ${styles.track}`}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`${styles.track} ${variantStyles[variant]} rounded-full transition-all duration-300 ease-out ${
            animated ? 'animate-pulse' : ''
          }`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

ProgressBar.displayName = 'ProgressBar';
