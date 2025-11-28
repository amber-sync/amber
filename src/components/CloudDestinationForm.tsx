import React, { useState, useEffect } from 'react';
import { Icons } from './IconComponents';
import { CloudProviderWizard } from './CloudProviderWizard';

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
  const [showWizard, setShowWizard] = useState(false);
  const [remotes, setRemotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [rcloneInstalled, setRcloneInstalled] = useState(false);

  useEffect(() => {
    checkRclone();
  }, []);

  const checkRclone = async () => {
    try {
      // @ts-ignore
      const result = await window.electronAPI.rcloneCheckInstalled();
      setRcloneInstalled(result.installed);
      
      if (result.installed) {
        loadRemotes();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to check Rclone:', error);
      setLoading(false);
    }
  };

  const loadRemotes = async () => {
    try {
      // @ts-ignore
      const remoteList = await window.electronAPI.rcloneListRemotes();
      setRemotes(remoteList.map((r: any) => r.name));
    } catch (error) {
      console.error('Failed to load remotes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWizardComplete = (newRemoteName: string) => {
    setShowWizard(false);
    loadRemotes();
    onRemoteNameChange(newRemoteName);
  };

  if (!rcloneInstalled) {
    return (
      <div className="p-6 bg-layer-2 rounded-xl border border-border-highlight">
        <div className="flex gap-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg shrink-0">
            <Icons.AlertCircle size={24} className="text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-text-primary mb-2">Rclone Not Installed</h3>
            <p className="text-sm text-text-secondary mb-4">
              Cloud backup requires Rclone. Install it to sync to S3, Google Drive, and more.
            </p>
            <div className="bg-layer-3 p-3 rounded-lg mb-4">
              <code className="text-xs text-accent-primary">brew install rclone</code>
            </div>
            <button
              onClick={checkRclone}
              className="px-4 py-2 bg-accent-primary text-accent-text rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
            >
              Re-check Installation
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Cloud Remote
          </label>
          <div className="flex gap-2">
            <select
              value={remoteName}
              onChange={(e) => onRemoteNameChange(e.target.value)}
              className="flex-1 px-4 py-2 bg-layer-2 border border-border-base rounded-lg text-text-primary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none"
              disabled={loading}
            >
              <option value="">Select a remote...</option>
              {remotes.map((remote) => (
                <option key={remote} value={remote}>
                  {remote}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowWizard(true)}
              className="px-4 py-2 bg-layer-2 hover:bg-layer-3 border border-border-base rounded-lg text-text-primary font-medium transition-colors flex items-center gap-2"
            >
              <Icons.Plus size={18} />
              New Remote
            </button>
          </div>
          {remotes.length === 0 && !loading && (
            <p className="mt-2 text-xs text-text-tertiary">
              No remotes configured yet. Click "New Remote" to set up S3, Google Drive, etc.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Remote Path (optional)
          </label>
          <input
            type="text"
            value={remotePath}
            onChange={(e) => onRemotePathChange(e.target.value)}
            placeholder="/backup/myfiles"
            className="w-full px-4 py-2 bg-layer-2 border border-border-base rounded-lg text-text-primary placeholder-text-tertiary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none"
          />
          <p className="mt-1 text-xs text-text-tertiary">
            Subfolder within the remote (e.g., /backup/documents)
          </p>
        </div>

        <div className="flex items-center gap-3 p-4 bg-layer-2 rounded-lg border border-border-base">
          <input
            type="checkbox"
            id="cloud-encrypt"
            checked={encrypt}
            onChange={(e) => onEncryptChange(e.target.checked)}
            className="w-4 h-4 text-accent-primary bg-layer-3 border-border-highlight rounded focus:ring-accent-primary"
          />
          <label htmlFor="cloud-encrypt" className="flex-1 cursor-pointer">
            <div className="font-medium text-text-primary">Enable Encryption</div>
            <div className="text-xs text-text-tertiary">
              Encrypt files before uploading (recommended for cloud storage)
            </div>
          </label>
          <Icons.Shield size={20} className="text-accent-primary" />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Bandwidth Limit (optional)
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={bandwidth}
              onChange={(e) => onBandwidthChange(e.target.value)}
              placeholder="10"
              className="w-24 px-4 py-2 bg-layer-2 border border-border-base rounded-lg text-text-primary placeholder-text-tertiary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none"
            />
            <span className="text-text-secondary">MB/s</span>
            <span className="text-xs text-text-tertiary ml-2">Leave empty for unlimited</span>
          </div>
        </div>
      </div>

      {showWizard && (
        <CloudProviderWizard
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </>
  );
};
