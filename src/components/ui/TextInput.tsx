import React, { forwardRef } from 'react';

export type TextInputVariant = 'default' | 'large' | 'mono';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: TextInputVariant;
  icon?: React.ReactNode;
  error?: boolean;
}

const baseStyles =
  'w-full border bg-stone-50 dark:bg-stone-900 ' +
  'border-stone-300 dark:border-stone-700 ' +
  'text-stone-900 dark:text-stone-100 ' +
  'placeholder-stone-400 dark:placeholder-stone-600 ' +
  'focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 ' +
  'transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ' +
  'hover:border-stone-400 dark:hover:border-stone-600';

const variantStyles: Record<TextInputVariant, string> = {
  default: 'px-4 py-2.5 text-sm rounded-lg',
  large: 'px-5 py-3.5 text-lg font-medium rounded-xl',
  mono: 'px-4 py-2.5 text-sm rounded-lg font-mono',
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ variant = 'default', icon, error, className = '', ...props }, ref) => {
    const inputStyles = `${baseStyles} ${variantStyles[variant]} ${
      error ? 'border-red-500 dark:border-red-400 focus:ring-red-500/30 focus:border-red-500' : ''
    } ${icon ? 'pl-10' : ''} ${className}`.trim();

    if (icon) {
      return (
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 dark:text-stone-400">
            {icon}
          </div>
          <input ref={ref} className={inputStyles} {...props} />
        </div>
      );
    }

    return <input ref={ref} className={inputStyles} {...props} />;
  }
);

TextInput.displayName = 'TextInput';
