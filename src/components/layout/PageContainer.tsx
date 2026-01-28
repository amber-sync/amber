/**
 * PageContainer - Unified page layout wrapper
 *
 * Provides consistent sizing, padding, and scroll behavior across all views.
 * All pages should use this component to ensure visual consistency.
 *
 * Features:
 * - Consistent max-width control (default: 1280px, configurable)
 * - Consistent padding using --page-indent-* tokens
 * - Proper scroll containment to prevent expansion issues
 * - Optional header slot for page-level actions
 */

import React from 'react';
import { cn } from '../../utils';
import { Title, Body } from '../ui';

export type PageWidth = 'narrow' | 'default' | 'wide' | 'full';

export interface PageContainerProps {
  /** Page content */
  children: React.ReactNode;
  /** Max-width variant */
  width?: PageWidth;
  /** Whether content should scroll (default: true) */
  scrollable?: boolean;
  /** Use alternate background color */
  altBackground?: boolean;
  /** Enable entrance animation */
  animate?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Custom padding override */
  noPadding?: boolean;
}

const widthClasses: Record<PageWidth, string> = {
  narrow: 'max-w-[clamp(700px,75vw,900px)]',
  default: 'max-w-[clamp(900px,85vw,1400px)]',
  wide: 'max-w-[clamp(1100px,90vw,1700px)]',
  full: 'max-w-none',
};

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  width = 'default',
  scrollable = true,
  altBackground = false,
  animate = true,
  className,
  noPadding = false,
}) => {
  return (
    <div
      className={cn(
        // Base page styles - fill container with flex
        // min-h-0 is critical for scrollable flex children
        'flex-1 min-h-0 w-full relative flex flex-col',
        // Background
        altBackground ? 'bg-[var(--page-bg-alt)]' : 'bg-[var(--page-bg)]',
        // Scrolling behavior on outer container
        scrollable ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden',
        // Custom scrollbar
        scrollable && 'page-scroll',
        // Entrance animation
        animate && 'page-animate-in',
        className
      )}
    >
      <div
        className={cn(
          // Content wrapper with max-width constraint
          // flex-shrink-0 prevents content from collapsing
          'mx-auto w-full flex-shrink-0',
          // Width constraint
          widthClasses[width],
          // Padding using design tokens (unless noPadding)
          !noPadding && [
            'px-[var(--page-indent-left)]',
            'py-[var(--page-indent-top)]',
            'pr-[var(--page-indent-right)]',
            'pb-[var(--page-indent-bottom)]',
          ]
        )}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * PageHeader - Consistent header for page titles and actions
 */
export interface PageHeaderProps {
  /** Page title */
  title?: string;
  /** Subtitle/description */
  subtitle?: string;
  /** Right-side actions */
  actions?: React.ReactNode;
  /** Left-side content (before title) */
  leading?: React.ReactNode;
  /** Additional classes */
  className?: string;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  leading,
  className,
  children,
}) => {
  // If children provided, render them directly
  if (children) {
    return <div className={cn('mb-6', className)}>{children}</div>;
  }

  return (
    <div className={cn('flex items-center justify-between mb-6', className)}>
      <div className="flex items-center gap-4">
        {leading}
        {title && (
          <div>
            <Title level={1}>{title}</Title>
            {subtitle && (
              <Body size="sm" color="secondary" className="mt-0.5">
                {subtitle}
              </Body>
            )}
          </div>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
};

/**
 * PageSection - Consistent section wrapper with optional title
 */
export interface PageSectionProps {
  /** Section title */
  title?: string;
  /** Right-side content for section header */
  headerRight?: React.ReactNode;
  /** Section content */
  children: React.ReactNode;
  /** Additional classes */
  className?: string;
  /** Remove bottom margin */
  noMargin?: boolean;
}

export const PageSection: React.FC<PageSectionProps> = ({
  title,
  headerRight,
  children,
  className,
  noMargin = false,
}) => {
  return (
    <section className={cn(!noMargin && 'mb-6 last:mb-0', className)}>
      {(title || headerRight) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <Title level={4} color="tertiary" className="uppercase tracking-wider">
              {title}
            </Title>
          )}
          {headerRight}
        </div>
      )}
      {children}
    </section>
  );
};

/**
 * FullScreenContainer - For immersive full-screen views (e.g., TimeMachine)
 * Uses page background but allows full control over internal layout
 */
export interface FullScreenContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Use alternate background */
  altBackground?: boolean;
}

export const FullScreenContainer: React.FC<FullScreenContainerProps> = ({
  children,
  className,
  altBackground = false,
}) => {
  return (
    <div
      className={cn(
        'flex-1 h-full w-full flex flex-col',
        altBackground ? 'bg-[var(--page-bg-alt)]' : 'bg-[var(--page-bg)]',
        className
      )}
    >
      {children}
    </div>
  );
};

export default PageContainer;
