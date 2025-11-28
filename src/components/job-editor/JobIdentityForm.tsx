import React from 'react';

interface JobIdentityFormProps {
  jobName: string;
  setJobName: (val: string) => void;
}

export const JobIdentityForm: React.FC<JobIdentityFormProps> = ({ jobName, setJobName }) => {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col h-full">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Job Name</label>
      <div className="flex-1 flex items-center">
        <div className="relative w-full">
          <input
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="e.g. Daily Backup"
            className="w-full px-5 py-3 pl-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-lg font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900/30 outline-none transition-all"
          />
          <Icons.Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        </div>
      </div>
    </div>
  );
};
