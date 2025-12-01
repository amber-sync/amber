import React from 'react';

export type SectionHeaderVariant = 'panel' | 'form-label' | 'page';

interface SectionHeaderProps {
  variant?: SectionHeaderVariant;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'label' | 'span';
}

const variantStyles: Record<SectionHeaderVariant, string> = {
  panel: 'text-sm font-bold text-text-primary mb-4 flex items-center gap-2',
  'form-label': 'block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3',
  page: 'text-3xl font-bold text-text-primary tracking-tight',
};

const defaultTags: Record<SectionHeaderVariant, SectionHeaderProps['as']> = {
  panel: 'h3',
  'form-label': 'label',
  page: 'h1',
};

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  variant = 'panel',
  icon,
  children,
  className = '',
  as,
}) => {
  const Component = as || defaultTags[variant];
  const baseStyles = variantStyles[variant];

  // For panel variant with icon, wrap in flex container
  if (variant === 'panel' && icon) {
    return (
      <Component className={`${baseStyles} ${className}`.trim()}>
        {icon}
        {children}
      </Component>
    );
  }

  return <Component className={`${baseStyles} ${className}`.trim()}>{children}</Component>;
};
