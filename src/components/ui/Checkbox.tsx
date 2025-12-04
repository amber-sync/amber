/**
 * Checkbox - Checkbox input with label support
 *
 * TIM-152: Reusable checkbox component with consistent styling
 */

import React, { forwardRef } from 'react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Checkbox label */
  label?: string;
  /** Description shown below label */
  description?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Error state */
  error?: boolean;
}

const sizeStyles = {
  sm: {
    checkbox: 'w-4 h-4',
    label: 'text-sm',
    description: 'text-xs',
  },
  md: {
    checkbox: 'w-5 h-5',
    label: 'text-sm',
    description: 'text-xs',
  },
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, size = 'md', error, className = '', disabled, ...props }, ref) => {
    const styles = sizeStyles[size];

    return (
      <label
        className={`inline-flex items-start gap-3 ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        } ${className}`}
      >
        <div className="relative flex items-center justify-center">
          <input
            ref={ref}
            type="checkbox"
            disabled={disabled}
            className={`
              ${styles.checkbox} rounded border-2 transition-all duration-150
              ${error ? 'border-red-500 dark:border-red-400' : 'border-stone-300 dark:border-stone-600'}
              bg-stone-50 dark:bg-stone-900
              checked:bg-amber-500 checked:border-amber-500
              checked:hover:bg-amber-600 checked:hover:border-amber-600
              focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:ring-offset-2
              hover:border-stone-400 dark:hover:border-stone-500
              cursor-pointer disabled:cursor-not-allowed
            `}
            {...props}
          />
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <span className={`${styles.label} font-medium text-text-primary`}>{label}</span>
            )}
            {description && (
              <span className={`${styles.description} text-text-tertiary mt-0.5`}>
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
