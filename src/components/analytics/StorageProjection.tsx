import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format, addDays } from 'date-fns';
import { SyncJob, DiskStats } from '../../types';
import { formatBytes } from '../../utils/formatters';
import { Icons } from '../IconComponents';

interface StorageProjectionProps {
  jobs: SyncJob[];
  diskStats: Record<string, DiskStats>;
}

interface DataPoint {
  date: string;
  timestamp: number;
  usedBytes: number;
  projected?: boolean;
}

// Linear regression helper
function linearRegression(points: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
} {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: points[0].y };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

export const StorageProjection: React.FC<StorageProjectionProps> = ({ jobs, diskStats }) => {
  // Aggregate storage usage over time from snapshots
  const { chartData, daysUntilFull, dailyGrowthRate, totalCapacity } = useMemo(() => {
    // Collect all snapshot data points
    const dataPoints: DataPoint[] = [];

    jobs.forEach(job => {
      job.snapshots.forEach(snapshot => {
        dataPoints.push({
          date: format(new Date(snapshot.timestamp), 'MMM d'),
          timestamp: snapshot.timestamp,
          usedBytes: snapshot.sizeBytes,
        });
      });
    });

    // Sort by timestamp
    dataPoints.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate cumulative storage by date
    const byDate = new Map<string, number>();
    let cumulative = 0;

    dataPoints.forEach(point => {
      cumulative += point.usedBytes;
      byDate.set(point.date, cumulative);
    });

    // Convert to chart data
    const chartPoints: DataPoint[] = Array.from(byDate.entries()).map(([date, usedBytes]) => ({
      date,
      timestamp: 0,
      usedBytes,
    }));

    // Get total disk capacity from first available path
    const firstPath = Object.keys(diskStats)[0];
    const stats = firstPath ? diskStats[firstPath] : null;
    const capacity = stats?.total || 0;
    const freeSpace = stats?.free || 0;

    // Calculate daily growth rate using linear regression
    const regressionPoints = chartPoints.map((point, index) => ({
      x: index,
      y: point.usedBytes,
    }));

    const { slope } = linearRegression(regressionPoints);
    const dailyGrowth = slope > 0 ? slope : 0;

    // Project days until full
    let daysRemaining: number | null = null;
    if (dailyGrowth > 0 && freeSpace > 0) {
      daysRemaining = Math.floor(freeSpace / dailyGrowth);
    }

    // Add projection data points (next 30 days)
    const projectedData: DataPoint[] = [];
    if (chartPoints.length > 0 && dailyGrowth > 0) {
      const lastPoint = chartPoints[chartPoints.length - 1];
      const today = new Date();

      for (let i = 1; i <= 30; i++) {
        const futureDate = addDays(today, i);
        const projected = lastPoint.usedBytes + dailyGrowth * i;

        if (projected <= capacity) {
          projectedData.push({
            date: format(futureDate, 'MMM d'),
            timestamp: futureDate.getTime(),
            usedBytes: projected,
            projected: true,
          });
        }
      }
    }

    // Create combined chart data with separate keys for actual vs projected
    const combinedData: { date: string; actual: number | null; projected: number | null }[] =
      chartPoints.map(p => ({
        date: p.date,
        actual: p.usedBytes,
        projected: null,
      }));

    // Add bridge point if we have projections
    if (chartPoints.length > 0 && projectedData.length > 0) {
      const lastActual = chartPoints[chartPoints.length - 1];
      combinedData.push({
        date: lastActual.date,
        actual: lastActual.usedBytes,
        projected: lastActual.usedBytes,
      });
    }

    // Add projection points
    projectedData.forEach(p => {
      combinedData.push({
        date: p.date,
        actual: null,
        projected: p.usedBytes,
      });
    });

    return {
      chartData: combinedData,
      daysUntilFull: daysRemaining,
      dailyGrowthRate: dailyGrowth,
      totalCapacity: capacity,
    };
  }, [jobs, diskStats]);

  const hasData = chartData.length > 0;
  const isWarning = daysUntilFull !== null && daysUntilFull < 30;
  const isCritical = daysUntilFull !== null && daysUntilFull < 7;

  return (
    <div className="bg-layer-1 rounded-xl border border-border-base p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary">Storage Projection</h3>
        {daysUntilFull !== null && (
          <div
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              ${isCritical ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : ''}
              ${isWarning && !isCritical ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : ''}
              ${!isWarning ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : ''}
            `}
          >
            {isCritical && <Icons.AlertTriangle size={12} />}
            {daysUntilFull} days until full
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-layer-2 rounded-lg p-3">
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
            Daily Growth
          </div>
          <div className="text-lg font-bold text-text-primary">
            {dailyGrowthRate > 0 ? `+${formatBytes(dailyGrowthRate)}` : '—'}
          </div>
        </div>
        <div className="bg-layer-2 rounded-lg p-3">
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
            Total Capacity
          </div>
          <div className="text-lg font-bold text-text-primary">
            {totalCapacity > 0 ? formatBytes(totalCapacity) : '—'}
          </div>
        </div>
      </div>

      {/* Chart */}
      {hasData ? (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={value => formatBytes(value)}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip
                formatter={(value, name) => {
                  if (value === null || value === undefined) return null;
                  const numValue = typeof value === 'number' ? value : Number(value);
                  return [formatBytes(numValue), name === 'actual' ? 'Storage' : 'Projected'];
                }}
                contentStyle={{
                  backgroundColor: 'var(--color-layer-2)',
                  border: '1px solid var(--color-border-base)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              {totalCapacity > 0 && (
                <ReferenceLine
                  y={totalCapacity}
                  stroke="var(--color-red-500)"
                  strokeDasharray="3 3"
                  label={{
                    value: 'Capacity',
                    position: 'right',
                    fontSize: 10,
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="var(--color-accent-primary)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="projected"
                stroke="var(--color-accent-primary)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-40 flex items-center justify-center text-text-tertiary text-sm">
          No backup data available for projection
        </div>
      )}

      {/* Warning message */}
      {isWarning && (
        <div
          className={`
            mt-3 p-3 rounded-lg text-xs
            ${isCritical ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'}
          `}
        >
          <div className="flex items-center gap-2">
            <Icons.AlertTriangle size={14} />
            <span className="font-medium">
              {isCritical
                ? 'Critical: Storage running out soon!'
                : 'Warning: Consider adding storage capacity'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
