import React, { forwardRef } from 'react';

export type IconButtonVariant = 'default' | 'ghost' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  label: string; // Required for accessibility
}

const baseStyles =
  'inline-flex items-center justify-center rounded-lg transition-all duration-150 ' +
  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-accent-primary/30 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'active:scale-[0.95] transform';

const variantStyles: Record<IconButtonVariant, string> = {
  default:
    'bg-layer-3 text-text-secondary border border-border-highlight ' +
    'hover:bg-layer-2 hover:text-text-primary hover:border-border-base ' +
    'active:bg-layer-3',
  ghost:
    'bg-transparent text-text-tertiary ' +
    'hover:bg-layer-3 hover:text-text-primary ' +
    'active:bg-layer-2',
  danger:
    'bg-transparent text-text-tertiary ' +
    'hover:bg-[var(--color-error-subtle)] hover:text-[var(--color-error)] ' +
    'active:bg-[var(--color-error-subtle)] active:text-[var(--color-error)]',
};

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-7 h-7 [&>svg]:w-3.5 [&>svg]:h-3.5',
  md: 'w-9 h-9 [&>svg]:w-4 [&>svg]:h-4',
  lg: 'w-11 h-11 [&>svg]:w-5 [&>svg]:h-5',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'default', size = 'md', label, className = '', children, ...props }, ref) => {
    const buttonStyles =
      `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim();

    return (
      <button ref={ref} className={buttonStyles} aria-label={label} title={label} {...props}>
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
