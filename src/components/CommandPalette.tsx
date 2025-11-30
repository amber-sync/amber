import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

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
      icon: <HomeIcon />,
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
      icon: <SettingsIcon />,
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
      icon: <HelpIcon />,
      action: () => {
        setView('HELP');
        setIsOpen(false);
      },
    });

    cmds.push({
      id: 'create-job',
      title: 'Create New Job',
      description: 'Set up a new backup job',
      category: 'jobs',
      icon: <PlusIcon />,
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
        icon: <PlayIcon />,
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
        icon: <EditIcon />,
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
        icon: <EyeIcon />,
        action: () => {
          setActiveJobId(job.id);
          setView('DETAIL');
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
        icon: <PaletteIcon />,
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
      icon: <MoonIcon />,
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
            <SearchIcon className="w-5 h-5 text-text-tertiary flex-shrink-0" />
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

// Icons (inline SVG for simplicity)
const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const HomeIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

const SettingsIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const HelpIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const PlusIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const PlayIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const EditIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

const EyeIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const PaletteIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
    />
  </svg>
);

const MoonIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
    />
  </svg>
);

export default CommandPalette;
