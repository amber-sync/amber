/**
 * PageHeader - Consistent page header component
 *
 * Provides standardized header styling across all views.
 */

import React from 'react';
import { Title, Body } from './Text';

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
        <Title level={1}>{title}</Title>
        {subtitle && (
          <Body color="secondary" className="mt-1">
            {subtitle}
          </Body>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
};

export default PageHeader;
