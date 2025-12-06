import React from 'react';
import { Icons } from './IconComponents';
import { Title, Body, Caption } from './ui';

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
          <Title level={4} className="mb-2">
            Cloud Backup Coming Soon
          </Title>
          <Body size="sm" color="secondary" className="mb-4">
            Cloud backup functionality (S3, Google Drive, etc.) is being ported to the new Rust
            backend. In the meantime, use a local or network destination.
          </Body>
          <div className="flex items-center gap-2">
            <Icons.Clock size={14} className="text-text-tertiary" />
            <Caption color="tertiary">This feature will be available in a future release</Caption>
          </div>
        </div>
      </div>
    </div>
  );
};
