import React from 'react';
import { SyncJob } from '../types';
import { Icons } from '../components/IconComponents';
import { formatBytes } from '../utils/formatters';

interface HistoryViewProps {
  jobs: SyncJob[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({ jobs }) => {
  // Flatten and sort all snapshots from all jobs
  const history = jobs
    .flatMap(job => job.snapshots.map(snap => ({ ...snap, jobName: job.name })))
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="p-8 space-y-6 animate-fade-in relative z-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Global History
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Timeline of all synchronization events.
        </p>
      </header>

      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-6 py-4 font-semibold">Job Name</th>
                <th className="px-6 py-4 font-semibold">Date & Time</th>
                <th className="px-6 py-4 font-semibold">Changes</th>
                <th className="px-6 py-4 font-semibold">Total Size</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {history.map(item => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                    {item.jobName}
                  </td>
                  <td className="px-6 py-4">{new Date(item.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4">{item.changesCount} files</td>
                  <td className="px-6 py-4 font-mono text-xs">{formatBytes(item.sizeBytes)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      <Icons.CheckCircle size={12} /> {item.status}
                    </span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    No history records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
