import React, { useEffect, useState } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  variant?: ToastVariant;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  onClose: (id: string) => void;
}

const baseStyles =
  'relative flex flex-col gap-1 w-full max-w-sm rounded-[var(--radius-lg)] border ' +
  'shadow-lg transition-all backdrop-blur-sm overflow-hidden';

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-layer-1/95 border-[var(--color-success)] shadow-[0_0_20px_rgba(16,185,129,0.15)]',
  error: 'bg-layer-1/95 border-[var(--color-error)] shadow-[0_0_20px_rgba(239,68,68,0.15)]',
  warning: 'bg-layer-1/95 border-[var(--color-warning)] shadow-[0_0_20px_rgba(245,158,11,0.15)]',
  info: 'bg-layer-1/95 border-[var(--color-info)] shadow-[0_0_20px_rgba(59,130,246,0.15)]',
};

const variantIconColors: Record<ToastVariant, string> = {
  success: 'text-[var(--color-success)]',
  error: 'text-[var(--color-error)]',
  warning: 'text-[var(--color-warning)]',
  info: 'text-[var(--color-info)]',
};

const variantAccentColors: Record<ToastVariant, string> = {
  success: 'bg-[var(--color-success)]',
  error: 'bg-[var(--color-error)]',
  warning: 'bg-[var(--color-warning)]',
  info: 'bg-[var(--color-info)]',
};

const icons: Record<ToastVariant, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

export const Toast: React.FC<ToastProps> = ({
  id,
  variant = 'info',
  title,
  message,
  action,
  duration = 5000,
  onClose,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration <= 0) return;

    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 16); // ~60fps

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(id), 300); // Match exit animation duration
    }, duration);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [duration, id, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 300);
  };

  const toastStyles = `${baseStyles} ${variantStyles[variant]} ${
    isExiting
      ? 'animate-[slideOut_0.3s_ease-in_forwards]'
      : 'animate-[slideIn_0.3s_ease-out_forwards]'
  }`.trim();

  return (
    <div className={toastStyles} role="alert" aria-live="assertive">
      {/* Progress bar */}
      {duration > 0 && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-border-base overflow-hidden">
          <div
            className={`h-full transition-all ${variantAccentColors[variant]}`}
            style={{
              width: `${progress}%`,
              transition: 'width 16ms linear',
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex items-start gap-3 p-4 pt-5">
        {/* Icon */}
        <div className={`flex-shrink-0 ${variantIconColors[variant]}`}>{icons[variant]}</div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary mb-0.5">{title}</h3>
          {message && <p className="text-xs text-text-secondary leading-snug">{message}</p>}
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-2 text-xs font-medium transition-colors hover:underline ${variantIconColors[variant]}`}
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="flex-shrink-0 text-text-tertiary hover:text-text-primary transition-colors p-1 -m-1 rounded-md hover:bg-layer-3"
          aria-label="Close notification"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

Toast.displayName = 'Toast';
