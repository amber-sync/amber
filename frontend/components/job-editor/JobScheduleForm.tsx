import React from 'react';
import { Icons } from '../IconComponents';

interface JobScheduleFormProps {
  jobSchedule: number | null;
  setJobSchedule: (val: number | null) => void;
}

export const JobScheduleForm: React.FC<JobScheduleFormProps> = ({ jobSchedule, setJobSchedule }) => {
  const options = [
    { label: 'Manual', val: null, icon: Icons.Play, desc: 'Run only when clicked' },
    { label: 'Auto', val: -1, icon: Icons.Zap, desc: 'Run when drive connects' },
    { label: '5m', val: 5, icon: Icons.Activity, desc: 'Every 5 minutes' },
    { label: '1h', val: 60, icon: Icons.Clock, desc: 'Every hour' },
    { label: 'Daily', val: 1440, icon: Icons.Sun, desc: 'Every day at 15:00' },
    { label: '1w', val: 10080, icon: Icons.Calendar, desc: 'Every week' },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col h-full">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Schedule</label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <div key={opt.label} className="relative group">
            <button
              onClick={() => setJobSchedule(opt.val)}
              className={`w-full py-3 px-1 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${jobSchedule === opt.val
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 ring-1 ring-amber-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
            >
              <opt.icon size={18} />
              <span className="text-[10px] font-medium">{opt.label}</span>
            </button>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 shadow-lg hidden md:block">
              {opt.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
