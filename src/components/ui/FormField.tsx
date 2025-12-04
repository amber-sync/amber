/**
 * FormField - Wrapper for form inputs with label, hint, and error
 *
 * TIM-144: Provides consistent form field layout across the app
 */

import React from 'react';

interface FormFieldProps {
  /** Field label */
  label?: string;
  /** Hint text shown below the input */
  hint?: string;
  /** Error message - shows in red, replaces hint */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** ID to associate label with input */
  htmlFor?: string;
  /** Additional class name */
  className?: string;
  /** The input element(s) */
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  hint,
  error,
  required,
  htmlFor,
  className = '',
  children,
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-text-primary flex items-center gap-1"
        >
          {label}
          {required && <span className="text-error">*</span>}
        </label>
      )}
      {children}
      {(error || hint) && (
        <p className={`text-xs ${error ? 'text-error' : 'text-text-tertiary'}`}>{error || hint}</p>
      )}
    </div>
  );
};
