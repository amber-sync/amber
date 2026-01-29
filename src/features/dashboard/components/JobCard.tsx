import React, { useState } from 'react';
import { SyncJob, JobStatus, JobMountInfo, LogEntry, RsyncProgressData } from '../../../types';
import { Icons } from '../../../components/IconComponents';
import { formatSchedule, formatRelativeTime } from '../../../utils';
import { OfflineBadge } from '../../../components/ConnectionStatus';
import {
  IconButton,
  ProgressRing,
  StatusDot,
  Title,
  Body,
  Code,
  Caption,
  ModeBadge,
  Button,
} from '../../../components/ui';

interface JobCardProps {
  job: SyncJob;
  mountInfo?: JobMountInfo;
  logs?: LogEntry[];
  progress?: RsyncProgressData | null;
  onSelect: () => void;
  onRunBackup?: (jobId: string) => void;
  onEditSettings?: (jobId: string) => void;
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

const DetailRow: React.FC<DetailRowProps> = ({ icon, label, children }) => (
  <div className="space-y-1 min-w-0">
    <Body size="sm" color="secondary" className="flex items-center gap-1.5">
      {icon}
      {label}
    </Body>
    {children}
  </div>
);

// Activity log display - shows recent logs and progress
const ActivityLog: React.FC<{
  logs: LogEntry[];
  progress: RsyncProgressData | null;
  isRunning: boolean;
  isFailed: boolean;
}> = ({ logs, progress, isRunning, isFailed }) => {
  // Show last 5 log entries, prioritizing errors/warnings
  const recentLogs = logs.slice(-5);
  const hasContent = recentLogs.length > 0 || (isRunning && progress);

  if (!hasContent) return null;

  return (
    <div className="mt-4 pt-4 border-t border-border-base">
      <Body size="sm" color="secondary" className="flex items-center gap-1.5 mb-2">
        <Icons.Terminal size={14} />
        {isRunning ? 'Live Activity' : isFailed ? 'Last Error' : 'Recent Activity'}
      </Body>

      {/* Progress bar when running */}
      {isRunning && progress && (
        <div className="mb-3 p-3 bg-layer-2 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Body size="sm" weight="medium">
              {progress.percentage}% complete
            </Body>
            <Caption color="tertiary">
              {progress.speed} • ETA: {progress.eta || 'calculating...'}
            </Caption>
          </div>
          <div className="h-1.5 bg-layer-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-primary rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          {progress.currentFile && (
            <Code size="sm" className="mt-2 block truncate text-text-tertiary">
              {progress.currentFile}
            </Code>
          )}
        </div>
      )}

      {/* Log entries */}
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {recentLogs.map((log, i) => (
          <div
            key={`${log.timestamp}-${i}`}
            className={`flex items-start gap-2 text-xs font-mono ${
              log.level === 'error'
                ? 'text-error'
                : log.level === 'warning'
                  ? 'text-warning'
                  : 'text-text-tertiary'
            }`}
          >
            <span className="shrink-0 opacity-50">
              {new Date(log.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
            <span className="break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Smart path display - truncates middle, shows full on hover
const PathDisplay: React.FC<{ path: string; className?: string }> = ({ path, className = '' }) => {
  const parts = path.split('/').filter(Boolean);
  const isLongPath = parts.length > 3;

  // For long paths, show first part + ... + last 2 parts
  const displayPath = isLongPath ? `/${parts[0]}/.../${parts.slice(-2).join('/')}` : path;

  return (
    <div className={`group relative ${className}`}>
      <Code size="sm" className="block truncate cursor-help" title={path}>
        {displayPath}
      </Code>
      {/* Tooltip on hover for full path */}
      <div className="absolute left-0 bottom-full mb-1 px-2 py-1.5 bg-layer-1 border border-border-highlight rounded-lg shadow-elevated opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 max-w-xs">
        <Code size="sm" className="break-all whitespace-pre-wrap text-text-secondary">
          {path}
        </Code>
      </div>
    </div>
  );
};

export const JobCard = React.memo<JobCardProps>(
  function JobCard({
    job,
    mountInfo,
    logs = [],
    progress = null,
    onSelect,
    onRunBackup,
    onEditSettings,
  }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const isRunning = job.status === JobStatus.RUNNING;
    const isSuccess = job.status === JobStatus.SUCCESS;
    const isFailed = job.status === JobStatus.FAILED;
    const mounted = mountInfo?.mounted ?? true;

    // Determine the status indicator state
    const getStatusIndicator = () => {
      if (!mounted) return { status: 'warning' as const, pulse: false };
      if (isRunning) return { status: 'neutral' as const, pulse: true };
      if (isFailed) return { status: 'error' as const, pulse: false };
      if (isSuccess) return { status: 'success' as const, pulse: false };
      return { status: 'idle' as const, pulse: false };
    };

    // Get icon background styling based on status
    const getIconStyle = () => {
      if (!mounted) return 'bg-warning-subtle';
      if (isFailed) return 'bg-error-subtle';
      if (isSuccess) return 'bg-success-subtle';
      return 'bg-layer-2';
    };

    // Get icon color based on status
    const getIconColor = () => {
      if (!mounted) return 'text-warning';
      if (isFailed) return 'text-error';
      if (isSuccess) return 'text-success';
      return 'text-text-secondary';
    };

    const statusIndicator = getStatusIndicator();

    const getRelativeTime = () => {
      if (!job.lastRun) return 'Never run';
      return formatRelativeTime(job.lastRun);
    };

    const handleCardClick = () => {
      setIsExpanded(!isExpanded);
    };

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
          bg-layer-1 rounded-xl border cursor-pointer transition-all
          ${
            isExpanded
              ? 'border-border-highlight shadow-elevated'
              : 'border-border-base shadow-card hover:border-border-highlight hover:shadow-elevated'
          }
        `}
      >
        {/* Collapsed Header */}
        <div className="flex items-center gap-3 p-4">
          {/* Job Icon */}
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
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${getIconStyle()}`}
              >
                <Icons.Archive size={18} className={getIconColor()} />
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

          {/* Status & Relative Time */}
          <div className="shrink-0 flex items-center gap-2">
            <StatusDot status={statusIndicator.status} pulse={statusIndicator.pulse} size="md" />
            {isRunning ? (
              <Body size="sm" as="span" weight="medium" className="animate-pulse">
                Syncing...
              </Body>
            ) : (
              <Body
                size="sm"
                color={isFailed ? undefined : 'secondary'}
                className={isFailed ? 'text-error' : ''}
              >
                {isFailed ? 'Failed' : getRelativeTime()}
              </Body>
            )}
          </div>

          {/* Quick Actions */}
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
            className={`text-text-tertiary shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 animate-fade-in">
            <div className="border-t border-border-base mb-4" />

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <DetailRow icon={<Icons.FolderOpen size={14} />} label="Source">
                <PathDisplay path={job.sourcePath} />
              </DetailRow>

              <DetailRow icon={<Icons.HardDrive size={14} />} label="Destination">
                <PathDisplay path={job.destPath} />
              </DetailRow>

              <DetailRow icon={<Icons.Clock size={14} />} label="Schedule">
                <Body size="sm">{formatSchedule(job.scheduleInterval)}</Body>
              </DetailRow>

              <DetailRow icon={<Icons.Activity size={14} />} label="Last Backup">
                <Body size="sm">
                  {job.lastRun ? (
                    <>
                      {new Date(job.lastRun).toLocaleDateString()} at{' '}
                      {new Date(job.lastRun).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </>
                  ) : (
                    <Body size="sm" as="span" color="tertiary">
                      Never
                    </Body>
                  )}
                </Body>
              </DetailRow>
            </div>

            {/* Activity Log - shows when running or failed */}
            {(isRunning || isFailed || logs.length > 0) && (
              <ActivityLog
                logs={logs}
                progress={progress}
                isRunning={isRunning}
                isFailed={isFailed}
              />
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-base">
              <Button
                variant="primary"
                size="md"
                icon={<Icons.Clock size={16} />}
                className="flex-1"
                onClick={e => {
                  e.stopPropagation();
                  onSelect();
                }}
              >
                View History
              </Button>
              {onRunBackup && (
                <Button
                  variant="secondary"
                  size="md"
                  icon={<Icons.Play size={16} />}
                  disabled={isRunning}
                  onClick={e => {
                    e.stopPropagation();
                    onRunBackup(job.id);
                  }}
                >
                  {isRunning ? 'Running...' : 'Run Now'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.job.id === nextProps.job.id &&
      prevProps.job.status === nextProps.job.status &&
      prevProps.job.lastRun === nextProps.job.lastRun &&
      prevProps.job.name === nextProps.job.name &&
      prevProps.mountInfo?.mounted === nextProps.mountInfo?.mounted &&
      prevProps.logs?.length === nextProps.logs?.length &&
      prevProps.progress?.percentage === nextProps.progress?.percentage &&
      prevProps.onSelect === nextProps.onSelect &&
      prevProps.onRunBackup === nextProps.onRunBackup &&
      prevProps.onEditSettings === nextProps.onEditSettings
    );
  }
);

export default JobCard;
