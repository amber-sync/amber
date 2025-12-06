import React, { useState } from 'react';
import { SyncJob, JobStatus, JobMountInfo } from '../../../types';
import { Icons } from '../../../components/IconComponents';
import { formatSchedule, formatRelativeTime } from '../../../utils';
import { OfflineBadge } from '../../../components/ConnectionStatus';
import {
  IconButton,
  ProgressRing,
  Title,
  Body,
  Caption,
  Code,
  ModeBadge,
} from '../../../components/ui';

interface JobCardProps {
  job: SyncJob;
  mountInfo?: JobMountInfo;
  onSelect: () => void;
  onRunBackup?: (jobId: string) => void;
  onEditSettings?: (jobId: string) => void;
}

export const JobCard = React.memo<JobCardProps>(
  function JobCard({ job, mountInfo, onSelect, onRunBackup, onEditSettings }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const isRunning = job.status === JobStatus.RUNNING;
    const mounted = mountInfo?.mounted ?? true;

    // Format relative time
    const getRelativeTime = () => {
      if (!job.lastRun) return 'Never run';
      return formatRelativeTime(job.lastRun);
    };

    // Handle card click - toggle expand
    const handleCardClick = () => {
      setIsExpanded(!isExpanded);
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsExpanded(!isExpanded);
      } else if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    return (
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${job.name} backup job, ${job.status}, ${getRelativeTime()}`}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        className={`
        bg-layer-1 rounded-xl border cursor-pointer
        ${
          isExpanded
            ? 'border-border-highlight shadow-[var(--shadow-elevated)]'
            : 'border-border-base shadow-[var(--shadow-card)] hover:border-border-highlight hover:shadow-[var(--shadow-elevated)]'
        }
      `}
      >
        {/* Collapsed Header - Always Visible */}
        <div className="flex items-center gap-3 p-4">
          {/* Job Icon - colored by availability status */}
          <div className="shrink-0">
            {isRunning ? (
              <ProgressRing
                progress={0}
                size={36}
                strokeWidth={2.5}
                showLabel={false}
                variant="default"
              >
                <Icons.RefreshCw size={14} className="animate-spin text-accent-primary" />
              </ProgressRing>
            ) : (
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  !mounted
                    ? 'bg-warning-subtle text-[var(--color-warning)]'
                    : 'bg-layer-2 text-text-secondary'
                }`}
              >
                <Icons.Archive size={18} />
              </div>
            )}
          </div>

          {/* Job Name & Mode */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <Title level={4} truncate>
              {job.name}
            </Title>
            <ModeBadge mode={job.mode} />
            {!mounted && <OfflineBadge />}
          </div>

          {/* Relative Time */}
          <div className="shrink-0">
            {isRunning ? (
              <Body size="sm" as="span" className="text-accent-primary font-medium animate-pulse">
                Syncing...
              </Body>
            ) : (
              <Caption color="secondary">{getRelativeTime()}</Caption>
            )}
          </div>

          {/* Always-Visible Actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            {onRunBackup && (
              <IconButton
                label={isRunning ? 'Backup running' : 'Run backup now'}
                variant="ghost"
                size="sm"
                disabled={isRunning}
                onClick={() => onRunBackup(job.id)}
              >
                <Icons.Play size={16} />
              </IconButton>
            )}
            {onEditSettings && (
              <IconButton
                label="Edit settings"
                variant="ghost"
                size="sm"
                onClick={() => onEditSettings(job.id)}
              >
                <Icons.Settings size={16} />
              </IconButton>
            )}
          </div>

          {/* Expand Indicator */}
          <Icons.ChevronDown
            size={18}
            className={`text-text-tertiary shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4">
            {/* Divider */}
            <div className="border-t border-border-base mb-4" />

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Source Path */}
              <div className="space-y-1">
                <Caption color="tertiary" className="flex items-center gap-1.5">
                  <Icons.FolderOpen size={12} />
                  Source
                </Caption>
                <Code size="sm" className="break-all" title={job.sourcePath}>
                  {job.sourcePath}
                </Code>
              </div>

              {/* Destination Path */}
              <div className="space-y-1">
                <Caption color="tertiary" className="flex items-center gap-1.5">
                  <Icons.HardDrive size={12} />
                  Destination
                </Caption>
                <Code size="sm" className="break-all" title={job.destPath}>
                  {job.destPath}
                </Code>
              </div>

              {/* Schedule */}
              <div className="space-y-1">
                <Caption color="tertiary" className="flex items-center gap-1.5">
                  <Icons.Clock size={12} />
                  Schedule
                </Caption>
                <Body size="sm" as="span">
                  {formatSchedule(job.scheduleInterval)}
                </Body>
              </div>

              {/* Last Run */}
              <div className="space-y-1">
                <Caption color="tertiary" className="flex items-center gap-1.5">
                  <Icons.Activity size={12} />
                  Last Backup
                </Caption>
                <Body size="sm" as="span">
                  {job.lastRun ? (
                    <>
                      {new Date(job.lastRun).toLocaleDateString()} at{' '}
                      {new Date(job.lastRun).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </>
                  ) : (
                    <span className="text-text-tertiary">Never</span>
                  )}
                </Body>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-base">
              <button
                onClick={e => {
                  e.stopPropagation();
                  onSelect();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-primary text-accent-text rounded-xl hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]"
              >
                <Icons.Clock size={16} />
                <Body size="sm" as="span">
                  View History
                </Body>
              </button>
              {onRunBackup && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onRunBackup(job.id);
                  }}
                  disabled={isRunning}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-layer-3 text-text-primary rounded-xl hover:bg-layer-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icons.Play size={16} />
                  <Body size="sm" as="span">
                    {isRunning ? 'Running...' : 'Run Now'}
                  </Body>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - return true if props are equal (skip re-render)
    return (
      prevProps.job.id === nextProps.job.id &&
      prevProps.job.status === nextProps.job.status &&
      prevProps.job.lastRun === nextProps.job.lastRun &&
      prevProps.job.name === nextProps.job.name &&
      prevProps.mountInfo?.mounted === nextProps.mountInfo?.mounted &&
      prevProps.onSelect === nextProps.onSelect &&
      prevProps.onRunBackup === nextProps.onRunBackup &&
      prevProps.onEditSettings === nextProps.onEditSettings
    );
  }
);

export default JobCard;
