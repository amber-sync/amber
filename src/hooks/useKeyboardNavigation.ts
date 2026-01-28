/**
 * TIM-204: useKeyboardNavigation hook
 *
 * Reusable hook for keyboard navigation in lists, palettes, and menus.
 * Handles arrow key navigation, selection, and scroll-into-view behavior.
 */

import { useState, useEffect, useCallback, RefObject } from 'react';

export interface UseKeyboardNavigationOptions<T> {
  /** Array of items to navigate through */
  items: T[];

  /** Whether the component is currently active/open */
  isActive: boolean;

  /** Callback when an item is selected (Enter key) */
  onSelect?: (item: T, index: number, event: KeyboardEvent) => void;

  /** Callback when escape is pressed */
  onEscape?: () => void;

  /** Optional callback for custom key handling, return true to prevent default handling */
  onCustomKey?: (event: KeyboardEvent, selectedIndex: number) => boolean;

  /** Whether to loop navigation (go to first when at end, last when at start) */
  loop?: boolean;

  /** Ref to the list container for scroll-into-view behavior */
  listRef?: RefObject<HTMLElement>;

  /** Selector for the selected item element (for scroll-into-view) */
  selectedSelector?: string;

  /** Initial selected index */
  initialIndex?: number;

  /** Whether to reset index when items change */
  resetOnItemsChange?: boolean;
}

export interface UseKeyboardNavigationReturn<T> {
  /** Currently selected index */
  selectedIndex: number;

  /** Set the selected index manually (e.g., on mouse hover) */
  setSelectedIndex: (index: number) => void;

  /** Reset selection to initial index */
  resetSelection: () => void;

  /** Move selection to next item */
  selectNext: () => void;

  /** Move selection to previous item */
  selectPrevious: () => void;

  /** Select the first item */
  selectFirst: () => void;

  /** Select the last item */
  selectLast: () => void;

  /** Get the currently selected item */
  selectedItem: T | undefined;

  /** Check if an index is selected */
  isSelected: (index: number) => boolean;
}

export function useKeyboardNavigation<T>({
  items,
  isActive,
  onSelect,
  onEscape,
  onCustomKey,
  loop = false,
  listRef,
  selectedSelector = '[data-selected="true"]',
  initialIndex = 0,
  resetOnItemsChange = true,
}: UseKeyboardNavigationOptions<T>): UseKeyboardNavigationReturn<T> {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  // Reset selection when items change
  useEffect(() => {
    if (resetOnItemsChange) {
      setSelectedIndex(initialIndex);
    }
  }, [items.length, resetOnItemsChange, initialIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef?.current) {
      const selected = listRef.current.querySelector(selectedSelector);
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, listRef, selectedSelector]);

  const selectNext = useCallback(() => {
    setSelectedIndex(prev => {
      if (prev >= items.length - 1) {
        return loop ? 0 : prev;
      }
      return prev + 1;
    });
  }, [items.length, loop]);

  const selectPrevious = useCallback(() => {
    setSelectedIndex(prev => {
      if (prev <= 0) {
        return loop ? items.length - 1 : prev;
      }
      return prev - 1;
    });
  }, [items.length, loop]);

  const selectFirst = useCallback(() => {
    setSelectedIndex(0);
  }, []);

  const selectLast = useCallback(() => {
    setSelectedIndex(Math.max(0, items.length - 1));
  }, [items.length]);

  const resetSelection = useCallback(() => {
    setSelectedIndex(initialIndex);
  }, [initialIndex]);

  // Keyboard event handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive) return;

      // Allow custom key handling first
      if (onCustomKey?.(e, selectedIndex)) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectNext();
          break;

        case 'ArrowUp':
          e.preventDefault();
          selectPrevious();
          break;

        case 'Home':
          e.preventDefault();
          selectFirst();
          break;

        case 'End':
          e.preventDefault();
          selectLast();
          break;

        case 'Enter':
          e.preventDefault();
          if (items[selectedIndex] && onSelect) {
            onSelect(items[selectedIndex], selectedIndex, e);
          }
          break;

        case 'Escape':
          e.preventDefault();
          onEscape?.();
          break;
      }
    },
    [
      isActive,
      items,
      selectedIndex,
      onSelect,
      onEscape,
      onCustomKey,
      selectNext,
      selectPrevious,
      selectFirst,
      selectLast,
    ]
  );

  // Global keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const isSelected = useCallback((index: number) => index === selectedIndex, [selectedIndex]);

  return {
    selectedIndex,
    setSelectedIndex,
    resetSelection,
    selectNext,
    selectPrevious,
    selectFirst,
    selectLast,
    selectedItem: items[selectedIndex],
    isSelected,
  };
}
