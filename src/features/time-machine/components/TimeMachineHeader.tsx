/**
 * TimeMachineHeader - Header with job switcher, controls, and status
 *
 * TIM-138: Added Run/Stop backup and Edit controls
 * TIM-151: Added date range filter
 */

import { useState, useRef, useEffect, memo } from 'react';
import { SyncJob, RsyncProgressData } from '../../../types';
import { Icons } from '../../../components/IconComponents';
import { Button, IconButton, Body, Caption } from '../../../components/ui';
import { DateFilter } from '../TimeMachinePage';

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

function TimeMachineHeaderComponent({
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
            <Icons.Folder size={16} className="text-text-secondary" />
            <Body size="sm" weight="medium">
              {job?.name || 'Select Job'}
            </Body>
            <Icons.ChevronDown
              size={14}
              className={`text-text-tertiary transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-layer-1 border border-border-base rounded-xl shadow-xl overflow-hidden z-50 tm-animate-fade-in">
              <div className="p-1.5">
                {jobs.map(j => (
                  <button
                    key={j.id}
                    onClick={() => {
                      onJobSwitch(j.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      j.id === job?.id
                        ? 'bg-accent-secondary text-text-primary'
                        : 'hover:bg-layer-2 text-text-secondary'
                    }`}
                  >
                    <Icons.Folder
                      size={16}
                      className={j.id === job?.id ? 'text-accent-primary' : 'text-text-tertiary'}
                    />
                    <div className="flex-1 min-w-0">
                      <Body size="sm" weight="medium" className="truncate">
                        {j.name}
                      </Body>
                      <Caption size="sm" color="tertiary" className="truncate">
                        {j.sourcePath}
                      </Caption>
                    </div>
                    {j.status === 'RUNNING' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                    )}
                  </button>
                ))}
              </div>

              {jobs.length === 0 && (
                <div className="p-4 text-center">
                  <Body size="sm" color="tertiary">
                    No jobs configured
                  </Body>
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
                className="flex items-center gap-2 px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-layer-2 rounded-lg transition-colors"
              >
                <Body size="sm" weight="medium">
                  {dateFilterLabels[dateFilter]}
                </Body>
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
                      className={`w-full px-3 py-1.5 text-left transition-colors ${
                        key === dateFilter
                          ? 'text-text-primary bg-layer-2'
                          : 'text-text-secondary hover:text-text-primary hover:bg-layer-2'
                      }`}
                    >
                      <Body size="sm" weight={key === dateFilter ? 'medium' : 'normal'}>
                        {dateFilterLabels[key]}
                      </Body>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {dateFilter !== 'all' &&
              snapshotCount !== undefined &&
              totalSnapshotCount !== undefined && (
                <Caption color="tertiary" className="tabular-nums">
                  {snapshotCount}/{totalSnapshotCount}
                </Caption>
              )}
          </div>
        )}

        {/* Progress indicator when running */}
        {isRunning && progress && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-[var(--tm-amber-wash)] rounded-lg">
            <div className="tm-live-status-dot" />
            <Caption className="font-weight-medium text-[var(--tm-amber)]">
              {progress.percentage}%
            </Caption>
            {progress.eta && (
              <Caption className="text-[var(--tm-text-dim)]">ETA {progress.eta}</Caption>
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

export const TimeMachineHeader = memo(TimeMachineHeaderComponent);
TimeMachineHeader.displayName = 'TimeMachineHeader';

export default TimeMachineHeader;
