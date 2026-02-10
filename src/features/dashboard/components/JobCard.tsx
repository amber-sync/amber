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
  Code,
  Caption,
  ModeBadge,
  Button,
} from '../../../components/ui';
import '../jobcard.css';

interface JobCardProps {
  job: SyncJob;
  mountInfo?: JobMountInfo;
  logs?: LogEntry[];
  progress?: RsyncProgressData | null;
  onSelect: () => void;
  onRunBackup?: (jobId: string) => void;
  onEditSettings?: (jobId: string) => void;
}

// Inline path flow: Source → Destination
const PathFlow: React.FC<{ source: string; dest: string }> = ({ source, dest }) => {
  return (
    <div className="jc-path-flow">
      <div className="jc-path">
        <Icons.FolderOpen size={13} className="jc-path-icon" />
        <Code size="sm" className="jc-path-text" title={source}>
          {source}
        </Code>
      </div>
      <Icons.ArrowRight size={12} className="jc-path-arrow" />
      <div className="jc-path">
        <Icons.HardDrive size={13} className="jc-path-icon" />
        <Code size="sm" className="jc-path-text" title={dest}>
          {dest}
        </Code>
      </div>
    </div>
  );
};

// Progress indicator when syncing
const SyncProgress: React.FC<{
  progress: RsyncProgressData;
  logs: LogEntry[];
}> = ({ progress, logs }) => {
  const recentLogs = logs.slice(-3);

  return (
    <div className="jc-progress">
      <div className="jc-progress-header">
        <div className="jc-progress-left">
          <span className="jc-progress-percent">{progress.percentage}%</span>
          {progress.currentFile && (
            <span className="jc-progress-file">{progress.currentFile.split('/').pop()}</span>
          )}
        </div>
        <span className="jc-progress-meta">
          {progress.speed} · {progress.eta || '—'}
        </span>
      </div>
      <div className="jc-progress-bar">
        <div
          className="jc-progress-fill"
          style={{ width: `${Math.max(2, progress.percentage)}%` }}
        />
      </div>

      {recentLogs.length > 0 && (
        <div className="jc-logs">
          {recentLogs.map((log, i) => (
            <div
              key={`${log.timestamp}-${i}`}
              className={`jc-log ${
                log.level === 'error'
                  ? 'jc-log--error'
                  : log.level === 'warning'
                    ? 'jc-log--warning'
                    : ''
              }`}
            >
              {log.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Error display for failed jobs
const FailedInfo: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
  const errorLog = [...logs].reverse().find(l => l.level === 'error');
  if (!errorLog) return null;

  return (
    <div className="jc-error">
      <div className="jc-error-panel">
        <Icons.AlertCircle size={14} className="jc-error-icon" />
        <div className="jc-error-content">
          <div className="jc-error-title">Sync Failed</div>
          <div className="jc-error-message">{errorLog.message}</div>
        </div>
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

    // Status indicator state
    const getStatusIndicator = () => {
      if (!mounted) return { status: 'warning' as const, pulse: false };
      if (isRunning) return { status: 'neutral' as const, pulse: true };
      if (isFailed) return { status: 'error' as const, pulse: false };
      if (isSuccess) return { status: 'success' as const, pulse: false };
      return { status: 'idle' as const, pulse: false };
    };

    // Icon styling based on status
    const getIconClass = () => {
      if (!mounted) return 'jc-icon jc-icon--warning';
      if (isFailed) return 'jc-icon jc-icon--error';
      if (isSuccess) return 'jc-icon jc-icon--success';
      return 'jc-icon jc-icon--idle';
    };

    const statusIndicator = getStatusIndicator();

    const getRelativeTime = () => {
      if (!job.lastRun) return 'Never';
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
        className={`jc-card ${isExpanded ? 'jc-card--expanded' : ''}`}
      >
        {/* Header row */}
        <div className="jc-header">
          {/* Status icon */}
          <div className="shrink-0">
            {isRunning ? (
              <ProgressRing
                progress={progress?.percentage ?? 0}
                size={36}
                strokeWidth={2.5}
                showLabel={false}
                variant="default"
              >
                <Icons.RefreshCw size={14} className="animate-spin" />
              </ProgressRing>
            ) : (
              <div className={getIconClass()}>
                <Icons.Archive size={18} />
              </div>
            )}
          </div>

          {/* Name & badges */}
          <div className="jc-title-area">
            <Title level={4} truncate>
              {job.name}
            </Title>
            <ModeBadge mode={job.mode} />
            {!mounted && <OfflineBadge />}
          </div>

          {/* Status */}
          <div className="jc-status-area">
            <StatusDot status={statusIndicator.status} pulse={statusIndicator.pulse} size="md" />
            {isRunning ? (
              <span className="jc-status-text jc-status-text--running">
                {progress?.percentage ?? 0}%
              </span>
            ) : (
              <span className={`jc-status-text ${isFailed ? 'jc-status-text--error' : ''}`}>
                {isFailed ? 'Failed' : getRelativeTime()}
              </span>
            )}
          </div>

          {/* Quick actions */}
          <div className="jc-actions" onClick={e => e.stopPropagation()}>
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

          {/* Chevron */}
          <Icons.ChevronDown
            size={16}
            className={`jc-chevron ${isExpanded ? 'jc-chevron--expanded' : ''}`}
          />
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="jc-content">
            <div className="jc-divider" />

            {/* Path flow */}
            <PathFlow source={job.sourcePath} dest={job.destPath} />

            {/* Meta row */}
            <div className="jc-meta">
              <div className="jc-meta-item">
                <Icons.Clock size={13} className="jc-meta-icon" />
                <Caption color="secondary">{formatSchedule(job.scheduleInterval)}</Caption>
              </div>
              {job.lastRun && (
                <div className="jc-meta-item">
                  <Icons.Check size={13} className="jc-meta-icon" />
                  <Caption color="secondary">
                    {new Date(job.lastRun).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    at{' '}
                    {new Date(job.lastRun).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Caption>
                </div>
              )}
            </div>

            {/* Sync progress (only when running with real progress) */}
            {isRunning && progress && <SyncProgress progress={progress} logs={logs} />}

            {/* Failed info */}
            {isFailed && logs.length > 0 && <FailedInfo logs={logs} />}

            {/* Actions - uniform width via grid */}
            <div className="jc-buttons">
              <Button
                variant="secondary"
                size="md"
                icon={<Icons.Clock size={16} />}
                onClick={e => {
                  e.stopPropagation();
                  onSelect();
                }}
              >
                View History
              </Button>
              {onRunBackup ? (
                <Button
                  variant="primary"
                  size="md"
                  icon={<Icons.Play size={16} />}
                  disabled={isRunning}
                  onClick={e => {
                    e.stopPropagation();
                    onRunBackup(job.id);
                  }}
                >
                  {isRunning ? 'Syncing…' : 'Run Now'}
                </Button>
              ) : (
                <div /> // Empty grid cell
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
