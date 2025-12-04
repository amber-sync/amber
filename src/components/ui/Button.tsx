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
    'bg-gradient-to-b from-amber-500 to-amber-600 text-white ' +
    'hover:from-amber-400 hover:to-amber-500 ' +
    'active:from-amber-600 active:to-amber-700 ' +
    'shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 ' +
    'focus:ring-amber-500/50 border border-amber-400/20',
  secondary:
    'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 ' +
    'border border-stone-300 dark:border-stone-600 ' +
    'hover:bg-stone-200 dark:hover:bg-stone-700 hover:border-stone-400 dark:hover:border-stone-500 ' +
    'active:bg-stone-300 dark:active:bg-stone-600 ' +
    'focus:ring-stone-400/50',
  ghost:
    'bg-transparent text-stone-600 dark:text-stone-400 ' +
    'hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 ' +
    'active:bg-stone-200 dark:active:bg-stone-700 ' +
    'focus:ring-stone-400/50',
  danger:
    'bg-gradient-to-b from-rose-500 to-rose-600 text-white ' +
    'hover:from-rose-400 hover:to-rose-500 ' +
    'active:from-rose-600 active:to-rose-700 ' +
    'shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/30 ' +
    'focus:ring-rose-500/50 border border-rose-400/20',
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
