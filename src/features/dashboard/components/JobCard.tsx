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
  Code,
  ModeBadge,
  Button,
} from '../../../components/ui';

interface JobCardProps {
  job: SyncJob;
  mountInfo?: JobMountInfo;
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
  <div className="space-y-1">
    <Body size="sm" color="secondary" className="flex items-center gap-1.5">
      {icon}
      {label}
    </Body>
    {children}
  </div>
);

export const JobCard = React.memo<JobCardProps>(
  function JobCard({ job, mountInfo, onSelect, onRunBackup, onEditSettings }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const isRunning = job.status === JobStatus.RUNNING;
    const mounted = mountInfo?.mounted ?? true;

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
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  !mounted ? 'bg-warning-subtle' : 'bg-layer-2'
                }`}
              >
                <Icons.Archive
                  size={18}
                  className={!mounted ? 'text-warning' : 'text-text-secondary'}
                />
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
              <Body
                size="sm"
                as="span"
                weight="medium"
                className="text-accent-primary animate-pulse"
              >
                Syncing...
              </Body>
            ) : (
              <Body size="sm" color="secondary">
                {getRelativeTime()}
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
                <Code size="sm" className="break-all" title={job.sourcePath}>
                  {job.sourcePath}
                </Code>
              </DetailRow>

              <DetailRow icon={<Icons.HardDrive size={14} />} label="Destination">
                <Code size="sm" className="break-all" title={job.destPath}>
                  {job.destPath}
                </Code>
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
      prevProps.onSelect === nextProps.onSelect &&
      prevProps.onRunBackup === nextProps.onRunBackup &&
      prevProps.onEditSettings === nextProps.onEditSettings
    );
  }
);

export default JobCard;
