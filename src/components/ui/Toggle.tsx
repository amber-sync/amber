import React from 'react';

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
          items-center rounded-full transition-colors duration-fast
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-layer-1
          ${checked ? 'bg-gradient-primary' : 'bg-layer-3'}
        `}
      >
        <span
          className={`
            ${styles.thumb} rounded-full bg-white shadow-md
            transform transition-transform duration-fast ease-out
            ${checked ? styles.translate : 'translate-x-0.5'}
          `}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-medium text-text-primary">{label}</span>}
          {description && <span className="text-xs text-text-tertiary mt-0.5">{description}</span>}
        </div>
      )}
    </label>
  );
};
