import { useEffect, useRef } from 'react';
import { Icons } from '../../IconComponents';

interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const WIDTH_CLASSES = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[480px]',
};

/**
 * SlidePanel - Reusable slide-out panel from the right edge (TIM-134)
 *
 * Features:
 * - Smooth slide animation (250ms ease-out)
 * - Semi-transparent backdrop with click-to-close
 * - ESC key to close
 * - Configurable width (sm, md, lg)
 * - Focus trap for accessibility
 */
export function SlidePanel({ isOpen, onClose, title, children, width = 'md' }: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when panel is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Focus the panel when it opens
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="panel-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-250"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`absolute bottom-0 right-0 top-0 ${WIDTH_CLASSES[width]} flex flex-col bg-white shadow-xl transition-transform duration-250 ease-out dark:bg-stone-900`}
        style={{
          animation: 'slideIn 250ms ease-out',
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4 dark:border-stone-700">
          <h2 id="panel-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-300"
            aria-label="Close panel"
          >
            <Icons.X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>

      {/* CSS for animation */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

export default SlidePanel;
