/**
 * Text Component - Simplified Typography System
 *
 * A streamlined typography component with 4 semantic variants:
 * - Title: All headings (h1-h4)
 * - Body: Paragraph/span text (small, base, large)
 * - Caption: Small metadata (10px, 11px)
 * - Code: File paths and technical data (12px, 13px)
 *
 * @example
 * ```tsx
 * <Title level={1}>Page Title</Title>
 * <Body size="lg" color="secondary">Description text</Body>
 * <Caption size="sm" as="time">2 hours ago</Caption>
 * <Code truncate>/path/to/file</Code>
 * ```
 */

import React from 'react';

/* ========================================
 * TITLE COMPONENT - Headings (h1-h4)
 * ======================================== */

export interface TitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /**
   * Heading level (maps to h1-h4)
   * @default 1
   */
  level?: 1 | 2 | 3 | 4;

  /**
   * Text color from design system
   */
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success' | 'warning';

  /**
   * Enable text truncation with ellipsis
   */
  truncate?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Children content
   */
  children: React.ReactNode;
}

export const Title = React.forwardRef<HTMLHeadingElement, TitleProps>(
  ({ level = 1, color, truncate, className = '', children, ...props }, ref) => {
    // Map level to typography class
    const levelToClass = {
      1: 'text-heading-1',
      2: 'text-heading-2',
      3: 'text-heading-3',
      4: 'text-heading-4',
    };

    // Build class string
    const classes = [
      levelToClass[level],
      color && `text-${color}`,
      truncate && 'text-truncate',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    // Map level to HTML element
    const Tag = `h${level}` as const;

    return React.createElement(Tag, { ref, className: classes, ...props }, children);
  }
);

Title.displayName = 'Title';

/* ========================================
 * BODY COMPONENT - Paragraph/span text
 * ======================================== */

export interface BodyProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Text size
   * @default 'base'
   */
  size?: 'sm' | 'base' | 'lg';

  /**
   * Text color from design system
   */
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success' | 'warning';

  /**
   * Font weight
   */
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';

  /**
   * HTML element to render as
   * @default 'p'
   */
  as?: 'p' | 'span' | 'div' | 'label';

  /**
   * Enable text truncation with ellipsis
   */
  truncate?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Children content
   */
  children: React.ReactNode;
}

export const Body = React.forwardRef<HTMLElement, BodyProps>(
  (
    { size = 'base', color, weight, as = 'p', truncate, className = '', children, ...props },
    ref
  ) => {
    // Map size to typography class
    const sizeToClass = {
      sm: 'text-body-sm',
      base: 'text-body',
      lg: 'text-body-lg',
    };

    // Build class string
    const classes = [
      sizeToClass[size],
      color && `text-${color}`,
      weight && `font-weight-${weight}`,
      truncate && 'text-truncate',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return React.createElement(as, { ref, className: classes, ...props }, children);
  }
);

Body.displayName = 'Body';

/* ========================================
 * CAPTION COMPONENT - Small metadata
 * ======================================== */

export interface CaptionProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Caption size
   * @default 'base'
   */
  size?: 'sm' | 'base';

  /**
   * Text color from design system
   */
  color?: 'primary' | 'secondary' | 'tertiary' | 'quaternary';

  /**
   * HTML element to render as
   * @default 'span'
   */
  as?: 'span' | 'time' | 'small';

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Children content
   */
  children: React.ReactNode;
}

export const Caption = React.forwardRef<HTMLElement, CaptionProps>(
  ({ size = 'base', color, as = 'span', className = '', children, ...props }, ref) => {
    // Map size to typography class
    const sizeToClass = {
      sm: 'text-caption-sm',
      base: 'text-caption',
    };

    // Build class string
    const classes = [sizeToClass[size], color && `text-${color}`, className]
      .filter(Boolean)
      .join(' ');

    return React.createElement(as, { ref, className: classes, ...props }, children);
  }
);

Caption.displayName = 'Caption';

/* ========================================
 * CODE COMPONENT - File paths, technical data
 * ======================================== */

export interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Code size
   * @default 'base'
   */
  size?: 'sm' | 'base';

  /**
   * Text color from design system
   */
  color?: 'primary' | 'secondary';

  /**
   * Enable text truncation with ellipsis
   */
  truncate?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Children content
   */
  children: React.ReactNode;
}

export const Code = React.forwardRef<HTMLElement, CodeProps>(
  ({ size = 'base', color, truncate, className = '', children, ...props }, ref) => {
    // Map size to typography class
    const sizeToClass = {
      sm: 'text-code-sm',
      base: 'text-code',
    };

    // Build class string
    const classes = [
      sizeToClass[size],
      color && `text-${color}`,
      truncate && 'text-truncate',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return React.createElement('code', { ref, className: classes, ...props }, children);
  }
);

Code.displayName = 'Code';

/* ========================================
 * EXPORT ALL
 * ======================================== */

export default { Title, Body, Caption, Code };
