import React, { useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  getDay,
  isToday,
} from 'date-fns';
import { SyncJob, JobStatus } from '../../types';
import { Icons } from '../IconComponents';

interface BackupCalendarProps {
  jobs: SyncJob[];
  onDayClick?: (date: Date, backups: DayBackup[]) => void;
}

interface DayBackup {
  jobId: string;
  jobName: string;
  status: 'success' | 'failed';
  timestamp: number;
}

type DayStatus = 'success' | 'failed' | 'mixed' | 'none';

export const BackupCalendar: React.FC<BackupCalendarProps> = ({ jobs, onDayClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Aggregate backups by date
  const backupsByDate = useMemo(() => {
    const map = new Map<string, DayBackup[]>();

    jobs.forEach(job => {
      // Use lastRun for determining backup status on that day
      job.snapshots.forEach(snapshot => {
        const date = new Date(snapshot.timestamp);
        const key = format(date, 'yyyy-MM-dd');

        const backup: DayBackup = {
          jobId: job.id,
          jobName: job.name,
          status: snapshot.status === 'Complete' ? 'success' : 'failed',
          timestamp: snapshot.timestamp,
        };

        const existing = map.get(key) || [];
        existing.push(backup);
        map.set(key, existing);
      });

      // Also check if any job failed on a specific day (from status + lastRun)
      if (job.status === JobStatus.FAILED && job.lastRun) {
        const date = new Date(job.lastRun);
        const key = format(date, 'yyyy-MM-dd');
        const existing = map.get(key) || [];

        // Only add if we don't already have a snapshot for this job on this day
        const hasSnapshot = existing.some(b => b.jobId === job.id);
        if (!hasSnapshot) {
          existing.push({
            jobId: job.id,
            jobName: job.name,
            status: 'failed',
            timestamp: job.lastRun,
          });
          map.set(key, existing);
        }
      }
    });

    return map;
  }, [jobs]);

  const getDayStatus = (date: Date): DayStatus => {
    const key = format(date, 'yyyy-MM-dd');
    const backups = backupsByDate.get(key);

    if (!backups || backups.length === 0) return 'none';

    const hasSuccess = backups.some(b => b.status === 'success');
    const hasFailed = backups.some(b => b.status === 'failed');

    if (hasSuccess && hasFailed) return 'mixed';
    if (hasSuccess) return 'success';
    if (hasFailed) return 'failed';
    return 'none';
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad the start to align with Sunday
  const startPadding = getDay(monthStart);
  const paddedDays = [...Array(startPadding).fill(null), ...days];

  const handleDayClick = (date: Date) => {
    if (!onDayClick) return;
    const key = format(date, 'yyyy-MM-dd');
    const backups = backupsByDate.get(key) || [];
    onDayClick(date, backups);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-layer-1 rounded-xl border border-border-base p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary">Backup Activity</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 hover:bg-layer-2 rounded-lg transition-colors text-text-secondary"
            aria-label="Previous month"
          >
            <Icons.ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-text-primary min-w-[120px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 hover:bg-layer-2 rounded-lg transition-colors text-text-secondary"
            aria-label="Next month"
          >
            <Icons.ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map(day => (
          <div key={day} className="text-[10px] font-medium text-text-tertiary text-center py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {paddedDays.map((day, index) => {
          if (!day) {
            return <div key={`pad-${index}`} className="aspect-square" />;
          }

          const status = getDayStatus(day);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={`
                aspect-square rounded-lg text-xs font-medium transition-all
                flex items-center justify-center relative
                ${today ? 'ring-2 ring-accent-primary ring-offset-1 ring-offset-layer-1' : ''}
                ${status === 'success' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60' : ''}
                ${status === 'failed' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60' : ''}
                ${status === 'mixed' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60' : ''}
                ${status === 'none' ? 'text-text-secondary hover:bg-layer-2' : ''}
              `}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-border-base">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-100 dark:bg-green-900/40" />
          <span className="text-[10px] text-text-tertiary">Success</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-100 dark:bg-red-900/40" />
          <span className="text-[10px] text-text-tertiary">Failed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-100 dark:bg-amber-900/40" />
          <span className="text-[10px] text-text-tertiary">Mixed</span>
        </div>
      </div>
    </div>
  );
};
