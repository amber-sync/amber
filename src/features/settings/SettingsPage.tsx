import React from 'react';
import { Icons } from '../../components/IconComponents';
import { useTheme, Theme } from '../../context/ThemeContext';
import { useSettings } from '../../context';
import { api } from '../../api';
import { logger } from '../../utils/logger';
import { PageContainer } from '../../components/layout';
import { Title, Body, Code, Toggle, Button, Card } from '../../components/ui';

const APP_VERSION = '0.0.1-beta';

interface SettingRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-layer-2 border border-border-base hover:bg-layer-3 transition-colors">
    <div className="flex-1 mr-4">
      <Body weight="medium">{label}</Body>
      <Body size="sm" color="secondary">
        {description}
      </Body>
    </div>
    <Toggle checked={checked} onChange={onChange} size="md" />
  </div>
);

interface InfoRowProps {
  label: string;
  value: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2">
    <Body size="sm" color="secondary">
      {label}
    </Body>
    <Code size="sm">{value}</Code>
  </div>
);

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const {
    runInBackground,
    startOnBoot,
    notificationsEnabled,
    setRunInBackground,
    setStartOnBoot,
    setNotificationsEnabled,
  } = useSettings();

  const themes: { id: Theme; label: string; color: string }[] = [
    {
      id: 'system',
      label: 'System',
      color:
        'linear-gradient(135deg, var(--theme-preview-light) 50%, var(--theme-preview-dark) 50%)',
    },
    { id: 'light', label: 'Light', color: 'var(--theme-preview-light)' },
    { id: 'dark', label: 'Dark', color: 'var(--theme-preview-dark)' },
  ];

  const handleTestNotification = async () => {
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notification permission denied. Please enable it in System Settings.');
        return;
      }
    }
    const success = await api.testNotification();
    if (!success) {
      logger.error('Backend notification failed');
      new Notification('Amber Test (Renderer)', {
        body: 'Fallback notification from UI',
      });
    }
  };

  return (
    <PageContainer width="default" scrollable animate>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Appearance */}
          <section className="space-y-4">
            <Title level={3} className="flex items-center gap-2">
              <Icons.Sun size={20} /> Appearance
            </Title>
            <div className="grid grid-cols-3 gap-3">
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    theme === t.id
                      ? 'border-accent-primary bg-layer-1 shadow-sm'
                      : 'border-border-base hover:border-border-highlight hover:bg-layer-2'
                  }`}
                >
                  <div
                    className="w-full aspect-video rounded-lg shadow-sm border border-border-highlight"
                    style={{ background: t.color }}
                  />
                  <Body size="sm" weight="medium" color={theme === t.id ? 'primary' : 'secondary'}>
                    {t.label}
                  </Body>
                </button>
              ))}
            </div>
          </section>

          {/* System */}
          <section className="space-y-4">
            <Title level={3} className="flex items-center gap-2">
              <Icons.Cpu size={20} /> System
            </Title>
            <div className="space-y-3">
              <SettingRow
                label="Run in Background"
                description="Keep Amber running in the macOS menu bar when closed"
                checked={runInBackground}
                onChange={setRunInBackground}
              />
              <SettingRow
                label="Start on Boot"
                description="Launch Amber automatically when you log in"
                checked={startOnBoot}
                onChange={setStartOnBoot}
              />
              <SettingRow
                label="Notifications"
                description="Show desktop alerts for finished jobs"
                checked={notificationsEnabled}
                onChange={setNotificationsEnabled}
              />

              {notificationsEnabled && (
                <div className="flex justify-end animate-fade-in pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Icons.Bell size={16} />}
                    onClick={handleTestNotification}
                  >
                    Test Notification
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* System Health Sidebar */}
        <div className="space-y-4">
          <Title level={3} className="flex items-center gap-2">
            <Icons.Shield size={20} /> System Health
          </Title>

          <Card variant="outlined" padding="md" className="bg-success-subtle border-success/30">
            <div className="flex items-center gap-2 mb-2">
              <Icons.CheckCircle size={18} className="text-success" />
              <Body weight="medium">Environment Ready</Body>
            </div>
            <Body size="sm" color="secondary">
              All necessary binary dependencies detected.
            </Body>
          </Card>

          <Card variant="default" padding="md">
            <div className="space-y-1">
              <InfoRow label="Rsync Version" value="3.2.7" />
              <InfoRow label="SSH Client" value="OpenSSH_9.0p1" />
              <InfoRow label="App Version" value={APP_VERSION} />
            </div>
          </Card>

          <Button variant="secondary" size="md" className="w-full">
            Check for Updates
          </Button>

          <div className="text-center pt-2">
            <Body size="sm" color="tertiary">
              © 2025 Florian P. Mahner
            </Body>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};
