import React, { useState } from 'react';
import * as Icons from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  explanation?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'bash', title, explanation }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple syntax highlighting for bash/rsync commands
  const highlightCode = (text: string) => {
    // Split by spaces but preserve quoted strings
    const parts: JSX.Element[] = [];
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
      let className = 'text-gray-800 dark:text-gray-200';

      if (token.startsWith('--')) {
        // Flags
        className = 'text-indigo-600 dark:text-indigo-400 font-semibold';
      } else if (token.startsWith('"') || token.startsWith("'")) {
        // Strings
        className = 'text-teal-600 dark:text-teal-400';
      } else if (token.startsWith('{') && token.endsWith('}')) {
        // Placeholders
        className = 'text-orange-600 dark:text-orange-400 font-semibold';
      } else if (token === 'rsync' || token === 'ssh') {
        // Commands
        className = 'text-purple-600 dark:text-purple-400 font-bold';
      } else if (token.startsWith('-') && !token.startsWith('--')) {
        // Short flags
        className = 'text-indigo-600 dark:text-indigo-400 font-semibold';
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
    <div className="bg-gray-900 dark:bg-black border border-gray-700 dark:border-gray-800 rounded-xl overflow-hidden shadow-lg">
      {title && (
        <div className="bg-gray-800 dark:bg-gray-900 px-4 py-2 border-b border-gray-700 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.Terminal size={14} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-300">{title}</span>
          </div>
          <button
            onClick={handleCopy}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-700"
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
        <code className="block whitespace-pre-wrap break-all">
          {highlightCode(code)}
        </code>
      </div>
      {explanation && (
        <div className="bg-gray-800 dark:bg-gray-900 px-4 py-3 border-t border-gray-700 dark:border-gray-800">
          <p className="text-xs text-gray-400 leading-relaxed">{explanation}</p>
        </div>
      )}
    </div>
  );
};
