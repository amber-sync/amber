import React, { useMemo, useState } from 'react';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  subWeeks,
  isToday,
  isSameDay,
} from 'date-fns';
import { SyncJob } from '../../types';

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

// GitHub-style contribution heatmap - shows full year (52 weeks)
export const BackupCalendar = React.memo<BackupCalendarProps>(function BackupCalendar({ jobs, onDayClick }) {
  const [hoveredDay, setHoveredDay] = useState<Date | null>(null);

  // Aggregate backups by date
  const backupsByDate = useMemo(() => {
    const map = new Map<string, DayBackup[]>();

    jobs.forEach(job => {
      (job.snapshots ?? []).forEach(snapshot => {
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
    });

    return map;
  }, [jobs]);

  // Generate 52 weeks of dates ending at current week
  const weeks = useMemo(() => {
    const today = new Date();
    const endWeek = endOfWeek(today, { weekStartsOn: 0 }); // Sunday start
    const startDate = subWeeks(startOfWeek(today, { weekStartsOn: 0 }), 51);

    const allDays = eachDayOfInterval({ start: startDate, end: endWeek });

    // Group into weeks (7 days each)
    const weekGroups: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weekGroups.push(allDays.slice(i, i + 7));
    }

    return weekGroups;
  }, []);

  // Get month labels with their positions
  const monthLabels = useMemo(() => {
    const labels: { month: string; weekIndex: number }[] = [];
    let lastMonth = -1;

    weeks.forEach((week, weekIndex) => {
      // Use the first day of the week to determine month
      const firstDay = week[0];
      const month = firstDay.getMonth();

      if (month !== lastMonth) {
        labels.push({
          month: format(firstDay, 'MMM'),
          weekIndex,
        });
        lastMonth = month;
      }
    });

    return labels;
  }, [weeks]);

  const getBackupCount = (date: Date): number => {
    const key = format(date, 'yyyy-MM-dd');
    return backupsByDate.get(key)?.length || 0;
  };

  const getIntensityClass = (count: number): string => {
    if (count === 0) return 'bg-layer-2';
    if (count === 1) return 'bg-zinc-200 dark:bg-zinc-700';
    if (count === 2) return 'bg-zinc-400 dark:bg-zinc-500';
    if (count <= 4) return 'bg-zinc-600 dark:bg-zinc-400';
    return 'bg-accent-primary';
  };

  const handleDayClick = useMemo(
    () => (date: Date) => {
      if (!onDayClick) return;
      const key = format(date, 'yyyy-MM-dd');
      const backups = backupsByDate.get(key) || [];
      onDayClick(date, backups);
    },
    [onDayClick, backupsByDate]
  );

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <div className="bg-layer-1 rounded-xl border border-border-base p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-text-primary">Backup Activity</h3>
        <span className="text-xs text-text-tertiary">
          {jobs.reduce((acc, job) => acc + (job.snapshots ?? []).length, 0)} backups in past year
        </span>
      </div>

      <div className="flex">
        {/* Day labels (left axis) */}
        <div className="flex flex-col gap-[3px] mr-2 mt-[18px]">
          {dayLabels.map((label, i) => (
            <div key={i} className="h-[11px] text-[9px] text-text-tertiary flex items-center">
              {label}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex-1 overflow-x-auto">
          {/* Month labels */}
          <div className="flex mb-1 relative h-[14px]">
            {monthLabels.map(({ month, weekIndex }) => (
              <div
                key={`${month}-${weekIndex}`}
                className="absolute text-[9px] text-text-tertiary"
                style={{ left: weekIndex * 14 }}
              >
                {month}
              </div>
            ))}
          </div>

          {/* Contribution grid: 52 columns x 7 rows */}
          <div className="flex gap-[3px]">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {week.map(day => {
                  const count = getBackupCount(day);
                  const today_ = isToday(day);
                  const isHovered = hoveredDay && isSameDay(day, hoveredDay);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDayClick(day)}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`
                        w-[11px] h-[11px] rounded-[2px] transition-all relative
                        ${getIntensityClass(count)}
                        ${today_ ? 'ring-1 ring-accent-primary' : ''}
                        hover:ring-1 hover:ring-text-secondary
                      `}
                      title={`${format(day, 'MMM d, yyyy')}: ${count} backup${count !== 1 ? 's' : ''}`}
                    >
                      {/* Tooltip on hover */}
                      {isHovered && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                          <div className="bg-layer-3 border border-border-base rounded-lg px-2 py-1 shadow-lg whitespace-nowrap">
                            <div className="text-[10px] font-medium text-text-primary">
                              {count} backup{count !== 1 ? 's' : ''}
                            </div>
                            <div className="text-[9px] text-text-tertiary">
                              {format(day, 'EEE, MMM d, yyyy')}
                            </div>
                          </div>
                          {/* Arrow */}
                          <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-[1px]">
                            <div className="border-4 border-transparent border-t-layer-3" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-border-base">
        <span className="text-[9px] text-text-tertiary">Less</span>
        <div className="flex gap-[2px]">
          <div className="w-[10px] h-[10px] rounded-[2px] bg-layer-2" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-zinc-200 dark:bg-zinc-700" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-zinc-400 dark:bg-zinc-500" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-zinc-600 dark:bg-zinc-400" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-accent-primary" />
        </div>
        <span className="text-[9px] text-text-tertiary">More</span>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for jobs array - shallow comparison
  if (prevProps.jobs.length !== nextProps.jobs.length) return false;

  // Check if job snapshots have changed
  for (let i = 0; i < prevProps.jobs.length; i++) {
    const prevJob = prevProps.jobs[i];
    const nextJob = nextProps.jobs[i];

    if (prevJob.id !== nextJob.id) return false;

    const prevSnapshots = prevJob.snapshots ?? [];
    const nextSnapshots = nextJob.snapshots ?? [];

    if (prevSnapshots.length !== nextSnapshots.length) return false;
  }

  return prevProps.onDayClick === nextProps.onDayClick;
});
