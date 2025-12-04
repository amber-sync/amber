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
    .flatMap(job => (job.snapshots ?? []).map(snap => ({ ...snap, jobName: job.name })))
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="page-content page-animate-in">
      <header className="page-header">
        <h1 className="page-title font-display">Global History</h1>
        <p className="page-subtitle font-body">Timeline of all synchronization events.</p>
      </header>

      <div className="page-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-layer-2/50 text-xs uppercase text-text-tertiary">
              <tr>
                <th className="px-6 py-4 font-semibold">Job Name</th>
                <th className="px-6 py-4 font-semibold">Date & Time</th>
                <th className="px-6 py-4 font-semibold">Changes</th>
                <th className="px-6 py-4 font-semibold">Total Size</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base">
              {history.map(item => (
                <tr key={item.id} className="hover:bg-layer-2/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-text-primary">{item.jobName}</td>
                  <td className="px-6 py-4">{new Date(item.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4">{item.changesCount} files</td>
                  <td className="px-6 py-4 font-mono text-xs">{formatBytes(item.sizeBytes)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success-subtle text-success">
                      <Icons.CheckCircle size={12} /> {item.status}
                    </span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-tertiary">
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
