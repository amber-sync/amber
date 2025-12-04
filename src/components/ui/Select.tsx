/**
 * Select - Dropdown select component
 *
 * TIM-143: Reusable select with variants, sizes, and theme support
 */

import React, { forwardRef } from 'react';

export type SelectVariant = 'default' | 'outlined' | 'ghost';
export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  variant?: SelectVariant;
  size?: SelectSize;
  options: SelectOption[];
  placeholder?: string;
  error?: boolean;
  icon?: React.ReactNode;
}

const baseStyles =
  'w-full border bg-layer-2 text-text-primary ' +
  'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary ' +
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
  'appearance-none cursor-pointer';

const variantStyles: Record<SelectVariant, string> = {
  default: 'border-border-base',
  outlined: 'border-border-highlight bg-transparent',
  ghost: 'border-transparent bg-layer-3 hover:bg-layer-2',
};

const sizeStyles: Record<SelectSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md pr-8',
  md: 'px-4 py-2.5 text-sm rounded-lg pr-10',
  lg: 'px-5 py-3.5 text-base rounded-xl pr-12',
};

const iconSizeStyles: Record<SelectSize, string> = {
  sm: 'right-2 w-4 h-4',
  md: 'right-3 w-5 h-5',
  lg: 'right-4 w-5 h-5',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      variant = 'default',
      size = 'md',
      options,
      placeholder,
      error,
      icon,
      className = '',
      ...props
    },
    ref
  ) => {
    const selectStyles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${
      error ? 'border-error focus:ring-error' : ''
    } ${icon ? 'pl-10' : ''} ${className}`.trim();

    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
            {icon}
          </div>
        )}
        <select ref={ref} className={selectStyles} {...props}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(option => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {/* Chevron icon */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none ${iconSizeStyles[size]}`}
        >
          <svg
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            className="w-full h-full"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';
