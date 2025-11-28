import React, { useState } from 'react';
import { Icons } from './IconComponents';

interface CloudProviderWizardProps {
  onComplete: (remoteName: string, provider: string) => void;
  onCancel: () => void;
}

interface ProviderConfig {
  type: string;
  name: string;
  icon: React.ReactNode;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'password';
    placeholder?: string;
    required: boolean;
  }[];
}

const PROVIDERS: ProviderConfig[] = [
  {
    type: 's3',
    name: 'Amazon S3 / Wasabi / Backblaze B2',
    icon: <Icons.Database size={24} />,
    fields: [
      { key: 'access_key_id', label: 'Access Key ID', type: 'text', required: true },
      { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1', required: true },
      { key: 'endpoint', label: 'Endpoint (optional)', type: 'text', placeholder: 's3.wasabisys.com', required: false },
    ],
  },
  {
    type: 'drive',
    name: 'Google Drive',
    icon: <Icons.Cloud size={24} />,
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    ],
  },
  {
    type: 'dropbox',
    name: 'Dropbox',
    icon: <Icons.Cloud size={24} />,
    fields: [
      { key: 'client_id', label: 'App Key', type: 'text', required: true },
      { key: 'client_secret', label: 'App Secret', type: 'password', required: true },
    ],
  },
];

export const CloudProviderWizard: React.FC<CloudProviderWizardProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [remoteName, setRemoteName] = useState('');
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProviderSelect = (provider: ProviderConfig) => {
    setSelectedProvider(provider);
    setRemoteName(`my${provider.type}`);
    setStep('configure');
  };

  const handleConfigChange = (key: string, value: string) => {
    setConfigValues(prev => ({ ...prev, [key]: value }));
  };

  const handleCreate = async () => {
    if (!selectedProvider || !remoteName) return;

    // Validate required fields
    const missingFields = selectedProvider.fields
      .filter(f => f.required && !configValues[f.key])
      .map(f => f.label);

    if (missingFields.length > 0) {
      setError(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Create rclone config via IPC
      // @ts-ignore - electron API
      const result = await window.electron.rcloneCreateRemote({
        name: remoteName,
        type: selectedProvider.type,
        config: configValues,
      });

      if (result.success) {
        onComplete(remoteName, selectedProvider.type);
      } else {
        setError(result.error || 'Failed to create remote');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create remote');
    } finally {
      setIsCreating(false);
    }
  };

  if (step === 'select') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-layer-1 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-border-base flex justify-between items-center">
            <h2 className="text-2xl font-bold text-text-primary">Choose Cloud Provider</h2>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-layer-2 rounded-lg transition-colors"
            >
              <Icons.X size={20} className="text-text-secondary" />
            </button>
          </div>

          <div className="p-6 space-y-3">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.type}
                onClick={() => handleProviderSelect(provider)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border-base hover:border-accent-primary hover:bg-layer-2 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-layer-3 text-accent-primary group-hover:bg-accent-primary group-hover:text-accent-text transition-colors">
                  {provider.icon}
                </div>
                <div>
                  <div className="font-bold text-text-primary">{provider.name}</div>
                  <div className="text-sm text-text-tertiary">Configure and connect</div>
                </div>
                <Icons.ArrowRight className="ml-auto text-text-tertiary group-hover:text-accent-primary" size={20} />
              </button>
            ))}

            <div className="mt-6 p-4 bg-layer-2 rounded-xl border border-border-highlight">
              <div className="flex gap-3">
                <Icons.Info size={20} className="text-accent-primary shrink-0 mt-0.5" />
                <div className="text-sm text-text-secondary">
                  <strong>Advanced:</strong> Need a different provider? Use Terminal to run <code className="px-2 py-0.5 bg-layer-3 rounded">rclone config</code> manually.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Configure step
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-layer-1 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border-base flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('select')}
              className="p-2 hover:bg-layer-2 rounded-lg transition-colors"
            >
              <Icons.ArrowLeft size={20} className="text-text-secondary" />
            </button>
            <h2 className="text-2xl font-bold text-text-primary">{selectedProvider?.name}</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-layer-2 rounded-lg transition-colors"
          >
            <Icons.X size={20} className="text-text-secondary" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Remote Name
            </label>
            <input
              type="text"
              value={remoteName}
              onChange={(e) => setRemoteName(e.target.value)}
              className="w-full px-4 py-2 bg-layer-2 border border-border-base rounded-lg text-text-primary placeholder-text-tertiary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none"
              placeholder="mycloud"
            />
            <p className="mt-1 text-xs text-text-tertiary">Choose a unique name for this remote</p>
          </div>

          {selectedProvider?.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-text-primary mb-2">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type={field.type}
                value={configValues[field.key] || ''}
                onChange={(e) => handleConfigChange(field.key, e.target.value)}
                className="w-full px-4 py-2 bg-layer-2 border border-border-base rounded-lg text-text-primary placeholder-text-tertiary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none"
                placeholder={field.placeholder}
              />
            </div>
          ))}

          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
              <div className="flex gap-2">
                <Icons.AlertCircle size={20} className="text-red-600 dark:text-red-400 shrink-0" />
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-layer-2 hover:bg-layer-3 text-text-primary rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !remoteName}
              className="flex-1 px-4 py-2 bg-accent-primary hover:opacity-90 text-accent-text rounded-lg font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <Icons.RefreshCw size={18} className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Remote'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
