import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import * as Icons from 'lucide-react';

interface TimelineDataPoint {
  date: string;
  shortDate: string;
  totalSize: number;
  newData: number;
  linkedData: number;
  snapshot: number;
}

const TIMELINE_DATA: TimelineDataPoint[] = [
  {
    date: '2025-01-15',
    shortDate: 'Jan 15',
    totalSize: 2150,
    newData: 2150,
    linkedData: 0,
    snapshot: 1,
  },
  {
    date: '2025-01-16',
    shortDate: 'Jan 16',
    totalSize: 2750,
    newData: 600,
    linkedData: 2150,
    snapshot: 2,
  },
  {
    date: '2025-01-17',
    shortDate: 'Jan 17',
    totalSize: 3100,
    newData: 350,
    linkedData: 2750,
    snapshot: 3,
  },
  {
    date: '2025-01-18',
    shortDate: 'Jan 18',
    totalSize: 4200,
    newData: 1100,
    linkedData: 3100,
    snapshot: 4,
  },
  {
    date: '2025-01-19',
    shortDate: 'Jan 19',
    totalSize: 4550,
    newData: 350,
    linkedData: 4200,
    snapshot: 5,
  },
  {
    date: '2025-01-20',
    shortDate: 'Jan 20',
    totalSize: 5300,
    newData: 750,
    linkedData: 4550,
    snapshot: 6,
  },
  {
    date: '2025-01-21',
    shortDate: 'Jan 21',
    totalSize: 5500,
    newData: 200,
    linkedData: 5300,
    snapshot: 7,
  },
];

const formatBytes = (mb: number) => {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
};

export const StorageTimeline: React.FC = () => {
  const [hoveredSnapshot, setHoveredSnapshot] = useState<number | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const totalWithoutHardLinks = TIMELINE_DATA[TIMELINE_DATA.length - 1].totalSize * 7;
  const totalWithHardLinks = TIMELINE_DATA.reduce((sum, d) => sum + d.newData, 0);
  const savingsPercentage =
    ((totalWithoutHardLinks - totalWithHardLinks) / totalWithoutHardLinks) * 100;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-3 shadow-xl">
        <p className="font-bold text-gray-900 dark:text-white mb-2">Snapshot #{data.snapshot}</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{data.date}</p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              New data:
            </span>
            <span className="font-bold text-orange-600 dark:text-orange-400">
              {formatBytes(data.newData)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-teal-500 rounded-full" />
              Linked data:
            </span>
            <span className="font-bold text-teal-600 dark:text-teal-400">
              {formatBytes(data.linkedData)}
            </span>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold">Total visible:</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {formatBytes(data.totalSize)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Storage Efficiency Over Time
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          Watch how Time Machine backups accumulate. Each backup looks like a full copy, but hard
          links ensure you only store what changed.
        </p>
      </div>

      {/* Savings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Icons.Copy size={18} className="text-orange-600 dark:text-orange-400" />
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Traditional Backups
            </p>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1">
            {formatBytes(totalWithoutHardLinks)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            7 complete copies = 7× the data
          </p>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 border-2 border-teal-200 dark:border-teal-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Icons.Link size={18} className="text-teal-600 dark:text-teal-400" />
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Time Machine Mode
            </p>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1">
            {formatBytes(totalWithHardLinks)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Only changed data stored</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-indigo-900/20 dark:to-purple-800/20 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Icons.TrendingDown size={18} className="text-indigo-600 dark:text-indigo-400" />
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Space Saved
            </p>
          </div>
          <p className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1">
            {savingsPercentage.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {formatBytes(totalWithoutHardLinks - totalWithHardLinks)} saved
          </p>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex justify-center">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="px-6 py-2.5 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
        >
          <Icons.BarChart3 size={16} />
          {showComparison ? 'Show Individual Snapshots' : 'Show Cumulative Growth'}
        </button>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={TIMELINE_DATA}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            onMouseMove={(e: any) => {
              if (e && e.activePayload) {
                setHoveredSnapshot(e.activePayload[0].payload.snapshot);
              }
            }}
            onMouseLeave={() => setHoveredSnapshot(null)}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-700"
            />
            <XAxis
              dataKey="shortDate"
              stroke="currentColor"
              className="text-gray-600 dark:text-gray-400"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="currentColor"
              className="text-gray-600 dark:text-gray-400"
              style={{ fontSize: '12px' }}
              tickFormatter={value => formatBytes(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '13px' }}
              iconType="circle"
              formatter={value => (
                <span className="text-gray-700 dark:text-gray-300">
                  {value === 'newData'
                    ? 'New Data Added'
                    : 'Linked Data (appears but takes no space)'}
                </span>
              )}
            />
            {showComparison ? (
              <Bar
                dataKey="totalSize"
                stackId="a"
                fill="currentColor"
                className="text-indigo-500 dark:text-indigo-400"
                radius={[8, 8, 0, 0]}
              >
                {TIMELINE_DATA.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    className={
                      hoveredSnapshot === entry.snapshot
                        ? 'text-indigo-600 dark:text-indigo-300'
                        : 'text-indigo-500 dark:text-indigo-400'
                    }
                  />
                ))}
              </Bar>
            ) : (
              <>
                <Bar
                  dataKey="newData"
                  stackId="a"
                  fill="currentColor"
                  className="text-orange-500 dark:text-orange-400"
                  radius={[0, 0, 0, 0]}
                >
                  {TIMELINE_DATA.map((entry, index) => (
                    <Cell
                      key={`cell-new-${index}`}
                      className={
                        hoveredSnapshot === entry.snapshot
                          ? 'text-orange-600 dark:text-orange-300'
                          : 'text-orange-500 dark:text-orange-400'
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="linkedData"
                  stackId="a"
                  fill="currentColor"
                  className="text-teal-500 dark:text-teal-400"
                  radius={[8, 8, 0, 0]}
                >
                  {TIMELINE_DATA.map((entry, index) => (
                    <Cell
                      key={`cell-linked-${index}`}
                      className={
                        hoveredSnapshot === entry.snapshot
                          ? 'text-teal-600 dark:text-teal-300'
                          : 'text-teal-500 dark:text-teal-400'
                      }
                    />
                  ))}
                </Bar>
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Explanation */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Icons.Info size={20} className="text-white" />
            </div>
          </div>
          <div className="flex-1 text-sm text-gray-700 dark:text-gray-300 space-y-2">
            <p>
              <strong className="text-gray-900 dark:text-white">How This Works:</strong> Each bar
              represents a snapshot. The{' '}
              <span className="text-orange-600 dark:text-orange-400 font-semibold">
                orange portion
              </span>{' '}
              shows new data that was actually written to disk. The{' '}
              <span className="text-teal-600 dark:text-teal-400 font-semibold">teal portion</span>{' '}
              represents data from previous snapshots that's visible in this backup but doesn't
              consume additional space—it's hard-linked.
            </p>
            <p>
              Toggle to <strong>Cumulative Growth</strong> to see how the total visible size grows
              while actual disk usage stays minimal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
