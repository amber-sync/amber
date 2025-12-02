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
  default: 'bg-glass backdrop-blur-xl border border-glass-border',
  elevated: 'bg-glass-elevated backdrop-blur-2xl border border-glass-border shadow-elevated',
  subtle: 'bg-glass/50 backdrop-blur-md border border-glass-border/50',
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
