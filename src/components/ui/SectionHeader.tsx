import React from 'react';

export type SectionHeaderVariant = 'panel' | 'form-label' | 'page';

type TagType = 'h1' | 'h2' | 'h3' | 'h4' | 'label' | 'span';

interface SectionHeaderProps {
  variant?: SectionHeaderVariant;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  as?: TagType;
}

const variantStyles: Record<SectionHeaderVariant, string> = {
  panel: 'text-heading-4 text-text-primary mb-4 flex items-center gap-2',
  'form-label': 'block text-label text-text-secondary mb-3',
  page: 'text-heading-1 text-text-primary',
};

const defaultTags: Record<SectionHeaderVariant, TagType> = {
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
  const Tag = as || defaultTags[variant];
  const baseStyles = variantStyles[variant];

  // For panel variant with icon, wrap in flex container
  if (variant === 'panel' && icon) {
    return (
      <Tag className={`${baseStyles} ${className}`.trim()}>
        {icon}
        {children}
      </Tag>
    );
  }

  return <Tag className={`${baseStyles} ${className}`.trim()}>{children}</Tag>;
};
