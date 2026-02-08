import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast, ToastVariant } from '../components/ui/Toast';

interface ToastOptions {
  variant?: ToastVariant;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  maxToasts = 5,
  position = 'bottom-right',
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastItem = {
        id,
        variant: options.variant || 'info',
        ...options,
      };

      setToasts(prev => {
        const updated = [...prev, newToast];
        // Limit the number of toasts
        if (updated.length > maxToasts) {
          return updated.slice(updated.length - maxToasts);
        }
        return updated;
      });
    },
    [maxToasts]
  );

  const success = useCallback(
    (title: string, message?: string) => {
      toast({ variant: 'success', title, message });
    },
    [toast]
  );

  const error = useCallback(
    (title: string, message?: string) => {
      toast({ variant: 'error', title, message });
    },
    [toast]
  );

  const warning = useCallback(
    (title: string, message?: string) => {
      toast({ variant: 'warning', title, message });
    },
    [toast]
  );

  const info = useCallback(
    (title: string, message?: string) => {
      toast({ variant: 'info', title, message });
    },
    [toast]
  );

  const value: ToastContextValue = {
    toast,
    success,
    error,
    warning,
    info,
  };

  const positionStyles: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer
        toasts={toasts}
        removeToast={removeToast}
        position={positionStyles[position]}
      />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
  position: string;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast, position }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className={`fixed ${position} z-[var(--z-toast)] flex flex-col gap-3 pointer-events-none`}
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
    >
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            id={toast.id}
            variant={toast.variant}
            title={toast.title}
            message={toast.message}
            action={toast.action}
            duration={toast.duration}
            onClose={removeToast}
          />
        </div>
      ))}
    </div>
  );
};

// Add CSS animations to the global styles
// These should be added to your global CSS file or as a style tag
const toastAnimations = `
@keyframes slideIn {
  from {
    transform: translateX(calc(100% + 1rem));
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(calc(100% + 1rem));
    opacity: 0;
  }
}
`;

// Export animation styles for inclusion in global CSS
export { toastAnimations };
