import React from 'react';

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  children?: React.ReactNode;
}

const variantColors = {
  default: 'stroke-accent-primary',
  success: 'stroke-success',
  warning: 'stroke-warning',
  danger: 'stroke-error',
};

const variantBgColors = {
  default: 'stroke-layer-3',
  success: 'stroke-success-subtle',
  warning: 'stroke-warning-subtle',
  danger: 'stroke-error-subtle',
};

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 64,
  strokeWidth = 4,
  className = '',
  showLabel = true,
  variant = 'default',
  children,
}) => {
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={variantBgColors[variant]}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`${variantColors[variant]} transition-all duration-slow ease-out`}
        />
      </svg>
      {(showLabel || children) && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children || (
            <span className="text-sm font-semibold text-text-primary">
              {Math.round(normalizedProgress)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
};
