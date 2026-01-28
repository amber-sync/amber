import React from 'react';
import { Icons } from '../../components/IconComponents';
import { useTheme, Theme } from '../../context/ThemeContext';
import { useSettings } from '../../context';
import { api } from '../../api';
import { logger } from '../../utils/logger';
import { PageContainer } from '../../components/layout';
import { Title, Body, Code, Toggle, Button, Card, IconButton } from '../../components/ui';

const APP_VERSION = '0.0.1-beta';

interface SettingRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  action?: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  checked,
  onChange,
  action,
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1 min-w-0">
      <Body weight="medium">{label}</Body>
      <Body size="sm" color="secondary">
        {description}
      </Body>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {action}
      <Toggle checked={checked} onChange={onChange} size="md" />
    </div>
  </div>
);

const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

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
    <PageContainer width="narrow" scrollable animate>
      <div className="max-w-xl mx-auto space-y-6">
        {/* Theme */}
        <Card variant="default" padding="md">
          <Body weight="medium" className="mb-4">
            Theme
          </Body>
          <div className="flex justify-center gap-8">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className={`
                    w-12 h-12 rounded-xl transition-all overflow-hidden
                    ${theme === t.id ? 'ring-2 ring-accent-primary ring-offset-2 ring-offset-layer-1' : 'ring-1 ring-border-base group-hover:ring-border-highlight'}
                  `}
                >
                  {t.id === 'system' ? (
                    <div className="w-full h-full bg-gradient-to-br from-white from-50% to-gray-800 to-50%" />
                  ) : t.id === 'light' ? (
                    <div className="w-full h-full bg-white" />
                  ) : (
                    <div className="w-full h-full bg-gray-800" />
                  )}
                </div>
                <Body
                  size="sm"
                  weight={theme === t.id ? 'medium' : 'normal'}
                  color={theme === t.id ? 'primary' : 'secondary'}
                >
                  {t.label}
                </Body>
              </button>
            ))}
          </div>
        </Card>

        {/* Behavior */}
        <Card variant="default" padding="md">
          <Title level={4} className="mb-4">
            Behavior
          </Title>
          <div className="space-y-4">
            <SettingRow
              label="Run in Background"
              description="Keep running in menu bar when closed"
              checked={runInBackground}
              onChange={setRunInBackground}
            />
            <div className="border-t border-dashed border-border-base" />
            <SettingRow
              label="Start on Login"
              description="Launch automatically at boot"
              checked={startOnBoot}
              onChange={setStartOnBoot}
            />
            <div className="border-t border-dashed border-border-base" />
            <SettingRow
              label="Notifications"
              description="Alert when jobs complete"
              checked={notificationsEnabled}
              onChange={setNotificationsEnabled}
              action={
                notificationsEnabled ? (
                  <IconButton
                    label="Test notification"
                    variant="ghost"
                    size="sm"
                    onClick={handleTestNotification}
                  >
                    <Icons.Bell size={16} />
                  </IconButton>
                ) : undefined
              }
            />
          </div>
        </Card>

        {/* About */}
        <Card variant="default" padding="md">
          <div className="flex items-center justify-between">
            <div>
              <Body weight="medium">Amber</Body>
              <Body size="sm" color="secondary">
                <Code size="sm">{APP_VERSION}</Code>
                <span className="mx-2">·</span>
                rsync 3.2.7
              </Body>
            </div>
            <Button variant="secondary" size="sm">
              Check for Updates
            </Button>
          </div>
        </Card>

        {/* Copyright */}
        <div className="text-center pt-2">
          <Body size="sm" color="tertiary">
            © 2025 Florian P. Mahner
          </Body>
        </div>
      </div>
    </PageContainer>
  );
};
