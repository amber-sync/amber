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
  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-amber-500/50 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'active:scale-[0.95] transform';

const variantStyles: Record<IconButtonVariant, string> = {
  default:
    'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-600 ' +
    'hover:bg-stone-200 dark:hover:bg-stone-700 hover:text-stone-900 dark:hover:text-stone-100 hover:border-stone-400 dark:hover:border-stone-500 ' +
    'active:bg-stone-300 dark:active:bg-stone-600',
  ghost:
    'bg-transparent text-stone-500 dark:text-stone-400 ' +
    'hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 ' +
    'active:bg-stone-200 dark:active:bg-stone-700',
  danger:
    'bg-transparent text-stone-500 dark:text-stone-400 ' +
    'hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 ' +
    'active:bg-rose-100 dark:active:bg-rose-950/50 active:text-rose-700 dark:active:text-rose-300',
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
