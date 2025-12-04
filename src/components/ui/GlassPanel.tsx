import React from 'react';

export type GlassPanelVariant = 'default' | 'elevated' | 'subtle';

interface GlassPanelProps {
  variant?: GlassPanelVariant;
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantStyles: Record<GlassPanelVariant, string> = {
  default:
    'bg-[var(--glass-bg)] backdrop-blur-xl ' +
    'border border-[var(--glass-border)] ' +
    'shadow-[var(--shadow-elevated)]',
  elevated:
    'bg-[var(--glass-bg-elevated)] backdrop-blur-2xl ' +
    'border border-[var(--glass-border)] ' +
    'shadow-[var(--shadow-float)] ' +
    'hover:shadow-[var(--shadow-float)] ' +
    'transition-shadow duration-200',
  subtle:
    'bg-[var(--glass-bg)] backdrop-blur-md ' +
    'border border-[var(--glass-border)] ' +
    'shadow-[var(--shadow-card)]',
};

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const GlassPanel: React.FC<GlassPanelProps> = ({
  variant = 'default',
  children,
  className = '',
  glow = false,
  padding = 'md',
}) => {
  const baseStyles = variantStyles[variant];
  const paddingStyle = paddingStyles[padding];
  const glowStyle = glow ? 'shadow-[var(--shadow-glow)]' : '';

  return (
    <div
      className={`rounded-2xl transition-all duration-normal ${baseStyles} ${paddingStyle} ${glowStyle} ${className}`.trim()}
    >
      {children}
    </div>
  );
};
