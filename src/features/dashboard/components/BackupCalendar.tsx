import React, { useMemo } from 'react';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, subWeeks, isToday } from 'date-fns';
import { SyncJob } from '../../../types';
import { Title, Caption } from '../../../components/ui';

interface BackupCalendarProps {
  jobs: SyncJob[];
  onDayClick?: (date: Date, backups: DayBackup[]) => void;
}

interface DayBackup {
  jobId: string;
  jobName: string;
  status: 'success' | 'warning' | 'failed';
  timestamp: number;
}

// GitHub-style contribution heatmap - shows full year (52 weeks)
export const BackupCalendar = React.memo<BackupCalendarProps>(
  function BackupCalendar({ jobs, onDayClick }) {
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
            status:
              snapshot.status === 'Complete'
                ? 'success'
                : snapshot.status === 'Partial'
                  ? 'warning'
                  : 'failed',
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
          <Title level={3}>Backup Activity</Title>
          <Caption color="tertiary">
            {jobs.reduce((acc, job) => acc + (job.snapshots ?? []).length, 0)} backups in past year
          </Caption>
        </div>

        <div className="flex">
          {/* Day labels (left axis) */}
          <div className="flex flex-col gap-[3px] mr-3 mt-[26px]">
            {dayLabels.map((label, i) => (
              <div key={i} className="h-[11px] flex items-center">
                <Caption size="sm" color="tertiary">
                  {label}
                </Caption>
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="flex-1 overflow-x-auto">
            {/* Month labels */}
            <div className="flex mb-3 relative h-[14px]">
              {monthLabels.map(({ month, weekIndex }) => (
                <div
                  key={`${month}-${weekIndex}`}
                  className="absolute"
                  style={{ left: weekIndex * 14 }}
                >
                  <Caption size="sm" color="tertiary">
                    {month}
                  </Caption>
                </div>
              ))}
            </div>

            {/* Contribution grid: 52 columns x 7 rows */}
            <div className="flex gap-[3px] pb-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[3px]">
                  {week.map(day => {
                    const count = getBackupCount(day);
                    const today_ = isToday(day);

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => handleDayClick(day)}
                        className={`
                          w-[11px] h-[11px] rounded-[2px] transition-all
                          ${getIntensityClass(count)}
                          ${today_ ? 'ring-1 ring-accent-primary' : ''}
                          hover:ring-1 hover:ring-text-secondary
                        `}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-border-base">
          <Caption size="sm" color="tertiary">
            Less
          </Caption>
          <div className="flex gap-[2px]">
            <div className="w-[10px] h-[10px] rounded-[2px] bg-layer-2" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-zinc-200 dark:bg-zinc-700" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-zinc-400 dark:bg-zinc-500" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-zinc-600 dark:bg-zinc-400" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-accent-primary" />
          </div>
          <Caption size="sm" color="tertiary">
            More
          </Caption>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
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
  }
);
