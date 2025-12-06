import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { Icons } from './IconComponents';
interface Command {
  id: string;
  title: string;
  description?: string;
  category: 'navigation' | 'jobs' | 'actions' | 'theme';
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

// Simple fuzzy search
function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (!q) return { match: true, score: 1 };
  if (t.includes(q)) return { match: true, score: 0.9 };

  let qIdx = 0;
  let score = 0;
  let consecutive = 0;

  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      qIdx++;
      consecutive++;
      score += consecutive;
    } else {
      consecutive = 0;
    }
  }

  return { match: qIdx === q.length, score: score / q.length };
}

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { jobs, setView, setActiveJobId, runSync } = useApp();
  const { theme, setTheme, isDark } = useTheme();

  // Build command list
  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [];

    // Navigation commands
    cmds.push({
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      description: 'View all backup jobs',
      category: 'navigation',
      icon: <Icons.Home className="w-4 h-4" />,
      action: () => {
        setView('DASHBOARD');
        setIsOpen(false);
      },
    });

    cmds.push({
      id: 'nav-settings',
      title: 'Go to Settings',
      description: 'Configure app preferences',
      category: 'navigation',
      icon: <Icons.Settings className="w-4 h-4" />,
      action: () => {
        setView('APP_SETTINGS');
        setIsOpen(false);
      },
    });

    cmds.push({
      id: 'nav-help',
      title: 'Go to Help',
      description: 'View documentation',
      category: 'navigation',
      icon: <Icons.HelpCircle className="w-4 h-4" />,
      action: () => {
        setView('HELP');
        setIsOpen(false);
      },
    });

    cmds.push({
      id: 'nav-time-machine',
      title: 'Open TimeMachine',
      description: 'Browse snapshots and restore files',
      category: 'navigation',
      icon: <Icons.Clock className="w-4 h-4" />,
      action: () => {
        setView('TIME_MACHINE');
        setIsOpen(false);
      },
    });

    cmds.push({
      id: 'create-job',
      title: 'Create New Job',
      description: 'Set up a new backup job',
      category: 'jobs',
      icon: <Icons.Plus className="w-4 h-4" />,
      action: () => {
        setActiveJobId(null);
        setView('JOB_EDITOR');
        setIsOpen(false);
      },
    });

    // Job-specific commands
    jobs.forEach(job => {
      cmds.push({
        id: `run-${job.id}`,
        title: `Run ${job.name}`,
        description: `Start backup for ${job.sourcePath}`,
        category: 'jobs',
        icon: <Icons.Play className="w-4 h-4" />,
        action: () => {
          runSync(job.id);
          setIsOpen(false);
        },
      });

      cmds.push({
        id: `edit-${job.id}`,
        title: `Edit ${job.name}`,
        description: 'Modify job settings',
        category: 'jobs',
        icon: <Icons.Edit className="w-4 h-4" />,
        action: () => {
          setActiveJobId(job.id);
          setView('JOB_EDITOR');
          setIsOpen(false);
        },
      });

      cmds.push({
        id: `view-${job.id}`,
        title: `View ${job.name}`,
        description: 'See job details and history',
        category: 'jobs',
        icon: <Icons.Eye className="w-4 h-4" />,
        action: () => {
          setActiveJobId(job.id);
          setView('TIME_MACHINE');
          setIsOpen(false);
        },
      });
    });

    // Theme commands - only light, dark, system
    const themes: { id: 'light' | 'dark' | 'system'; name: string; description: string }[] = [
      { id: 'system', name: 'System', description: 'Follow system appearance' },
      { id: 'light', name: 'Light', description: 'Light appearance' },
      { id: 'dark', name: 'Dark', description: 'Dark appearance' },
    ];

    themes.forEach(t => {
      cmds.push({
        id: `theme-${t.id}`,
        title: `Set ${t.name} Theme`,
        description: t.description,
        category: 'theme',
        icon: <Icons.Palette className="w-4 h-4" />,
        action: () => {
          setTheme(t.id);
          setIsOpen(false);
        },
      });
    });

    // Action commands
    cmds.push({
      id: 'toggle-theme',
      title: 'Toggle Theme',
      description: 'Switch between light and dark',
      category: 'actions',
      icon: <Icons.Moon className="w-4 h-4" />,
      shortcut: '⌘T',
      action: () => {
        // Toggle between light and dark, skipping system
        setTheme(theme === 'dark' || (theme === 'system' && isDark) ? 'light' : 'dark');
        setIsOpen(false);
      },
    });

    return cmds;
  }, [jobs, theme, isDark, setView, setActiveJobId, setTheme, runSync]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    return commands
      .map(cmd => {
        const titleMatch = fuzzyMatch(query, cmd.title);
        const descMatch = cmd.description
          ? fuzzyMatch(query, cmd.description)
          : { match: false, score: 0 };
        const bestScore = Math.max(
          titleMatch.match ? titleMatch.score : 0,
          descMatch.match ? descMatch.score : 0
        );
        return { cmd, match: titleMatch.match || descMatch.match, score: bestScore };
      })
      .filter(item => item.match)
      .sort((a, b) => b.score - a.score)
      .map(item => item.cmd);
  }, [commands, query]);

  // Group by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Open palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setQuery('');
        setSelectedIndex(0);
        return;
      }

      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
      }
    },
    [isOpen, filteredCommands, selectedIndex]
  );

  // Global keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    jobs: 'Jobs',
    actions: 'Actions',
    theme: 'Themes',
  };

  let flatIndex = -1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-modal-backdrop animate-fade-in"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div className="fixed inset-0 z-modal flex items-start justify-center pt-[15vh]">
        <div className="w-full max-w-xl bg-layer-1 rounded-xl shadow-2xl border border-border-base overflow-hidden animate-scale-in">
          {/* Search Input */}
          <div className="flex items-center px-4 border-b border-border-base">
            <Icons.Search className="w-5 h-5 text-text-tertiary flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search commands..."
              className="flex-1 px-3 py-4 bg-transparent text-text-primary placeholder-text-tertiary focus:outline-none text-base"
            />
            <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-layer-2 text-text-tertiary text-xs font-mono">
              ESC
            </kbd>
          </div>

          {/* Command List */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
            {Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category}>
                <div className="px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider bg-layer-2/50">
                  {categoryLabels[category] || category}
                </div>
                {cmds.map(cmd => {
                  flatIndex++;
                  const isSelected = flatIndex === selectedIndex;

                  return (
                    <button
                      key={cmd.id}
                      data-selected={isSelected}
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setSelectedIndex(flatIndex)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isSelected ? 'bg-accent-secondary/30' : 'hover:bg-layer-2'
                      }`}
                    >
                      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-text-secondary">
                        {cmd.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-primary truncate">
                          {cmd.title}
                        </div>
                        {cmd.description && (
                          <div className="text-xs text-text-tertiary truncate">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd className="flex-shrink-0 px-2 py-0.5 rounded bg-layer-2 text-text-tertiary text-xs font-mono">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {filteredCommands.length === 0 && (
              <div className="px-4 py-8 text-center text-text-tertiary">
                No commands found for "{query}"
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border-base bg-layer-2/50 flex items-center gap-4 text-xs text-text-tertiary">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-layer-3 font-mono">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-layer-3 font-mono">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-layer-3 font-mono">esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default CommandPalette;
