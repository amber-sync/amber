import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
}

const baseStyles =
  'inline-flex items-center justify-center font-semibold transition-all duration-150 ' +
  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ' +
  'active:scale-[0.98] transform';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-primary text-accent-text ' +
    'hover:bg-[var(--accent-hover)] ' +
    'active:bg-[var(--accent-active)] ' +
    'focus:ring-accent-primary/30',
  secondary:
    'bg-layer-3 text-text-secondary ' +
    'border border-border-base ' +
    'hover:bg-layer-2 hover:border-border-highlight hover:text-text-primary ' +
    'active:bg-layer-3 ' +
    'focus:ring-accent-primary/30',
  ghost:
    'bg-transparent text-text-secondary ' +
    'hover:bg-layer-3 hover:text-text-primary ' +
    'active:bg-layer-2 ' +
    'focus:ring-accent-primary/30',
  danger:
    'bg-[var(--color-error)] text-white ' +
    'hover:bg-red-500 ' +
    'active:bg-red-700 ' +
    'focus:ring-[var(--color-error)]/30',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      loading,
      className = '',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const buttonStyles =
      `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim();

    return (
      <button ref={ref} className={buttonStyles} disabled={disabled || loading} {...props}>
        {loading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children && <span>{children}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
