import React from 'react';
import { Body, Caption } from './Text';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

const sizeStyles = {
  sm: {
    track: 'w-9 h-5',
    thumb: 'h-4 w-4',
    translate: 'translate-x-4',
  },
  md: {
    track: 'w-11 h-6',
    thumb: 'h-5 w-5',
    translate: 'translate-x-5',
  },
};

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  size = 'md',
  disabled = false,
}) => {
  const styles = sizeStyles[size];

  return (
    <label
      className={`inline-flex items-start gap-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex shrink-0 ${styles.track}
          items-center rounded-full transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/30 focus-visible:ring-offset-2
          ${checked ? 'bg-accent-primary hover:bg-[var(--accent-hover)]' : 'bg-layer-3 hover:bg-layer-2'}
        `}
      >
        <span
          className={`
            ${styles.thumb} rounded-full bg-white shadow-md
            transform transition-all duration-200 ease-out
            ${checked ? styles.translate : 'translate-x-0.5'}
          `}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <Body size="sm" weight="medium" as="span">
              {label}
            </Body>
          )}
          {description && (
            <Caption size="sm" color="tertiary" className="mt-0.5">
              {description}
            </Caption>
          )}
        </div>
      )}
    </label>
  );
};
