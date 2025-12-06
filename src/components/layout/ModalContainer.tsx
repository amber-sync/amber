/**
 * ModalContainer - Unified modal/popup wrapper
 *
 * Provides consistent sizing and behavior for all modal dialogs.
 * Ensures modals respect page bounds and have consistent styling.
 *
 * Features:
 * - Consistent max-width control (default: 1024px / 5xl)
 * - Consistent max-height (85% of viewport)
 * - Backdrop blur and overlay
 * - Entrance/exit animations
 * - Proper z-index layering
 */

import React, { useEffect, useCallback } from 'react';
import { cn } from '../../utils';
import { Title, Caption } from '../ui';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalContainerProps {
  /** Modal content */
  children: React.ReactNode;
  /** Whether modal is visible */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Size variant */
  size?: ModalSize;
  /** Custom max-height (default: 85vh) */
  maxHeight?: string;
  /** Show close button in corner */
  showCloseButton?: boolean;
  /** Close on backdrop click (default: true) */
  closeOnBackdrop?: boolean;
  /** Close on escape key (default: true) */
  closeOnEscape?: boolean;
  /** Additional classes for the modal panel */
  className?: string;
  /** Additional classes for the backdrop */
  backdropClassName?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-md', // 448px
  md: 'max-w-2xl', // 672px
  lg: 'max-w-4xl', // 896px
  xl: 'max-w-5xl', // 1024px
  full: 'max-w-[95vw]',
};

export const ModalContainer: React.FC<ModalContainerProps> = ({
  children,
  isOpen,
  onClose,
  size = 'xl',
  maxHeight = '85vh',
  showCloseButton = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className,
  backdropClassName,
}) => {
  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        // Overlay positioning
        'fixed inset-0 z-50',
        // Flex centering
        'flex items-center justify-center',
        // Backdrop
        'bg-black/60 backdrop-blur-sm',
        // Animation
        'animate-fade-in',
        backdropClassName
      )}
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          // Base modal styles
          'relative w-full',
          // Size constraint
          sizeClasses[size],
          // Background and border
          'bg-layer-1 rounded-2xl',
          'border border-border-base',
          'shadow-float',
          // Flex column for internal layout
          'flex flex-col',
          // Overflow handling
          'overflow-hidden',
          // Animation
          'animate-scale-in',
          className
        )}
        style={{ maxHeight }}
        onClick={e => e.stopPropagation()}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-layer-2 transition-colors"
            aria-label="Close modal"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        {children}
      </div>
    </div>
  );
};

/**
 * ModalHeader - Consistent header for modal dialogs
 */
export interface ModalHeaderProps {
  /** Header title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Leading icon or content */
  icon?: React.ReactNode;
  /** Close handler (shows X button if provided) */
  onClose?: () => void;
  /** Additional classes */
  className?: string;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  subtitle,
  icon,
  onClose,
  className,
}) => {
  return (
    <div
      className={cn(
        'px-6 py-4 border-b border-border-base',
        'flex items-center justify-between',
        'bg-gradient-surface',
        'flex-shrink-0',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center text-white">
            {icon}
          </div>
        )}
        <div>
          <Title level={4}>{title}</Title>
          {subtitle && <Caption color="secondary">{subtitle}</Caption>}
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-layer-2 transition-colors"
          aria-label="Close"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

/**
 * ModalBody - Scrollable content area for modals
 */
export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
  /** Disable padding */
  noPadding?: boolean;
}

export const ModalBody: React.FC<ModalBodyProps> = ({ children, className, noPadding = false }) => {
  return (
    <div className={cn('flex-1 overflow-y-auto', !noPadding && 'p-6', className)}>{children}</div>
  );
};

/**
 * ModalFooter - Action buttons area for modals
 */
export interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
  /** Left-aligned content (e.g., delete button) */
  leftContent?: React.ReactNode;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className, leftContent }) => {
  return (
    <div
      className={cn(
        'px-6 py-4 border-t border-border-base',
        'flex items-center justify-between',
        'bg-layer-2',
        'flex-shrink-0',
        className
      )}
    >
      <div>{leftContent}</div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
};

export default ModalContainer;
