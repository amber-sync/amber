import { useState, useRef, useEffect } from 'react';
import { SyncJob } from '../../types';
import { Icons } from '../IconComponents';

interface TimeExplorerHeaderProps {
  job: SyncJob;
  jobs: SyncJob[];
  onJobSwitch: (jobId: string) => void;
  onBack: () => void;
  onSettingsClick: () => void;
}

/**
 * TimeExplorerHeader - Header with back button, job name, switcher dropdown, and settings
 * (TIM-130)
 */
export function TimeExplorerHeader({
  job,
  jobs,
  onJobSwitch,
  onBack,
  onSettingsClick,
}: TimeExplorerHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Close dropdown on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dropdownOpen]);

  const handleJobSelect = (jobId: string) => {
    if (jobId !== job.id) {
      onJobSwitch(jobId);
    }
    setDropdownOpen(false);
  };

  return (
    <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4 dark:border-stone-700 dark:bg-stone-900">
      <div className="flex items-center gap-4">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
          aria-label="Back to Jobs"
        >
          <Icons.ChevronLeft className="h-5 w-5" />
          <span>Jobs</span>
        </button>

        <div className="h-6 w-px bg-stone-200 dark:bg-stone-700" aria-hidden="true" />

        {/* Job name with dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 text-xl font-semibold hover:text-amber-600"
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
          >
            {job.name}
            <Icons.ChevronDown
              className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div
              className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-800"
              role="listbox"
              aria-label="Select job"
            >
              {jobs.map(j => (
                <button
                  key={j.id}
                  onClick={() => handleJobSelect(j.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition ${
                    j.id === job.id
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                      : 'text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700'
                  }`}
                  role="option"
                  aria-selected={j.id === job.id}
                >
                  {j.id === job.id && <Icons.Check className="h-4 w-4" />}
                  {j.id !== job.id && <span className="w-4" />}
                  <div className="flex-1 truncate">
                    <div className="font-medium">{j.name}</div>
                    <div className="truncate text-xs text-stone-500 dark:text-stone-400">
                      {j.sourcePath}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSettingsClick}
          className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          title="Edit Job"
          aria-label="Edit Job Settings"
        >
          <Icons.Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

export default TimeExplorerHeader;
