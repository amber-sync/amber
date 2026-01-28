/**
 * SegmentedControl - Reusable toggle button group
 *
 * Used for switching between mutually exclusive options like Local/Cloud destination.
 */

import React from 'react';
import { cn } from '@/utils/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  className,
}: SegmentedControlProps<T>) {
  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
  };

  return (
    <div className={cn('flex bg-layer-2 p-0.5 rounded-lg', className)}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md font-medium transition-all flex items-center',
            sizeStyles[size],
            value === option.value
              ? 'bg-layer-1 text-text-primary shadow-sm'
              : 'text-text-tertiary hover:text-text-secondary'
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
