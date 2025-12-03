import { SnapshotDensity } from '../../types';
import { Icons } from '../IconComponents';

interface DateNavigatorProps {
  selectedYear: number;
  selectedMonth: number | null;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number | null) => void;
  density: SnapshotDensity[];
  loading?: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * DateNavigator - Year tabs and month grid for filtering snapshots (TIM-133)
 *
 * Shows a year selector and a month grid with density indicators.
 * Clicking a month filters snapshots; clicking again clears the filter.
 */
export function DateNavigator({
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  density,
  loading = false,
}: DateNavigatorProps) {
  const currentYear = new Date().getFullYear();

  // Get density for a specific month
  const getMonthDensity = (monthIndex: number): SnapshotDensity | undefined => {
    const monthKey = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    return density.find(d => d.period === monthKey);
  };

  // Render density indicator dots
  const renderDensityDots = (count: number): string => {
    if (count === 0) return '';
    if (count <= 5) return '•';
    if (count <= 15) return '••';
    return '•••';
  };

  // Handle month click - toggle selection
  const handleMonthClick = (monthIndex: number) => {
    const newMonth = monthIndex + 1;
    if (selectedMonth === newMonth) {
      onMonthChange(null); // Clear filter
    } else {
      onMonthChange(newMonth);
    }
  };

  if (loading) {
    return (
      <div className="border-b border-stone-200 p-4 dark:border-stone-700">
        <div className="animate-pulse">
          <div className="mb-3 flex items-center justify-between">
            <div className="h-6 w-6 rounded bg-stone-200 dark:bg-stone-700" />
            <div className="h-5 w-12 rounded bg-stone-200 dark:bg-stone-700" />
            <div className="h-6 w-6 rounded bg-stone-200 dark:bg-stone-700" />
          </div>
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-7 rounded bg-stone-100 dark:bg-stone-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-stone-200 p-4 dark:border-stone-700">
      {/* Year selector */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => onYearChange(selectedYear - 1)}
          className="rounded p-1 hover:bg-stone-100 dark:hover:bg-stone-800"
          aria-label="Previous year"
        >
          <Icons.ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{selectedYear}</span>
        <button
          onClick={() => onYearChange(selectedYear + 1)}
          disabled={selectedYear >= currentYear}
          className={`rounded p-1 ${
            selectedYear >= currentYear
              ? 'cursor-not-allowed opacity-30'
              : 'hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          aria-label="Next year"
        >
          <Icons.ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-4 gap-1">
        {MONTHS.map((month, idx) => {
          const monthDensity = getMonthDensity(idx);
          const isSelected = selectedMonth === idx + 1;
          const hasBackups = monthDensity && monthDensity.count > 0;

          // Don't allow selecting future months
          const isFuture = selectedYear === currentYear && idx + 1 > new Date().getMonth() + 1;

          return (
            <button
              key={month}
              onClick={() => !isFuture && handleMonthClick(idx)}
              disabled={isFuture}
              className={`rounded px-2 py-1 text-xs transition ${
                isFuture
                  ? 'cursor-not-allowed text-stone-300 dark:text-stone-600'
                  : isSelected
                    ? 'bg-amber-500 text-white'
                    : hasBackups
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
                      : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-pressed={isSelected}
              aria-label={`${month} ${selectedYear}${monthDensity ? `, ${monthDensity.count} backups` : ''}`}
            >
              {month}
              {hasBackups && !isSelected && (
                <span className="ml-1 text-[10px]">{renderDensityDots(monthDensity.count)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected month info */}
      {selectedMonth && (
        <div className="mt-2 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <span>
            Showing:{' '}
            <span className="font-medium">
              {MONTHS[selectedMonth - 1]} {selectedYear}
            </span>
          </span>
          <button
            onClick={() => onMonthChange(null)}
            className="text-amber-600 hover:text-amber-700 dark:text-amber-400"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
}

export default DateNavigator;
