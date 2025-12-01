import React from 'react';
import { Icons } from './IconComponents';
import { Panel } from './ui';

interface DeleteJobModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteJobModal: React.FC<DeleteJobModalProps> = ({ isOpen, onCancel, onConfirm }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
      <Panel variant="modal" className="max-w-sm w-full transform transition-all scale-100">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
            <Icons.Trash2 size={24} />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">Delete Job?</h3>
          <p className="text-sm text-text-secondary mb-6">
            Are you sure you want to delete this sync job? This action cannot be undone.
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-xl font-medium text-text-primary bg-layer-2 hover:bg-layer-3 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
};
