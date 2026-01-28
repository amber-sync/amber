import React, { useState } from 'react';
import { Icons } from '@/components/IconComponents';
import { Card, Button } from '@/components/ui';
import { Title, Body, Caption } from '@/components/ui';
import { formatBytes } from '@/utils/formatters';

interface DeleteJobModalProps {
  isOpen: boolean;
  jobName?: string;
  /** Total backup size in bytes */
  backupSize?: number;
  /** Whether the backup destination is mounted/accessible */
  mounted?: boolean;
  onCancel: () => void;
  /** Called with deleteData flag indicating whether to also delete backup data */
  onConfirm: (deleteData: boolean) => void;
  /** Shows loading state on delete button */
  isDeleting?: boolean;
}

export const DeleteJobModal: React.FC<DeleteJobModalProps> = ({
  isOpen,
  jobName,
  backupSize = 0,
  mounted = true,
  onCancel,
  onConfirm,
  isDeleting = false,
}) => {
  const [deleteData, setDeleteData] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(deleteData && mounted);
    setDeleteData(false); // Reset for next use
  };

  const handleCancel = () => {
    setDeleteData(false); // Reset for next use
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
      <Card
        variant="modal"
        padding="lg"
        className="max-w-md w-full transform transition-all scale-100"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
            <Icons.Trash2 size={24} />
          </div>
          <Title level={4} className="mb-2">
            Delete {jobName ? `"${jobName}"` : 'Job'}?
          </Title>
          <Body size="sm" color="secondary" className="mb-4">
            This will remove the job configuration from Amber.
          </Body>

          {/* Delete backup data option */}
          <div
            className={`w-full p-4 rounded-xl border mb-4 text-left ${
              mounted
                ? 'border-border-base bg-layer-2/50'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
            }`}
          >
            <label
              className={`flex items-start gap-3 ${mounted ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
            >
              <input
                type="checkbox"
                checked={deleteData}
                onChange={e => setDeleteData(e.target.checked)}
                disabled={!mounted}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 disabled:opacity-50"
              />
              <div className="flex-1">
                <Body size="sm" weight="medium" className="inline">
                  Also delete backup data
                </Body>
                {backupSize > 0 && (
                  <Body size="sm" color="tertiary" className="inline ml-1">
                    ({formatBytes(backupSize)})
                  </Body>
                )}
                <Caption color="secondary" className="block mt-1">
                  {mounted
                    ? 'This will permanently delete all snapshots from the backup drive.'
                    : 'Backup drive is offline. Connect it to delete backup data.'}
                </Caption>
              </div>
            </label>
          </div>

          {deleteData && mounted && (
            <div className="w-full p-3 bg-red-50 dark:bg-red-900/20 rounded-xl mb-4 text-left">
              <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                <Icons.AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <Caption className="text-red-600 dark:text-red-400">
                  Warning: This will permanently delete {formatBytes(backupSize)} of backup data.
                  This action cannot be undone.
                </Caption>
              </div>
            </div>
          )}

          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              size="md"
              onClick={handleCancel}
              disabled={isDeleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleConfirm}
              disabled={isDeleting}
              loading={isDeleting}
              className="flex-1"
            >
              {deleteData && mounted ? 'Delete All' : 'Delete Job'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
