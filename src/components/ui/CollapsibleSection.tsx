import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../IconComponents';

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isValid?: boolean;
  badge?: string;
  className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = false,
  isValid,
  badge,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    defaultOpen ? undefined : 0
  );
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  // Update height when children change
  useEffect(() => {
    if (isOpen && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children, isOpen]);

  return (
    <div
      className={`bg-layer-1 border border-border-base rounded-2xl overflow-hidden transition-all duration-normal ${isOpen ? 'shadow-card' : ''} ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-layer-2/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-text-secondary">{icon}</span>}
          <span className="font-semibold text-text-primary">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 text-2xs font-medium bg-layer-2 text-text-secondary rounded-full">
              {badge}
            </span>
          )}
          {isValid !== undefined && (
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${isValid ? 'bg-success/20 text-success' : 'bg-layer-2 text-text-tertiary'}`}
            >
              {isValid ? (
                <Icons.Check size={12} strokeWidth={3} />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
              )}
            </span>
          )}
        </div>
        <Icons.ChevronDown
          size={20}
          className={`text-text-tertiary transition-transform duration-normal ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        style={{ height: contentHeight }}
        className="overflow-hidden transition-all duration-normal ease-out"
      >
        <div ref={contentRef} className="px-6 pb-6 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
};
