import React from 'react';
import { Icons } from '../IconComponents';
import { Title, Body, Caption } from '../ui';

type View =
  | 'DASHBOARD'
  | 'TIME_MACHINE'
  | 'JOB_EDITOR'
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
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
      active
        ? 'bg-accent-secondary text-text-primary border-l-2 border-accent-primary'
        : 'text-text-secondary hover:bg-layer-3 hover:text-text-primary'
    }`}
  >
    {icon}{' '}
    <Body size="sm" weight="medium">
      {label}
    </Body>
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => (
  <aside className="w-44 bg-layer-1 border-r border-border-base hidden md:flex flex-col transition-colors duration-300 relative z-10 pt-6">
    <div className="p-6 flex items-center gap-3">
      <div className="w-9 h-9 bg-accent-primary rounded-xl flex items-center justify-center text-accent-text shadow-[var(--shadow-card)]">
        <Icons.Activity size={20} />
      </div>
      <Title level={3}>Amber</Title>
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

    <div className="p-4 border-t border-border-base flex justify-center">
      <Caption color="tertiary">v0.0.1-beta</Caption>
    </div>
  </aside>
);
