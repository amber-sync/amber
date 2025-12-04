/**
 * PageHeader - Consistent page header component
 *
 * Provides standardized header styling across all views.
 */

import React from 'react';

interface PageHeaderProps {
  /** Main page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional right-side actions */
  actions?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className = '',
}) => {
  return (
    <header
      className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${className}`}
    >
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight font-display">
          {title}
        </h1>
        {subtitle && <p className="text-text-secondary mt-1 font-body">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
};

export default PageHeader;
