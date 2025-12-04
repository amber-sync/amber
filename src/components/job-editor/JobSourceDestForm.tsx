import React from 'react';
import { Icons } from '../IconComponents';

interface JobSourceDestFormProps {
  jobSource: string;
  jobDest: string;
  setJobSource: (val: string) => void;
  setJobDest: (val: string) => void;
  onSelectDirectory: (target: 'SOURCE' | 'DEST') => void;
}

export const JobSourceDestForm: React.FC<JobSourceDestFormProps> = ({
  jobSource,
  jobDest,
  setJobSource,
  setJobDest,
  onSelectDirectory,
}) => {
  return (
    <div className="col-span-12 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col md:flex-row items-start gap-6">
        <div className="flex-1 w-full space-y-3">
          <label className="block text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-2">
            <Icons.Server size={14} /> Source
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              className="flex-1 px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 outline-none transition-all font-mono text-sm"
              placeholder="user@host:/path"
              value={jobSource}
              onChange={e => setJobSource(e.target.value)}
            />
            <button
              onClick={() => onSelectDirectory('SOURCE')}
              className="px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors"
            >
              <Icons.Folder size={22} />
            </button>
          </div>
        </div>

        <div className="text-gray-300 dark:text-gray-600 self-center pt-8">
          <Icons.ArrowRight size={28} />
        </div>

        <div className="flex-1 w-full space-y-3">
          <label className="block text-xs font-bold text-accent-primary uppercase tracking-wider flex items-center gap-2">
            <Icons.HardDrive size={14} /> Destination
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              className="flex-1 px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 outline-none transition-all font-mono text-sm"
              placeholder="/Volumes/Backup"
              value={jobDest}
              onChange={e => setJobDest(e.target.value)}
            />
            <button
              onClick={() => onSelectDirectory('DEST')}
              className="px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors"
            >
              <Icons.Folder size={22} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
