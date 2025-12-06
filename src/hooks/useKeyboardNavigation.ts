import { useState, useCallback, useEffect } from 'react';

/**
 * Options for configuring keyboard navigation behavior
 */
export interface UseKeyboardNavigationOptions<T> {
  /** Array of items to navigate through */
  items: T[];
  /** Whether the navigation component is currently open */
  isOpen: boolean;
  /** Callback when an item is selected (Enter key) */
  onSelect?: (item: T, index: number) => void;
  /** Callback when the component should close (Escape key) */
  onClose?: () => void;
  /** Callback when the component should open (Cmd/Ctrl + openKey) */
  onOpen?: () => void;
  /** Key to use for opening (combined with Cmd/Ctrl), e.g., 'k' for Cmd+K */
  openKey?: string;
  /** Whether keyboard navigation is enabled */
  enabled?: boolean;
  /** Additional custom key handlers */
  customKeyHandlers?: Record<string, (e: KeyboardEvent, selectedIndex: number) => void>;
}

/**
 * Return value from useKeyboardNavigation hook
 */
export interface UseKeyboardNavigationReturn {
  /** Currently selected index */
  selectedIndex: number;
  /** Function to update the selected index */
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
  /** Key down handler to attach to window or component */
  handleKeyDown: (e: KeyboardEvent) => void;
}

/**
 * Reusable hook for keyboard navigation in list-based UIs
 *
 * Provides arrow key navigation, Enter to select, Escape to close,
 * and optional Cmd/Ctrl+Key to open the component.
 *
 * @example
 * ```tsx
 * const { selectedIndex, handleKeyDown } = useKeyboardNavigation({
 *   items: filteredItems,
 *   isOpen,
 *   onSelect: (item) => handleSelect(item),
 *   onClose: () => setIsOpen(false),
 *   onOpen: () => setIsOpen(true),
 *   openKey: 'k', // Cmd+K to open
 * });
 * ```
 */
export function useKeyboardNavigation<T>({
  items,
  isOpen,
  onSelect,
  onClose,
  onOpen,
  openKey,
  enabled = true,
  customKeyHandlers = {},
}: UseKeyboardNavigationOptions<T>): UseKeyboardNavigationReturn {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Keyboard event handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Handle open key (e.g., Cmd+K)
      if (openKey && (e.metaKey || e.ctrlKey) && e.key === openKey) {
        e.preventDefault();
        if (onOpen) {
          onOpen();
        }
        setSelectedIndex(0);
        return;
      }

      // Only handle navigation keys when open
      if (!isOpen) return;

      // Handle custom keys first
      if (customKeyHandlers[e.key]) {
        customKeyHandlers[e.key](e, selectedIndex);
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          if (onClose) {
            onClose();
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;

        case 'Enter':
          e.preventDefault();
          if (onSelect && items[selectedIndex] !== undefined) {
            onSelect(items[selectedIndex], selectedIndex);
          }
          break;
      }
    },
    [enabled, isOpen, items, selectedIndex, onSelect, onClose, onOpen, openKey, customKeyHandlers]
  );

  // Attach global keyboard listener
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
  };
}
