import React, { forwardRef } from 'react';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'interactive';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const baseStyles = 'rounded-[var(--card-radius)] transition-all';

const variantStyles: Record<CardVariant, string> = {
  default:
    'bg-gradient-to-b from-white to-stone-50 dark:from-stone-900 dark:to-stone-950 ' +
    'border border-stone-200 dark:border-stone-800 ' +
    'shadow-sm shadow-stone-200/50 dark:shadow-stone-950/50 ' +
    'hover:shadow-md hover:shadow-stone-300/50 dark:hover:shadow-stone-900/50 ' +
    'hover:-translate-y-0.5 transition-all duration-200',
  elevated:
    'bg-gradient-to-b from-white to-stone-50 dark:from-stone-800 dark:to-stone-900 ' +
    'border border-stone-200/50 dark:border-stone-700/50 ' +
    'shadow-lg shadow-stone-300/30 dark:shadow-stone-950/50 ' +
    'hover:shadow-xl hover:shadow-stone-400/30 dark:hover:shadow-stone-900/60 ' +
    'hover:-translate-y-1 transition-all duration-200',
  outlined:
    'bg-transparent border border-stone-300 dark:border-stone-700 ' +
    'hover:border-stone-400 dark:hover:border-stone-600 ' +
    'hover:bg-stone-50/50 dark:hover:bg-stone-900/50 ' +
    'transition-all duration-200',
  interactive:
    'bg-gradient-to-b from-white to-stone-50 dark:from-stone-900 dark:to-stone-950 ' +
    'border border-stone-200 dark:border-stone-800 ' +
    'shadow-sm shadow-stone-200/50 dark:shadow-stone-950/50 ' +
    'cursor-pointer ' +
    'hover:border-amber-600/30 dark:hover:border-amber-500/30 ' +
    'hover:shadow-lg hover:shadow-amber-100/20 dark:hover:shadow-amber-900/20 ' +
    'hover:bg-gradient-to-b hover:from-stone-50 hover:to-white dark:hover:from-stone-850 dark:hover:to-stone-900 ' +
    'hover:-translate-y-0.5 ' +
    'active:translate-y-0 active:shadow-md ' +
    'transition-all duration-200',
};

const paddingStyles: Record<'none' | 'sm' | 'md' | 'lg', string> = {
  none: '',
  sm: 'p-3',
  md: 'p-[var(--card-padding)]',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className = '', children, ...props }, ref) => {
    const cardStyles =
      `${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`.trim();

    return (
      <div ref={ref} className={cardStyles} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
