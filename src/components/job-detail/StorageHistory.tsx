import React from 'react';
import { Icons } from '../IconComponents';

interface StorageHistoryProps {
  chartData: { name: string; dataAdded: number }[];
}

export const StorageHistory: React.FC<StorageHistoryProps> = ({ chartData }) => (
  <div className="bg-layer-1 border border-border-base rounded-xl p-5 shadow-sm">
    <h3 className="text-sm font-bold mb-4 text-text-primary flex items-center gap-2">
      <Icons.BarChart2 size={16} className="text-indigo-500" /> Data Added
    </h3>
    <div className="h-32 w-full flex items-end justify-between gap-1">
      {(() => {
        const values = chartData.map(d => d.dataAdded);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const range = maxVal - minVal;

        return chartData.slice(-15).map((d, i) => {
          let heightPercent = 50;
          if (range > 0) {
            heightPercent = 10 + ((d.dataAdded - minVal) / range) * 80;
          } else if (maxVal > 0) {
            heightPercent = 50;
          } else {
            heightPercent = 2;
          }

          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative">
              <div
                className="w-full mx-0.5 bg-indigo-500/80 dark:bg-indigo-600 rounded-t transition-all hover:bg-indigo-400"
                style={{ height: `${heightPercent}%`, minHeight: '4px' }}
              ></div>
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-2xs px-2 py-1 rounded whitespace-nowrap z-20 shadow-lg">
                {d.name}: +{d.dataAdded.toFixed(2)} MB
              </div>
            </div>
          );
        });
      })()}
      {chartData.length === 0 && (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
          No history yet
        </div>
      )}
    </div>
  </div>
);
