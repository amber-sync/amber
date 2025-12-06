import React from 'react';
import { Icons } from '../IconComponents';
import { FormLabel } from './Text';

interface PathInputProps {
  value: string;
  onChange: (value: string) => void;
  onBrowse?: () => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const PathInput: React.FC<PathInputProps> = ({
  value,
  onChange,
  onBrowse,
  placeholder = '/path/to/folder',
  label,
  error,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <FormLabel className="text-xs font-bold uppercase tracking-wider">{label}</FormLabel>
      )}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary">
            <Icons.Folder size={18} />
          </div>
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            style={{ fontFamily: 'var(--font-sans)' }}
            className={`
              w-full pl-10 pr-4 py-3 rounded-xl text-sm
              bg-layer-2 border border-border-base text-text-primary
              placeholder-text-tertiary
              focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent
              transition-all duration-fast
              disabled:opacity-50 disabled:cursor-not-allowed
              ${error ? 'border-error focus:ring-error' : ''}
            `}
          />
        </div>
        {onBrowse && (
          <button
            type="button"
            onClick={onBrowse}
            disabled={disabled}
            className="px-4 py-3 rounded-xl bg-layer-2 border border-border-base text-text-secondary
              hover:bg-layer-3 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary
              transition-all duration-fast disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icons.FolderOpen size={20} />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
};
