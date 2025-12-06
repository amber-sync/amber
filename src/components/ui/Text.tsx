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
 * STATUS MESSAGE - Alert boxes with icon + text
 * ======================================== */

export type StatusVariant = 'error' | 'warning' | 'success' | 'info';

export interface StatusMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Status variant determines color scheme */
  variant: StatusVariant;
  /** Show icon (default: true) */
  icon?: boolean;
  /** Size of the message */
  size?: 'sm' | 'base';
  /** Children content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

const statusStyles: Record<StatusVariant, { bg: string; border: string; text: string }> = {
  error: { bg: 'bg-error-subtle', border: 'border-error/30', text: 'text-error' },
  warning: { bg: 'bg-warning-subtle', border: 'border-warning/30', text: 'text-warning' },
  success: { bg: 'bg-success-subtle', border: 'border-success/30', text: 'text-success' },
  info: { bg: 'bg-info-subtle', border: 'border-info/30', text: 'text-info' },
};

export const StatusMessage = React.forwardRef<HTMLDivElement, StatusMessageProps>(
  ({ variant, icon = true, size = 'base', className = '', children, ...props }, ref) => {
    const styles = statusStyles[variant];
    const sizeClass = size === 'sm' ? 'text-body-sm' : 'text-body';

    const classes = [
      'px-3 py-2 rounded-lg border',
      styles.bg,
      styles.border,
      styles.text,
      sizeClass,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={classes} role="alert" {...props}>
        {children}
      </div>
    );
  }
);

StatusMessage.displayName = 'StatusMessage';

/* ========================================
 * FORM LABEL - Consistent form labels
 * ======================================== */

export interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Label size */
  size?: 'sm' | 'base';
  /** Required indicator */
  required?: boolean;
  /** Children content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ size = 'base', required, className = '', children, ...props }, ref) => {
    const sizeClass = size === 'sm' ? 'text-caption' : 'text-body-sm';

    const classes = [
      'block mb-2',
      sizeClass,
      'font-weight-medium',
      'text-text-secondary',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <label ref={ref} className={classes} {...props}>
        {children}
        {required && <span className="text-error ml-1">*</span>}
      </label>
    );
  }
);

FormLabel.displayName = 'FormLabel';

/* ========================================
 * EXPORT ALL
 * ======================================== */

export default { Title, Body, Caption, Code, StatusMessage, FormLabel };
