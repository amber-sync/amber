import React from 'react';
import { Icons } from './IconComponents';

type View = 'DASHBOARD' | 'JOB_EDITOR' | 'DETAIL' | 'HISTORY' | 'APP_SETTINGS' | 'HELP';

interface SidebarProps {
  view: View;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigate: (view: View) => void;
}

interface SidebarButtonProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
    }`}
  >
    {icon} {label}
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({ view, darkMode, onToggleDarkMode, onNavigate }) => (
  <aside className="w-64 bg-white/80 dark:bg-[#161617]/80 backdrop-blur-md border-r border-gray-200 dark:border-gray-800 hidden md:flex flex-col transition-colors duration-300 relative z-10 pt-6">
    <div className="p-6 flex items-center gap-3">
      <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
        <Icons.Activity size={20} />
      </div>
      <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">Amber</span>
    </div>

    <nav className="flex-1 px-4 py-4 space-y-1">
      <SidebarButton
        label="Dashboard"
        icon={<Icons.Database size={18} />}
        active={view === 'DASHBOARD'}
        onClick={() => onNavigate('DASHBOARD')}
      />
      <SidebarButton
        label="History"
        icon={<Icons.List size={18} />}
        active={view === 'HISTORY'}
        onClick={() => onNavigate('HISTORY')}
      />
      <SidebarButton
        label="Settings"
        icon={<Icons.Settings size={18} />}
        active={view === 'APP_SETTINGS'}
        onClick={() => onNavigate('APP_SETTINGS')}
      />
      <SidebarButton
        label="Help"
        icon={<Icons.Info size={18} />}
        active={view === 'HELP'}
        onClick={() => onNavigate('HELP')}
      />
    </nav>

    <div className="p-4 border-t border-gray-100 dark:border-gray-800">
      <button
        onClick={onToggleDarkMode}
        className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-600 dark:text-gray-300 text-xs font-medium"
      >
        <span className="flex items-center gap-2">
          {darkMode ? <Icons.Moon size={14} /> : <Icons.Sun size={14} />}
          {darkMode ? 'Dark Mode' : 'Light Mode'}
        </span>
        <div className={`w-8 h-4 rounded-full relative transition-colors ${darkMode ? 'bg-teal-600' : 'bg-gray-300'}`}>
          <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
        </div>
      </button>
    </div>
  </aside>
);
