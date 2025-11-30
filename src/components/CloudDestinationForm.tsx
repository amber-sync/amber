import React from 'react';
import { Icons } from './IconComponents';

interface CloudDestinationFormProps {
  remoteName: string;
  remotePath: string;
  encrypt: boolean;
  bandwidth: string;
  onRemoteNameChange: (value: string) => void;
  onRemotePathChange: (value: string) => void;
  onEncryptChange: (value: boolean) => void;
  onBandwidthChange: (value: string) => void;
}

export const CloudDestinationForm: React.FC<CloudDestinationFormProps> = ({
  remoteName,
  remotePath,
  encrypt,
  bandwidth,
  onRemoteNameChange,
  onRemotePathChange,
  onEncryptChange,
  onBandwidthChange,
}) => {
  // Cloud backup via rclone is not yet ported to the Tauri backend
  return (
    <div className="p-6 bg-layer-2 rounded-xl border border-border-highlight">
      <div className="flex gap-4">
        <div className="p-3 bg-info-subtle rounded-lg shrink-0">
          <Icons.Cloud size={24} className="text-info" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-text-primary mb-2">Cloud Backup Coming Soon</h3>
          <p className="text-sm text-text-secondary mb-4">
            Cloud backup functionality (S3, Google Drive, etc.) is being ported to the new Rust backend.
            In the meantime, use a local or network destination.
          </p>
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Icons.Clock size={14} />
            <span>This feature will be available in a future release</span>
          </div>
        </div>
      </div>
    </div>
  );
};
