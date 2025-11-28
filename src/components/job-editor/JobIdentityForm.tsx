import React from 'react';

interface JobIdentityFormProps {
  jobName: string;
  setJobName: (val: string) => void;
}

export const JobIdentityForm: React.FC<JobIdentityFormProps> = ({ jobName, setJobName }) => {
  return (
    <div className="col-span-12 md:col-span-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Job Name</label>
      <input
        type="text"
        className="w-full px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition-all font-medium text-sm"
        placeholder="e.g. Project Website Backup"
        value={jobName}
        onChange={e => setJobName(e.target.value)}
      />
    </div>
  );
};
