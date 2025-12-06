import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { Caption, Code } from './ui';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  explanation?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'bash',
  title,
  explanation,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple syntax highlighting for bash/rsync commands
  const highlightCode = (text: string) => {
    // Split by spaces but preserve quoted strings
    const parts: React.ReactNode[] = [];
    const regex = /(--[\w-]+=?|"[^"]*"|'[^']*'|\{[^}]*\}|\S+)/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
      // Add any whitespace before this match
      if (match.index > lastIndex) {
        parts.push(<span key={`space-${key++}`}>{text.slice(lastIndex, match.index)}</span>);
      }

      const token = match[0];
      let className = 'text-primary';

      if (token.startsWith('--')) {
        // Flags
        className = 'text-[var(--color-info)] font-semibold';
      } else if (token.startsWith('"') || token.startsWith("'")) {
        // Strings
        className = 'text-[var(--color-success)]';
      } else if (token.startsWith('{') && token.endsWith('}')) {
        // Placeholders
        className = 'text-[var(--color-warning)] font-semibold';
      } else if (token === 'rsync' || token === 'ssh') {
        // Commands
        className = 'text-accent-primary font-bold';
      } else if (token.startsWith('-') && !token.startsWith('--')) {
        // Short flags
        className = 'text-[var(--color-info)] font-semibold';
      }

      parts.push(
        <span key={`token-${key++}`} className={className}>
          {token}
        </span>
      );

      lastIndex = match.index + token.length;
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(<span key={`trailing-${key++}`}>{text.slice(lastIndex)}</span>);
    }

    return parts;
  };

  return (
    <div className="bg-layer-2 border border-default rounded-xl overflow-hidden shadow-lg">
      {title && (
        <div className="bg-layer-1 px-4 py-2 border-b border-default flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.Terminal size={14} className="text-tertiary" />
            <Caption color="secondary" className="font-semibold">
              {title}
            </Caption>
          </div>
          <button
            onClick={handleCopy}
            className="text-xs text-tertiary hover:text-primary transition-colors flex items-center gap-1.5 px-2 py-1 rounded hover:bg-layer-2"
          >
            {copied ? (
              <>
                <Icons.Check size={12} />
                Copied
              </>
            ) : (
              <>
                <Icons.Copy size={12} />
                Copy
              </>
            )}
          </button>
        </div>
      )}
      <div className="p-4 font-mono text-sm overflow-x-auto">
        <code className="block whitespace-pre-wrap break-all">{highlightCode(code)}</code>
      </div>
      {explanation && (
        <div className="bg-layer-1 px-4 py-3 border-t border-default">
          <Caption color="tertiary" className="leading-relaxed">
            {explanation}
          </Caption>
        </div>
      )}
    </div>
  );
};
