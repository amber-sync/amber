import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Icons } from '../IconComponents';
import { formatBytes } from '../../utils/formatters';

interface StorageHistoryProps {
  chartData: { name: string; dataAdded: number }[];
}

export const StorageHistory: React.FC<StorageHistoryProps> = ({ chartData }) => {
  // Process data for visualization
  const processedData = useMemo(() => {
    const last15 = chartData.slice(-15);
    return last15.map((d, i) => {
      const prevValue = i > 0 ? last15[i - 1].dataAdded : d.dataAdded;
      const percentChange = prevValue > 0 ? ((d.dataAdded - prevValue) / prevValue) * 100 : 0;
      return {
        ...d,
        // Convert MB to bytes for formatBytes
        dataAddedBytes: d.dataAdded * 1024 * 1024,
        percentChange,
        index: i,
      };
    });
  }, [chartData]);

  // Calculate average for reference line
  const average = useMemo(() => {
    if (processedData.length === 0) return 0;
    return processedData.reduce((acc, d) => acc + d.dataAdded, 0) / processedData.length;
  }, [processedData]);

  // Custom tooltip component
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: (typeof processedData)[0] }>;
  }) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const changeColor =
      data.percentChange > 0
        ? 'text-green-500'
        : data.percentChange < 0
          ? 'text-red-500'
          : 'text-text-secondary';

    return (
      <div className="bg-layer-2 border border-border-base rounded-lg p-2 shadow-lg">
        <div className="text-xs font-medium text-text-primary">{data.name}</div>
        <div className="text-sm font-semibold text-text-primary mt-1">
          +{formatBytes(data.dataAddedBytes)}
        </div>
        {data.percentChange !== 0 && (
          <div className={`text-xs ${changeColor} mt-0.5`}>
            {data.percentChange > 0 ? '+' : ''}
            {data.percentChange.toFixed(1)}% vs prev
          </div>
        )}
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <div className="bg-layer-1 border border-border-base rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold mb-4 text-text-primary flex items-center gap-2">
          <Icons.BarChart2 size={16} className="text-indigo-500" /> Data Added
        </h3>
        <div className="h-32 w-full flex items-center justify-center text-text-tertiary text-sm">
          No history yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-layer-1 border border-border-base rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <Icons.BarChart2 size={16} className="text-indigo-500" /> Data Added
        </h3>
        <span className="text-xs text-text-tertiary">
          avg: {formatBytes(average * 1024 * 1024)}/backup
        </span>
      </div>

      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={processedData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="dataAddedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              tick={false}
              axisLine={{ stroke: 'var(--border-base)', strokeWidth: 1 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={value => formatBytes(value * 1024 * 1024)}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={average}
              stroke="var(--text-tertiary)"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="dataAdded"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#dataAddedGradient)"
              dot={{
                fill: '#6366f1',
                strokeWidth: 0,
                r: 3,
              }}
              activeDot={{
                fill: '#6366f1',
                strokeWidth: 2,
                stroke: 'white',
                r: 5,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
