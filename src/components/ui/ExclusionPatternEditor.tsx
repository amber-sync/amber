/**
 * TIM-208: Reusable exclusion pattern editor
 * Allows adding/removing glob-style patterns for file exclusions
 */

import React, { useState, useCallback } from 'react';
import { Icons } from '../IconComponents';
import { TextInput } from './TextInput';

export interface ExclusionPatternEditorProps {
  /** Current list of patterns */
  patterns: string[];
  /** Called when patterns change */
  onChange: (patterns: string[]) => void;
  /** Placeholder text for input */
  placeholder?: string;
  /** Max number of patterns allowed (0 = unlimited) */
  maxPatterns?: number;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Preset suggestions to show */
  suggestions?: string[];
}

/** Common exclusion pattern presets */
export const COMMON_PATTERNS = {
  system: ['.DS_Store', 'Thumbs.db', 'desktop.ini'],
  logs: ['*.log', '*.log.*', 'logs/'],
  temp: ['*.tmp', '*.temp', '.cache/', 'tmp/'],
  nodeModules: ['node_modules/', '.npm/', '.yarn/'],
  git: ['.git/', '.gitignore'],
  build: ['dist/', 'build/', 'out/', '*.min.js', '*.min.css'],
  ide: ['.idea/', '.vscode/', '*.swp', '*.swo'],
};

export const ExclusionPatternEditor: React.FC<ExclusionPatternEditorProps> = ({
  patterns,
  onChange,
  placeholder = 'Add pattern (e.g. *.log)',
  maxPatterns = 0,
  disabled = false,
  suggestions = [],
}) => {
  const [inputValue, setInputValue] = useState('');

  const addPattern = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (patterns.includes(trimmed)) return; // No duplicates
    if (maxPatterns > 0 && patterns.length >= maxPatterns) return;

    onChange([...patterns, trimmed]);
    setInputValue('');
  }, [inputValue, patterns, onChange, maxPatterns]);

  const removePattern = useCallback(
    (index: number) => {
      onChange(patterns.filter((_, i) => i !== index));
    },
    [patterns, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPattern();
    }
    // Backspace on empty input removes last pattern
    if (e.key === 'Backspace' && !inputValue && patterns.length > 0) {
      removePattern(patterns.length - 1);
    }
  };

  const addSuggestion = (pattern: string) => {
    if (patterns.includes(pattern)) return;
    if (maxPatterns > 0 && patterns.length >= maxPatterns) return;
    onChange([...patterns, pattern]);
  };

  const availableSuggestions = suggestions.filter(s => !patterns.includes(s));
  const canAddMore = maxPatterns === 0 || patterns.length < maxPatterns;

  return (
    <div className="space-y-3">
      {/* Input row */}
      <div className="flex gap-2">
        <TextInput
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || !canAddMore}
          className="flex-1"
        />
        <button
          type="button"
          onClick={addPattern}
          disabled={disabled || !inputValue.trim() || !canAddMore}
          className="px-3 bg-layer-2 hover:bg-layer-3 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-text-secondary transition-colors"
          aria-label="Add pattern"
        >
          <Icons.Plus size={18} />
        </button>
      </div>

      {/* Pattern tags */}
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {patterns.map((pattern, index) => (
          <span
            key={`${pattern}-${index}`}
            className="bg-layer-1 px-2.5 py-1 rounded-md text-sm font-medium text-text-secondary flex items-center gap-1.5 border border-border-base group"
          >
            <code className="text-xs">{pattern}</code>
            <button
              type="button"
              onClick={() => removePattern(index)}
              disabled={disabled}
              className="hover:text-error text-text-tertiary disabled:cursor-not-allowed transition-colors"
              aria-label={`Remove ${pattern}`}
            >
              <Icons.X size={12} />
            </button>
          </span>
        ))}
        {patterns.length === 0 && (
          <span className="text-sm text-text-tertiary italic">No patterns</span>
        )}
      </div>

      {/* Suggestions */}
      {availableSuggestions.length > 0 && canAddMore && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-text-tertiary mr-1">Suggestions:</span>
          {availableSuggestions.slice(0, 5).map(suggestion => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addSuggestion(suggestion)}
              disabled={disabled}
              className="px-2 py-0.5 text-xs bg-layer-2 hover:bg-accent-primary/20 rounded text-text-tertiary hover:text-accent-primary transition-colors disabled:cursor-not-allowed"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Max patterns indicator */}
      {maxPatterns > 0 && (
        <div className="text-xs text-text-quaternary">
          {patterns.length} / {maxPatterns} patterns
        </div>
      )}
    </div>
  );
};

export default ExclusionPatternEditor;
