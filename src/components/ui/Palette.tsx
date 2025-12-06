/**
 * TIM-202: Palette base component
 * Reusable modal palette for command/search UIs
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { Icons } from '../IconComponents';

export interface KeyboardHint {
  keys: string[];
  label: string;
}

export interface PaletteProps {
  /** Whether the palette is open */
  isOpen: boolean;
  /** Called when the palette should close */
  onClose: () => void;
  /** Placeholder text for search input */
  placeholder?: string;
  /** Current search query */
  query: string;
  /** Called when search query changes */
  onQueryChange: (query: string) => void;
  /** Show loading spinner */
  isLoading?: boolean;
  /** Max width variant */
  size?: 'sm' | 'md' | 'lg';
  /** Keyboard hints to show in footer */
  keyboardHints?: KeyboardHint[];
  /** Content to render above the results (e.g., scope tabs) */
  header?: React.ReactNode;
  /** Results content */
  children: React.ReactNode;
  /** Reference to the results container for scroll-into-view */
  listRef?: React.RefObject<HTMLDivElement | null>;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
};

const defaultHints: KeyboardHint[] = [
  { keys: ['↑↓'], label: 'Navigate' },
  { keys: ['↵'], label: 'Select' },
  { keys: ['esc'], label: 'Close' },
];

export const Palette: React.FC<PaletteProps> = ({
  isOpen,
  onClose,
  placeholder = 'Search...',
  query,
  onQueryChange,
  isLoading = false,
  size = 'md',
  keyboardHints = defaultHints,
  header,
  children,
  listRef,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const internalListRef = useRef<HTMLDivElement>(null);
  const resultsRef = listRef || internalListRef;

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure animation has started
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-modal-backdrop animate-fade-in"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-modal flex items-start justify-center pt-[15vh]">
        <div
          className={`w-full ${sizeClasses[size]} bg-layer-1 rounded-xl shadow-2xl border border-border-base overflow-hidden animate-scale-in`}
          role="dialog"
          aria-modal="true"
        >
          {/* Search Input */}
          <div className="flex items-center px-4 border-b border-border-base">
            <Icons.Search className="w-5 h-5 text-text-tertiary flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3 py-4 bg-transparent text-text-primary placeholder-text-tertiary focus:outline-none text-base"
            />
            {isLoading && (
              <div className="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
            )}
            <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-layer-2 text-text-tertiary text-xs font-mono ml-2">
              ESC
            </kbd>
          </div>

          {/* Optional Header (e.g., scope tabs) */}
          {header}

          {/* Results Container */}
          <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto">
            {children}
          </div>

          {/* Footer with Keyboard Hints */}
          <div className="px-4 py-2 border-t border-border-base bg-layer-2/50 flex items-center gap-4 text-xs text-text-tertiary">
            {keyboardHints.map((hint, i) => (
              <span key={i} className="flex items-center gap-1">
                {hint.keys.map((key, j) => (
                  <kbd key={j} className="px-1.5 py-0.5 rounded bg-layer-3 font-mono">
                    {key}
                  </kbd>
                ))}
                {hint.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * Palette result section header
 */
export interface PaletteSectionProps {
  title: string;
  icon?: React.ReactNode;
}

export const PaletteSection: React.FC<PaletteSectionProps & { children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <div>
    <div className="px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider bg-layer-2/50 flex items-center gap-2">
      {icon && <span className="w-4 h-4 text-text-quaternary">{icon}</span>}
      {title}
    </div>
    {children}
  </div>
);

/**
 * Palette result item
 */
export interface PaletteItemProps {
  /** Icon to show */
  icon?: React.ReactNode;
  /** Primary text */
  title: string;
  /** Secondary text */
  description?: string;
  /** Right-aligned content (e.g., keyboard shortcut) */
  trailing?: React.ReactNode;
  /** Whether this item is selected */
  isSelected: boolean;
  /** Click handler */
  onClick: () => void;
  /** Mouse enter handler for hover selection */
  onMouseEnter?: () => void;
}

export const PaletteItem: React.FC<PaletteItemProps> = ({
  icon,
  title,
  description,
  trailing,
  isSelected,
  onClick,
  onMouseEnter,
}) => (
  <button
    data-selected={isSelected}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
      isSelected ? 'bg-accent-secondary/30' : 'hover:bg-layer-2'
    }`}
  >
    {icon && (
      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-text-secondary">
        {icon}
      </span>
    )}
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-text-primary truncate">{title}</div>
      {description && <div className="text-xs text-text-tertiary truncate">{description}</div>}
    </div>
    {trailing}
  </button>
);

/**
 * Empty state for when there are no results
 */
export const PaletteEmpty: React.FC<{ message: string }> = ({ message }) => (
  <div className="px-4 py-8 text-center text-text-tertiary">{message}</div>
);

export default Palette;
