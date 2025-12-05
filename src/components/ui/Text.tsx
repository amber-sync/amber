/**
 * Text Component - Semantic Typography
 *
 * A flexible typography component with semantic variants for consistent text rendering.
 * Uses the Amber typography system for accessibility and theme support.
 *
 * @example
 * ```tsx
 * <Text variant="heading-1">Page Title</Text>
 * <Text variant="body" color="secondary">Description text</Text>
 * <Text variant="caption" as="time">2 hours ago</Text>
 * <Text variant="code">/path/to/file</Text>
 * ```
 */

import React from 'react';

/* ========================================
 * TYPESCRIPT TYPES
 * ======================================== */

export type TypographyVariant =
  | 'display'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'body'
  | 'body-lg'
  | 'body-sm'
  | 'label'
  | 'label-normal'
  | 'caption'
  | 'caption-sm'
  | 'code'
  | 'code-sm'
  | 'ui'
  | 'ui-sm'
  | 'badge';

export type TextColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'quaternary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';

export type TextElement =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'p'
  | 'span'
  | 'div'
  | 'label'
  | 'time'
  | 'code'
  | 'small'
  | 'strong'
  | 'em';

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Semantic typography variant
   * @default 'body'
   */
  variant?: TypographyVariant;

  /**
   * Text color from design system
   * @default 'primary'
   */
  color?: TextColor;

  /**
   * Font weight override
   */
  weight?: TextWeight;

  /**
   * HTML element to render as
   * @default Auto-selected based on variant
   */
  as?: TextElement;

  /**
   * Enable text truncation with ellipsis
   */
  truncate?: boolean;

  /**
   * Number of lines to show before truncating
   */
  clamp?: 2 | 3;

  /**
   * Children content
   */
  children: React.ReactNode;
}

/* ========================================
 * VARIANT TO ELEMENT MAPPING
 * ======================================== */

const variantToElement: Record<TypographyVariant, TextElement> = {
  display: 'h1',
  'heading-1': 'h1',
  'heading-2': 'h2',
  'heading-3': 'h3',
  'heading-4': 'h4',
  body: 'p',
  'body-lg': 'p',
  'body-sm': 'p',
  label: 'label',
  'label-normal': 'label',
  caption: 'span',
  'caption-sm': 'span',
  code: 'code',
  'code-sm': 'code',
  ui: 'span',
  'ui-sm': 'span',
  badge: 'span',
};

/* ========================================
 * VARIANT TO CSS CLASS MAPPING
 * ======================================== */

const variantToClass: Record<TypographyVariant, string> = {
  display: 'text-display',
  'heading-1': 'text-heading-1',
  'heading-2': 'text-heading-2',
  'heading-3': 'text-heading-3',
  'heading-4': 'text-heading-4',
  body: 'text-body',
  'body-lg': 'text-body-lg',
  'body-sm': 'text-body-sm',
  label: 'text-label',
  'label-normal': 'text-label-normal',
  caption: 'text-caption',
  'caption-sm': 'text-caption-sm',
  code: 'text-code',
  'code-sm': 'text-code-sm',
  ui: 'text-ui',
  'ui-sm': 'text-ui-sm',
  badge: 'text-badge',
};

/* ========================================
 * TEXT COMPONENT
 * ======================================== */

export const Text = React.forwardRef<HTMLElement, TextProps>(
  (
    {
      variant = 'body',
      color,
      weight,
      as,
      className = '',
      truncate = false,
      clamp,
      children,
      ...props
    },
    ref
  ) => {
    // Determine the HTML element to render
    const elementTag = as || variantToElement[variant];

    // Build class string
    const classes = [
      variantToClass[variant],
      color && `text-${color}`,
      weight && `font-weight-${weight}`,
      truncate && 'text-truncate',
      clamp && `text-truncate-${clamp}`,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return React.createElement(elementTag, { ref, className: classes, ...props }, children);
  }
);

Text.displayName = 'Text';

/* ========================================
 * CONVENIENCE COMPONENTS
 * ======================================== */

/**
 * Display/Hero text component
 */
export const Display: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="display" {...props} />
);

/**
 * Heading components
 */
export const Heading1: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="heading-1" {...props} />
);

export const Heading2: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="heading-2" {...props} />
);

export const Heading3: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="heading-3" {...props} />
);

export const Heading4: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="heading-4" {...props} />
);

/**
 * Body text components
 */
export const Body: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="body" {...props} />
);

export const BodyLarge: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="body-lg" {...props} />
);

export const BodySmall: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="body-sm" {...props} />
);

/**
 * Label components
 */
export const Label: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="label" {...props} />
);

export const LabelNormal: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="label-normal" {...props} />
);

/**
 * Caption components
 */
export const Caption: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="caption" {...props} />
);

export const CaptionSmall: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="caption-sm" {...props} />
);

/**
 * Code/mono components
 */
export const Code: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="code" {...props} />
);

export const CodeSmall: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="code-sm" {...props} />
);

/**
 * UI text components
 */
export const UIText: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="ui" {...props} />
);

export const UITextSmall: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="ui-sm" {...props} />
);

/**
 * Badge text component
 */
export const BadgeText: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="badge" {...props} />
);

/* ========================================
 * SPECIALIZED COMPONENTS
 * ======================================== */

/**
 * Page title with consistent styling
 */
export const PageTitle: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="heading-1" color="primary" {...props} />
);

/**
 * Section title with consistent styling
 */
export const SectionTitle: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="heading-2" color="primary" {...props} />
);

/**
 * Card title with consistent styling
 */
export const CardTitle: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="heading-3" color="primary" {...props} />
);

/**
 * Form label with consistent styling
 */
export const FormLabel: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="label" color="secondary" as="label" {...props} />
);

/**
 * Help text with consistent styling
 */
export const HelpText: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="caption" color="tertiary" {...props} />
);

/**
 * File path with monospace font and truncation
 */
export const FilePath: React.FC<Omit<TextProps, 'variant' | 'truncate'>> = props => (
  <Text variant="code" color="secondary" truncate {...props} />
);

/**
 * Timestamp with consistent styling
 */
export const Timestamp: React.FC<Omit<TextProps, 'variant'>> = props => (
  <Text variant="caption" color="quaternary" as="time" {...props} />
);

/**
 * Error message with consistent styling
 */
export const ErrorMessage: React.FC<Omit<TextProps, 'variant' | 'color'>> = props => (
  <Text variant="body-sm" color="error" {...props} />
);

/**
 * Success message with consistent styling
 */
export const SuccessMessage: React.FC<Omit<TextProps, 'variant' | 'color'>> = props => (
  <Text variant="body-sm" color="success" {...props} />
);

/**
 * Warning message with consistent styling
 */
export const WarningMessage: React.FC<Omit<TextProps, 'variant' | 'color'>> = props => (
  <Text variant="body-sm" color="warning" {...props} />
);

/* ========================================
 * EXPORT ALL
 * ======================================== */

export default Text;
