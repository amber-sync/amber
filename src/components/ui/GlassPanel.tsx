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
    'bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl ' +
    'border border-stone-200/50 dark:border-stone-700/30 ' +
    'shadow-lg shadow-stone-300/20 dark:shadow-stone-950/40',
  elevated:
    'bg-white/90 dark:bg-stone-800/90 backdrop-blur-2xl ' +
    'border border-stone-200/60 dark:border-stone-700/40 ' +
    'shadow-xl shadow-stone-400/25 dark:shadow-stone-950/50 ' +
    'hover:shadow-2xl hover:shadow-stone-400/30 dark:hover:shadow-stone-900/60 ' +
    'transition-shadow duration-200',
  subtle:
    'bg-white/60 dark:bg-stone-900/60 backdrop-blur-md ' +
    'border border-stone-200/30 dark:border-stone-700/20 ' +
    'shadow-md shadow-stone-300/15 dark:shadow-stone-950/30',
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
  const glowStyle = glow ? 'shadow-glow' : 'shadow-glass';

  return (
    <div
      className={`rounded-2xl transition-all duration-normal ${baseStyles} ${paddingStyle} ${glowStyle} ${className}`.trim()}
    >
      {children}
    </div>
  );
};
