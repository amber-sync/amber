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
      <div className="border-b border-border-base p-4">
        <div className="animate-pulse">
          <div className="mb-3 flex items-center justify-between">
            <div className="h-6 w-6 rounded bg-layer-3" />
            <div className="h-5 w-12 rounded bg-layer-3" />
            <div className="h-6 w-6 rounded bg-layer-3" />
          </div>
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-7 rounded bg-layer-2" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border-base p-4">
      {/* Year selector */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => onYearChange(selectedYear - 1)}
          className="rounded p-1 text-text-secondary hover:bg-layer-3 hover:text-text-primary"
          aria-label="Previous year"
        >
          <Icons.ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-text-primary">{selectedYear}</span>
        <button
          onClick={() => onYearChange(selectedYear + 1)}
          disabled={selectedYear >= currentYear}
          className={`rounded p-1 ${
            selectedYear >= currentYear
              ? 'cursor-not-allowed text-text-quaternary'
              : 'text-text-secondary hover:bg-layer-3 hover:text-text-primary'
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
                  ? 'cursor-not-allowed text-text-quaternary'
                  : isSelected
                    ? 'bg-accent-primary text-accent-text'
                    : hasBackups
                      ? 'bg-accent-secondary text-text-primary hover:bg-layer-3'
                      : 'text-text-secondary hover:bg-layer-3'
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
        <div className="mt-2 flex items-center justify-between text-xs text-text-tertiary">
          <span>
            Showing:{' '}
            <span className="font-medium text-text-primary">
              {MONTHS[selectedMonth - 1]} {selectedYear}
            </span>
          </span>
          <button
            onClick={() => onMonthChange(null)}
            className="text-text-secondary hover:text-text-primary"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
}

export default DateNavigator;
