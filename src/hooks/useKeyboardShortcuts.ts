/**
 * TIM-218: Centralized keyboard shortcuts registry
 *
 * Provides a consistent way to register and manage global keyboard shortcuts.
 * Features:
 * - Registry pattern for easy shortcut management
 * - Automatic cleanup on unmount
 * - Modifier key normalization (Cmd/Ctrl)
 * - Input field detection (skips shortcuts when typing)
 */

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  /** Unique identifier for the shortcut */
  id: string;
  /** The key to listen for (e.g., 'k', 'Enter', 'ArrowDown') */
  key: string;
  /** Require Meta key (Cmd on Mac, Ctrl on Windows) */
  meta?: boolean;
  /** Require Ctrl key */
  ctrl?: boolean;
  /** Require Shift key */
  shift?: boolean;
  /** Require Alt/Option key */
  alt?: boolean;
  /** Handler function */
  handler: (e: KeyboardEvent) => void;
  /** Human-readable description */
  description?: string;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Whether to allow in input fields */
  allowInInput?: boolean;
}

type ShortcutRegistry = Map<string, KeyboardShortcut>;

// Global registry for all shortcuts
const globalRegistry: ShortcutRegistry = new Map();

/**
 * Check if an element is an input field
 */
const isInputElement = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
};

/**
 * Check if a shortcut matches the keyboard event
 */
const matchesShortcut = (shortcut: KeyboardShortcut, e: KeyboardEvent): boolean => {
  // Normalize key comparison (case-insensitive for letters)
  const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase();
  if (!keyMatches) return false;

  // Check modifiers - meta means Cmd on Mac, we also accept Ctrl for cross-platform
  const metaOrCtrl = e.metaKey || e.ctrlKey;
  if (shortcut.meta && !metaOrCtrl) return false;
  if (shortcut.ctrl && !e.ctrlKey) return false;
  if (shortcut.shift && !e.shiftKey) return false;
  if (shortcut.alt && !e.altKey) return false;

  // If shortcut doesn't require modifiers, make sure none are pressed
  // (except for special keys like arrows which work without modifiers)
  const isSpecialKey = [
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Enter',
    'Escape',
  ].includes(shortcut.key);
  if (!shortcut.meta && !shortcut.ctrl && !shortcut.shift && !shortcut.alt && !isSpecialKey) {
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
  }

  return true;
};

/**
 * Global keyboard event handler
 */
const handleGlobalKeyDown = (e: KeyboardEvent) => {
  for (const shortcut of globalRegistry.values()) {
    // Skip if in input and not explicitly allowed
    if (isInputElement(e.target) && !shortcut.allowInInput) {
      continue;
    }

    if (matchesShortcut(shortcut, e)) {
      if (shortcut.preventDefault !== false) {
        e.preventDefault();
      }
      shortcut.handler(e);
      return; // Only one shortcut per keypress
    }
  }
};

// Set up global listener once
let listenerAttached = false;
const ensureListener = () => {
  if (!listenerAttached) {
    window.addEventListener('keydown', handleGlobalKeyDown);
    listenerAttached = true;
  }
};

/**
 * Hook to register keyboard shortcuts
 *
 * @example
 * // Single shortcut
 * useKeyboardShortcuts([
 *   { id: 'open-settings', key: ',', meta: true, handler: () => setView('SETTINGS') }
 * ]);
 *
 * @example
 * // Multiple shortcuts
 * useKeyboardShortcuts([
 *   { id: 'cmd-k', key: 'k', meta: true, handler: openPalette },
 *   { id: 'escape', key: 'Escape', handler: closePalette },
 * ]);
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const registeredIds = useRef<string[]>([]);

  useEffect(() => {
    ensureListener();

    // Register all shortcuts
    shortcuts.forEach(shortcut => {
      globalRegistry.set(shortcut.id, shortcut);
      registeredIds.current.push(shortcut.id);
    });

    // Cleanup on unmount
    return () => {
      registeredIds.current.forEach(id => {
        globalRegistry.delete(id);
      });
      registeredIds.current = [];
    };
  }, [shortcuts]);
}

/**
 * Hook to register a single keyboard shortcut
 * Convenience wrapper for useKeyboardShortcuts
 */
export function useKeyboardShortcut(
  id: string,
  key: string,
  handler: (e: KeyboardEvent) => void,
  options: Omit<KeyboardShortcut, 'id' | 'key' | 'handler'> = {}
) {
  const shortcuts = useCallback(
    () => [{ id, key, handler, ...options }],
    [id, key, handler, options]
  );

  useKeyboardShortcuts(shortcuts());
}

/**
 * Get all registered shortcuts (for displaying in help)
 */
export function getRegisteredShortcuts(): KeyboardShortcut[] {
  return Array.from(globalRegistry.values());
}

/**
 * Format a shortcut for display
 * @example formatShortcut({ meta: true, key: 'k' }) => '⌘K'
 */
export function formatShortcut(
  shortcut: Pick<KeyboardShortcut, 'meta' | 'ctrl' | 'shift' | 'alt' | 'key'>
): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('⌃');
  if (shortcut.alt) parts.push('⌥');
  if (shortcut.shift) parts.push('⇧');
  if (shortcut.meta) parts.push('⌘');

  // Format key nicely
  let key = shortcut.key;
  if (key === 'ArrowUp') key = '↑';
  else if (key === 'ArrowDown') key = '↓';
  else if (key === 'ArrowLeft') key = '←';
  else if (key === 'ArrowRight') key = '→';
  else if (key === 'Enter') key = '↵';
  else if (key === 'Escape') key = 'Esc';
  else key = key.toUpperCase();

  parts.push(key);
  return parts.join('');
}
