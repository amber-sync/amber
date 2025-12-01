import React, { forwardRef } from 'react';

export type TextInputVariant = 'default' | 'large' | 'mono';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: TextInputVariant;
  icon?: React.ReactNode;
  error?: boolean;
}

const baseStyles =
  'w-full border border-border-base bg-layer-2 text-text-primary placeholder-text-tertiary ' +
  'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary ' +
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const variantStyles: Record<TextInputVariant, string> = {
  default: 'px-4 py-2.5 text-sm rounded-lg',
  large: 'px-5 py-3.5 text-lg font-medium rounded-xl',
  mono: 'px-4 py-2.5 text-sm rounded-lg font-mono',
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ variant = 'default', icon, error, className = '', ...props }, ref) => {
    const inputStyles = `${baseStyles} ${variantStyles[variant]} ${
      error ? 'border-error focus:ring-error' : ''
    } ${icon ? 'pl-10' : ''} ${className}`.trim();

    if (icon) {
      return (
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">{icon}</div>
          <input ref={ref} className={inputStyles} {...props} />
        </div>
      );
    }

    return <input ref={ref} className={inputStyles} {...props} />;
  }
);

TextInput.displayName = 'TextInput';
