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
    'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 ' +
    'hover:bg-zinc-800 dark:hover:bg-zinc-200 ' +
    'active:bg-zinc-950 dark:active:bg-zinc-100 ' +
    'focus:ring-zinc-500/30',
  secondary:
    'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 ' +
    'border border-zinc-200 dark:border-zinc-700 ' +
    'hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 ' +
    'active:bg-zinc-300 dark:active:bg-zinc-600 ' +
    'focus:ring-zinc-400/30',
  ghost:
    'bg-transparent text-zinc-600 dark:text-zinc-400 ' +
    'hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 ' +
    'active:bg-zinc-200 dark:active:bg-zinc-700 ' +
    'focus:ring-zinc-400/30',
  danger:
    'bg-red-600 text-white ' + 'hover:bg-red-500 ' + 'active:bg-red-700 ' + 'focus:ring-red-500/30',
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
