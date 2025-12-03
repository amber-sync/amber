import React from 'react';
import { Icons } from './IconComponents';

type View =
  | 'DASHBOARD'
  | 'TIMELINE'
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
    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-layer-2 text-text-primary'
        : 'text-text-secondary hover:bg-layer-2 hover:text-text-primary'
    }`}
  >
    {icon} {label}
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => (
  <aside className="w-64 bg-layer-1/80 backdrop-blur-md border-r border-border-base hidden md:flex flex-col transition-colors duration-300 relative z-10 pt-6">
    <div className="p-6 flex items-center gap-3">
      <div className="w-8 h-8 bg-accent-primary rounded-lg flex items-center justify-center text-accent-text shadow-lg shadow-accent-primary/30">
        <Icons.Activity size={20} />
      </div>
      <span className="font-bold text-lg tracking-tight text-text-primary">Amber</span>
    </div>

    <nav className="flex-1 px-4 py-4 space-y-1">
      <SidebarButton
        label="Dashboard"
        icon={<Icons.Database size={18} />}
        active={activeView === 'DASHBOARD'}
        onClick={() => onNavigate('DASHBOARD')}
      />
      <SidebarButton
        label="Timeline"
        icon={<Icons.History size={18} />}
        active={activeView === 'TIMELINE'}
        onClick={() => onNavigate('TIMELINE')}
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

    <div className="p-4 border-t border-border-base">
      <div className="text-xs text-text-tertiary text-center">v0.0.1-beta</div>
    </div>
  </aside>
);
