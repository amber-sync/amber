import React from 'react';
import { Icons } from './IconComponents';

type View =
  | 'DASHBOARD'
  | 'TIME_MACHINE'
  | 'JOB_EDITOR'
  | 'DETAIL'
  | 'HISTORY'
  | 'APP_SETTINGS'
  | 'HELP'
  | 'RESTORE_WIZARD';

interface SidebarProps {
  activeView: View;
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
    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 ${
      active
        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-l-2 border-amber-500'
        : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
    }`}
    style={{ fontFamily: 'DM Sans, sans-serif' }}
  >
    {icon} {label}
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => (
  <aside className="w-64 bg-gradient-to-b from-stone-50 to-stone-100 dark:from-stone-950 dark:to-stone-900 backdrop-blur-md border-r border-stone-200 dark:border-stone-800 hidden md:flex flex-col transition-colors duration-300 relative z-10 pt-6">
    <div className="p-6 flex items-center gap-3">
      <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
        <Icons.Activity size={20} />
      </div>
      <span
        className="font-bold text-xl tracking-tight text-stone-900 dark:text-stone-100"
        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        Amber
      </span>
    </div>

    <nav className="flex-1 px-4 py-4 space-y-1">
      <SidebarButton
        label="Dashboard"
        icon={<Icons.Database size={18} />}
        active={activeView === 'DASHBOARD'}
        onClick={() => onNavigate('DASHBOARD')}
      />
      <SidebarButton
        label="Time Machine"
        icon={<Icons.Clock size={18} />}
        active={activeView === 'TIME_MACHINE'}
        onClick={() => onNavigate('TIME_MACHINE')}
      />
      <SidebarButton
        label="History"
        icon={<Icons.List size={18} />}
        active={activeView === 'HISTORY'}
        onClick={() => onNavigate('HISTORY')}
      />
      <SidebarButton
        label="Settings"
        icon={<Icons.Settings size={18} />}
        active={activeView === 'APP_SETTINGS'}
        onClick={() => onNavigate('APP_SETTINGS')}
      />
      <SidebarButton
        label="Help"
        icon={<Icons.Info size={18} />}
        active={activeView === 'HELP'}
        onClick={() => onNavigate('HELP')}
      />
    </nav>

    <div className="p-4 border-t border-stone-200 dark:border-stone-800">
      <div
        className="text-xs text-stone-500 dark:text-stone-500 text-center"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      >
        v0.0.1-beta
      </div>
    </div>
  </aside>
);
