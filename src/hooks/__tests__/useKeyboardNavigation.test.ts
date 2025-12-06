import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardNavigation } from '../useKeyboardNavigation';

describe('useKeyboardNavigation', () => {
  const mockItems = ['item1', 'item2', 'item3', 'item4', 'item5'];
  let onSelectMock: (item: string, index: number) => void;
  let onCloseMock: () => void;
  let onOpenMock: () => void;

  beforeEach(() => {
    onSelectMock = vi.fn();
    onCloseMock = vi.fn();
    onOpenMock = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with selectedIndex at 0', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
        })
      );

      expect(result.current.selectedIndex).toBe(0);
    });

    it('should provide setSelectedIndex function', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
        })
      );

      expect(typeof result.current.setSelectedIndex).toBe('function');
    });

    it('should provide handleKeyDown function', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
        })
      );

      expect(typeof result.current.handleKeyDown).toBe('function');
    });
  });

  describe('arrow key navigation', () => {
    it('should increment selectedIndex on ArrowDown', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
        })
      );

      const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(result.current.selectedIndex).toBe(1);
    });

    it('should decrement selectedIndex on ArrowUp', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
        })
      );

      // First move down to index 2
      act(() => {
        result.current.setSelectedIndex(2);
      });

      const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(result.current.selectedIndex).toBe(1);
    });

    it('should not go below 0 when pressing ArrowUp at first item', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
        })
      );

      const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    it('should not exceed items.length - 1 when pressing ArrowDown at last item', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
        })
      );

      // Move to last item
      act(() => {
        result.current.setSelectedIndex(mockItems.length - 1);
      });

      const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(result.current.selectedIndex).toBe(mockItems.length - 1);
    });

    it('should not handle arrow keys when isOpen is false', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: false,
        })
      );

      const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('enter key selection', () => {
    it('should call onSelect with item and index when Enter is pressed', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
          onSelect: onSelectMock,
        })
      );

      act(() => {
        result.current.setSelectedIndex(2);
      });

      const keyEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(onSelectMock).toHaveBeenCalledWith('item3', 2);
    });

    it('should not call onSelect when no item is selected', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: [],
          isOpen: true,
          onSelect: onSelectMock,
        })
      );

      const keyEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(onSelectMock).not.toHaveBeenCalled();
    });

    it('should not call onSelect when isOpen is false', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: false,
          onSelect: onSelectMock,
        })
      );

      const keyEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(onSelectMock).not.toHaveBeenCalled();
    });
  });

  describe('escape key', () => {
    it('should call onClose when Escape is pressed', () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
          onClose: onCloseMock,
        })
      );

      const keyEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(onCloseMock).toHaveBeenCalled();
    });

    it('should not call onClose when isOpen is false', () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: false,
          onClose: onCloseMock,
        })
      );

      const keyEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  describe('open key shortcut', () => {
    it('should call onOpen when Cmd+openKey is pressed', () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: false,
          onOpen: onOpenMock,
          openKey: 'k',
        })
      );

      const keyEvent = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(onOpenMock).toHaveBeenCalled();
    });

    it('should call onOpen when Ctrl+openKey is pressed', () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: false,
          onOpen: onOpenMock,
          openKey: 'p',
        })
      );

      const keyEvent = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(onOpenMock).toHaveBeenCalled();
    });

    it('should reset selectedIndex to 0 when opening', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: false,
          onOpen: onOpenMock,
          openKey: 'k',
        })
      );

      // Set to a different index first
      act(() => {
        result.current.setSelectedIndex(3);
      });

      const keyEvent = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    it('should not call onOpen when openKey is not configured', () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: false,
          onOpen: onOpenMock,
        })
      );

      const keyEvent = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(onOpenMock).not.toHaveBeenCalled();
    });
  });

  describe('custom key handlers', () => {
    it('should call custom key handler when custom key is pressed', () => {
      const customHandler = vi.fn();
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
          customKeyHandlers: {
            Tab: customHandler,
          },
        })
      );

      const keyEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(customHandler).toHaveBeenCalledWith(keyEvent, 0);
    });

    it('should pass current selectedIndex to custom handler', () => {
      const customHandler = vi.fn();
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
          customKeyHandlers: {
            Tab: customHandler,
          },
        })
      );

      act(() => {
        result.current.setSelectedIndex(2);
      });

      const keyEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(customHandler).toHaveBeenCalledWith(keyEvent, 2);
    });

    it('should not call custom handler when isOpen is false', () => {
      const customHandler = vi.fn();
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: false,
          customKeyHandlers: {
            Tab: customHandler,
          },
        })
      );

      const keyEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      act(() => {
        window.dispatchEvent(keyEvent);
      });

      expect(customHandler).not.toHaveBeenCalled();
    });
  });

  describe('enabled flag', () => {
    it('should not handle any keys when enabled is false', () => {
      renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
          enabled: false,
          onSelect: onSelectMock,
          onClose: onCloseMock,
        })
      );

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      act(() => {
        window.dispatchEvent(enterEvent);
      });

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      act(() => {
        window.dispatchEvent(escapeEvent);
      });

      expect(onSelectMock).not.toHaveBeenCalled();
      expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('should not add event listener when enabled is false', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
          enabled: false,
        })
      );

      // Should not add listener when disabled
      expect(addEventListenerSpy).not.toHaveBeenCalled();

      unmount();

      // Should not remove listener when disabled
      expect(removeEventListenerSpy).not.toHaveBeenCalled();

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('items change', () => {
    it('should reset selectedIndex to 0 when items change', () => {
      const { result, rerender } = renderHook(
        ({ items }) =>
          useKeyboardNavigation({
            items,
            isOpen: true,
          }),
        {
          initialProps: { items: mockItems },
        }
      );

      // Move to index 3
      act(() => {
        result.current.setSelectedIndex(3);
      });

      expect(result.current.selectedIndex).toBe(3);

      // Change items
      const newItems = ['new1', 'new2'];
      rerender({ items: newItems });

      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('setSelectedIndex', () => {
    it('should update selectedIndex when called with a number', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
        })
      );

      act(() => {
        result.current.setSelectedIndex(3);
      });

      expect(result.current.selectedIndex).toBe(3);
    });

    it('should update selectedIndex when called with a function', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation({
          items: mockItems,
          isOpen: true,
        })
      );

      act(() => {
        result.current.setSelectedIndex(prev => prev + 2);
      });

      expect(result.current.selectedIndex).toBe(2);
    });
  });
});
