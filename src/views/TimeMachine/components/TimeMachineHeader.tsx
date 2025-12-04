/**
 * TimeMachineHeader - Minimal header with job switcher and status
 */

import { useState, useRef, useEffect } from 'react';
import { SyncJob } from '../../../types';
import { Icons } from '../../../components/IconComponents';

interface TimeMachineHeaderProps {
  job: SyncJob | null;
  jobs: SyncJob[];
  isRunning: boolean;
  onJobSwitch: (jobId: string) => void;
  onBack: () => void;
  onSettings: () => void;
}

export function TimeMachineHeader({
  job,
  jobs,
  isRunning,
  onJobSwitch,
  onBack,
  onSettings,
}: TimeMachineHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="tm-header">
      <div className="tm-header-left">
        {/* Back button */}
        <button onClick={onBack} className="tm-back-btn" title="Back to Dashboard">
          <Icons.ArrowLeft size={18} />
        </button>

        {/* Job selector dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setDropdownOpen(!dropdownOpen)} className="tm-job-selector">
            <Icons.Database size={14} />
            <span>{job?.name || 'Select Job'}</span>
            <Icons.ChevronDown
              size={14}
              className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--tm-nebula)] border border-[var(--tm-dust)] rounded-lg shadow-xl overflow-hidden z-50 tm-animate-fade-in">
              <div className="p-2">
                {jobs.map(j => (
                  <button
                    key={j.id}
                    onClick={() => {
                      onJobSwitch(j.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      j.id === job?.id
                        ? 'bg-[var(--tm-amber-wash)] text-[var(--tm-amber)]'
                        : 'hover:bg-[var(--tm-dust)] text-[var(--tm-text-soft)]'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        j.status === 'RUNNING'
                          ? 'bg-[var(--tm-amber)] animate-pulse'
                          : j.status === 'SUCCESS'
                            ? 'bg-[var(--tm-success)]'
                            : 'bg-[var(--tm-text-dim)]'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{j.name}</div>
                      <div className="text-xs text-[var(--tm-text-dim)] truncate">
                        {j.sourcePath}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {jobs.length === 0 && (
                <div className="p-4 text-center text-sm text-[var(--tm-text-dim)]">
                  No jobs configured
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="tm-header-right">
        {/* Live indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--tm-amber-wash)] rounded-lg">
            <div className="tm-live-status-dot" />
            <span className="text-xs font-medium text-[var(--tm-amber)]">Syncing</span>
          </div>
        )}

        {/* Settings button */}
        <button onClick={onSettings} className="tm-settings-btn" title="Settings">
          <Icons.Settings size={16} />
        </button>
      </div>
    </header>
  );
}

export default TimeMachineHeader;
