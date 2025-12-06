/**
 * EmptyState - Placeholder states for no job or no snapshots
 */

import { Icons } from '../../../components/IconComponents';
import { Title, Body } from '../../../components/ui';

interface EmptyStateProps {
  type: 'no-job' | 'no-snapshots';
  onAction: () => void;
  actionLabel: string;
}

export function EmptyState({ type, onAction, actionLabel }: EmptyStateProps) {
  return (
    <div className="tm-empty">
      <div className="tm-empty-icon">
        {type === 'no-job' ? <Icons.Database size={32} /> : <Icons.Clock size={32} />}
      </div>
      <Title level={2} className="tm-empty-title">
        {type === 'no-job' ? 'No Job Selected' : 'No Backups Yet'}
      </Title>
      <Body size="sm" color="secondary" className="tm-empty-desc">
        {type === 'no-job'
          ? 'Select a backup job from the dashboard to explore its history.'
          : 'Run your first backup to start building your time machine.'}
      </Body>
      <button onClick={onAction} className="mt-6 tm-action-btn tm-action-btn--primary">
        {type === 'no-job' ? <Icons.ArrowLeft size={18} /> : <Icons.Play size={18} />}
        <Body size="sm" weight="medium">
          {actionLabel}
        </Body>
      </button>
    </div>
  );
}

export default EmptyState;
