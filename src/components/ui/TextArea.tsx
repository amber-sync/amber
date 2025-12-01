import React, { forwardRef } from 'react';

export type TextAreaVariant = 'default' | 'mono';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: TextAreaVariant;
  error?: boolean;
}

const baseStyles =
  'w-full border border-border-base bg-layer-2 text-text-primary placeholder-text-tertiary ' +
  'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary ' +
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none';

const variantStyles: Record<TextAreaVariant, string> = {
  default: 'px-4 py-3 text-sm rounded-lg',
  mono: 'px-4 py-3 text-sm rounded-lg font-mono',
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ variant = 'default', error, className = '', ...props }, ref) => {
    const textareaStyles = `${baseStyles} ${variantStyles[variant]} ${
      error ? 'border-error focus:ring-error' : ''
    } ${className}`.trim();

    return <textarea ref={ref} className={textareaStyles} {...props} />;
  }
);

TextArea.displayName = 'TextArea';
