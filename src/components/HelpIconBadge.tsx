import React from 'react';
import type { LucideIcon } from 'lucide-react';

type HelpBadgeVariant = 'indigo' | 'teal' | 'amber' | 'pink' | 'slate';
type HelpBadgeSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<HelpBadgeVariant, string> = {
  indigo: 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30',
  teal: 'bg-gradient-to-br from-teal-500 to-cyan-600 shadow-teal-500/30',
  amber: 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30',
  pink: 'bg-gradient-to-br from-pink-500 to-rose-600 shadow-pink-500/30',
  slate: 'bg-gradient-to-br from-slate-600 to-slate-800 shadow-slate-700/40',
};

const sizeClasses: Record<HelpBadgeSize, { container: string; icon: number }> = {
  sm: { container: 'w-10 h-10', icon: 16 },
  md: { container: 'w-12 h-12', icon: 20 },
  lg: { container: 'w-16 h-16', icon: 28 },
};

interface HelpIconBadgeProps {
  icon: LucideIcon;
  variant?: HelpBadgeVariant;
  size?: HelpBadgeSize;
  className?: string;
}

export const HelpIconBadge: React.FC<HelpIconBadgeProps> = ({
  icon: Icon,
  variant = 'indigo',
  size = 'md',
  className = '',
}) => {
  const sizeInfo = sizeClasses[size];
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl text-white shadow-lg ${variantClasses[variant]} ${sizeInfo.container} ${className}`}
    >
      <Icon size={sizeInfo.icon} />
    </div>
  );
};
