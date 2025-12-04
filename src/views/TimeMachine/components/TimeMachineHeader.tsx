/**
 * TimeMachineHeader - Header with job switcher, controls, and status
 *
 * TIM-138: Added Run/Stop backup and Edit controls
 * TIM-151: Added date range filter
 */

import { useState, useRef, useEffect } from 'react';
import { SyncJob, RsyncProgressData } from '../../../types';
import { Icons } from '../../../components/IconComponents';
import { Button, IconButton } from '../../../components/ui';
import { DateFilter } from '../TimeMachine';

interface TimeMachineHeaderProps {
  job: SyncJob | null;
  jobs: SyncJob[];
  isRunning: boolean;
  progress: RsyncProgressData | null;
  onJobSwitch: (jobId: string) => void;
  onBack: () => void;
  onRunBackup: () => void;
  onStopBackup: () => void;
  onEditJob: () => void;
  dateFilter?: DateFilter;
  onDateFilterChange?: (filter: DateFilter) => void;
  snapshotCount?: number;
  totalSnapshotCount?: number;
}

const dateFilterLabels: Record<DateFilter, string> = {
  all: 'All Time',
  '7days': '7 Days',
  '30days': '30 Days',
  '90days': '90 Days',
  year: '1 Year',
};

export function TimeMachineHeader({
  job,
  jobs,
  isRunning,
  progress,
  onJobSwitch,
  onBack,
  onRunBackup,
  onStopBackup,
  onEditJob,
  dateFilter = 'all',
  onDateFilterChange,
  snapshotCount,
  totalSnapshotCount,
}: TimeMachineHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="tm-header">
      <div className="tm-header-left">
        {/* Back button */}
        <IconButton onClick={onBack} label="Back to Dashboard" variant="ghost" size="md">
          <Icons.ArrowLeft size={18} />
        </IconButton>

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
        {/* Date filter (TIM-151, UI-011: Minimal editorial dropdown) */}
        {onDateFilterChange && job && (
          <div className="flex items-center gap-3" ref={dateDropdownRef}>
            <div className="relative">
              <button
                onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-layer-2 rounded-lg transition-colors"
              >
                <span className="font-medium">{dateFilterLabels[dateFilter]}</span>
                <Icons.ChevronDown
                  size={14}
                  className={`opacity-50 transition-transform ${dateDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {dateDropdownOpen && (
                <div className="absolute top-full right-0 mt-1.5 py-1 min-w-[120px] bg-layer-1 border border-border-base rounded-lg shadow-lg z-50">
                  {(Object.keys(dateFilterLabels) as DateFilter[]).map(key => (
                    <button
                      key={key}
                      onClick={() => {
                        onDateFilterChange(key);
                        setDateDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                        key === dateFilter
                          ? 'text-text-primary font-medium bg-layer-2'
                          : 'text-text-secondary hover:text-text-primary hover:bg-layer-2'
                      }`}
                    >
                      {dateFilterLabels[key]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {dateFilter !== 'all' &&
              snapshotCount !== undefined &&
              totalSnapshotCount !== undefined && (
                <span className="text-xs text-text-tertiary tabular-nums">
                  {snapshotCount}/{totalSnapshotCount}
                </span>
              )}
          </div>
        )}

        {/* Progress indicator when running */}
        {isRunning && progress && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-[var(--tm-amber-wash)] rounded-lg">
            <div className="tm-live-status-dot" />
            <span className="text-xs font-medium text-[var(--tm-amber)]">
              {progress.percentage}%
            </span>
            {progress.eta && (
              <span className="text-xs text-[var(--tm-text-dim)]">ETA {progress.eta}</span>
            )}
          </div>
        )}

        {/* Run/Stop Backup button */}
        {job &&
          (isRunning ? (
            <Button
              variant="danger"
              onClick={onStopBackup}
              icon={<Icons.Square size={16} />}
              title="Stop Backup"
            >
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={onRunBackup}
              icon={<Icons.Play size={16} />}
              title="Run Backup"
            >
              Run Backup
            </Button>
          ))}

        {/* Edit Job button */}
        {job && (
          <Button
            variant="secondary"
            onClick={onEditJob}
            icon={<Icons.Pencil size={16} />}
            title="Edit Job Settings"
          >
            Edit
          </Button>
        )}
      </div>
    </header>
  );
}

export default TimeMachineHeader;
