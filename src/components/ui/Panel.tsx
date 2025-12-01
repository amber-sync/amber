import React from 'react';

export type PanelVariant = 'card' | 'form' | 'modal' | 'floating';

interface PanelProps {
  variant?: PanelVariant;
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

const variantStyles: Record<PanelVariant, string> = {
  card: 'bg-layer-1 border border-border-base rounded-xl p-5 shadow-sm',
  form: 'bg-layer-1 border border-border-base rounded-2xl p-6 shadow-sm',
  modal: 'bg-layer-1 border border-border-base rounded-3xl p-8 shadow-2xl',
  floating: 'bg-layer-1/90 backdrop-blur-sm border border-border-base rounded-2xl p-5 shadow-sm',
};

export const Panel: React.FC<PanelProps> = ({
  variant = 'card',
  children,
  className = '',
  as: Component = 'div',
}) => {
  const baseStyles = variantStyles[variant];

  return <Component className={`${baseStyles} ${className}`.trim()}>{children}</Component>;
};
