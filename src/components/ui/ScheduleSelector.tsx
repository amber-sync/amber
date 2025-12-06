/**
 * TIM-209: Reusable schedule selector component
 * Allows selecting backup schedule frequency
 */

import React from 'react';
import { Icons } from '../IconComponents';

export interface ScheduleOption {
  /** Display label */
  label: string;
  /** Value in minutes (null for manual/no schedule) */
  value: number | null;
  /** Icon to display */
  icon: React.ReactNode;
  /** Optional description */
  description?: string;
}

export interface ScheduleSelectorProps {
  /** Current selected value (minutes or null for manual) */
  value: number | null;
  /** Called when selection changes */
  onChange: (value: number | null) => void;
  /** Custom schedule options (uses default if not provided) */
  options?: ScheduleOption[];
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Layout variant */
  variant?: 'horizontal' | 'vertical';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/** Default schedule options */
export const DEFAULT_SCHEDULE_OPTIONS: ScheduleOption[] = [
  { label: 'Manual', value: null, icon: <Icons.Hand size={16} />, description: 'Run manually' },
  { label: 'Hourly', value: 60, icon: <Icons.Clock size={16} />, description: 'Every hour' },
  { label: 'Daily', value: 1440, icon: <Icons.Calendar size={16} />, description: 'Once per day' },
  {
    label: 'Weekly',
    value: 10080,
    icon: <Icons.CalendarDays size={16} />,
    description: 'Once per week',
  },
];

/** Extended options for advanced use cases */
export const EXTENDED_SCHEDULE_OPTIONS: ScheduleOption[] = [
  ...DEFAULT_SCHEDULE_OPTIONS.slice(0, 1), // Manual
  {
    label: 'Every 15 min',
    value: 15,
    icon: <Icons.Clock size={16} />,
    description: 'High frequency',
  },
  {
    label: 'Every 30 min',
    value: 30,
    icon: <Icons.Clock size={16} />,
    description: 'Medium frequency',
  },
  ...DEFAULT_SCHEDULE_OPTIONS.slice(1), // Hourly, Daily, Weekly
];

const sizeClasses = {
  sm: 'px-2 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-base',
};

export const ScheduleSelector: React.FC<ScheduleSelectorProps> = ({
  value,
  onChange,
  options = DEFAULT_SCHEDULE_OPTIONS,
  disabled = false,
  variant = 'horizontal',
  size = 'md',
}) => {
  const isHorizontal = variant === 'horizontal';
  const containerClass = isHorizontal ? 'flex flex-wrap gap-2' : 'flex flex-col gap-2';

  return (
    <div className={containerClass} role="radiogroup" aria-label="Schedule frequency">
      {options.map(option => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={`
              ${sizeClasses[size]}
              rounded-lg font-medium transition-all flex items-center gap-2
              ${
                isSelected
                  ? 'bg-accent-primary text-accent-text'
                  : 'bg-layer-2 text-text-secondary hover:bg-layer-3'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${!isHorizontal ? 'w-full justify-start' : ''}
            `}
          >
            {option.icon}
            <span>{option.label}</span>
            {!isHorizontal && option.description && (
              <span className="ml-auto text-xs text-text-tertiary">{option.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Helper to format schedule value as human-readable string
 */
export function formatSchedule(minutes: number | null): string {
  if (minutes === null) return 'Manual';
  if (minutes < 60) return `Every ${minutes} min`;
  if (minutes === 60) return 'Hourly';
  if (minutes < 1440) return `Every ${minutes / 60} hours`;
  if (minutes === 1440) return 'Daily';
  if (minutes < 10080) return `Every ${minutes / 1440} days`;
  if (minutes === 10080) return 'Weekly';
  return `Every ${minutes / 10080} weeks`;
}

export default ScheduleSelector;
