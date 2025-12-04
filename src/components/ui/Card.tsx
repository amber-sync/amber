import React, { forwardRef } from 'react';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'interactive';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const baseStyles = 'rounded-[var(--card-radius)] transition-all';

const variantStyles: Record<CardVariant, string> = {
  default:
    'bg-layer-1 ' +
    'border border-border-base ' +
    'shadow-[var(--shadow-card)] ' +
    'hover:shadow-[var(--shadow-elevated)] ' +
    'hover:-translate-y-0.5 transition-all duration-200',
  elevated:
    'bg-layer-1 ' +
    'border border-border-base/50 ' +
    'shadow-[var(--shadow-elevated)] ' +
    'hover:shadow-[var(--shadow-float)] ' +
    'hover:-translate-y-1 transition-all duration-200',
  outlined:
    'bg-transparent border border-border-highlight ' +
    'hover:border-border-base ' +
    'hover:bg-layer-2/50 ' +
    'transition-all duration-200',
  interactive:
    'bg-layer-1 ' +
    'border border-border-base ' +
    'shadow-[var(--shadow-card)] ' +
    'cursor-pointer ' +
    'hover:border-border-highlight ' +
    'hover:shadow-[var(--shadow-elevated)] ' +
    'hover:bg-layer-2 ' +
    'hover:-translate-y-0.5 ' +
    'active:translate-y-0 active:shadow-[var(--shadow-card)] ' +
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
