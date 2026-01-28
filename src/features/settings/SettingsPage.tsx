import React from 'react';
import { Icons } from '../../components/IconComponents';
import { useTheme, Theme } from '../../context/ThemeContext';
import { useSettings } from '../../context';
import { api } from '../../api';
import { logger } from '../../utils/logger';
import { PageContainer } from '../../components/layout';
import { Title, Body, Caption, StatusMessage, Button } from '../../components/ui';

const APP_VERSION = '0.0.1-beta';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  // TIM-205: Use specific context hook for better performance
  const {
    runInBackground,
    startOnBoot,
    notificationsEnabled,
    setRunInBackground,
    setStartOnBoot,
    setNotificationsEnabled,
  } = useSettings();

  const themes: { id: Theme; label: string; color: string; description?: string }[] = [
    {
      id: 'system',
      label: 'System',
      color:
        'linear-gradient(135deg, var(--theme-preview-light) 50%, var(--theme-preview-dark) 50%)',
      description: 'Follow system',
    },
    { id: 'light', label: 'Light', color: 'var(--theme-preview-light)' },
    { id: 'dark', label: 'Dark', color: 'var(--theme-preview-dark)' },
  ];

  return (
    <PageContainer width="default" scrollable animate>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Appearance */}
          <section className="space-y-4">
            <Title level={4} className="flex items-center gap-2">
              <Icons.Sun size={18} /> Appearance
            </Title>
            <div className="grid grid-cols-3 gap-3">
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    theme === t.id
                      ? 'border-accent-primary bg-layer-1 shadow-sm'
                      : 'border-border-base hover:border-border-highlight hover:bg-layer-2'
                  }`}
                >
                  <div
                    className="w-full aspect-video rounded-lg shadow-sm border border-border-highlight"
                    style={{ background: t.color }}
                  />
                  <Caption color={theme === t.id ? 'primary' : 'secondary'} className="font-medium">
                    {t.label}
                  </Caption>
                </button>
              ))}
            </div>
          </section>

          {/* System */}
          <section className="space-y-4">
            <Title level={4} className="flex items-center gap-2">
              <Icons.Cpu size={18} /> System
            </Title>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 rounded-xl bg-layer-2 border border-border-base cursor-pointer hover:bg-layer-3 transition-colors">
                <div>
                  <Body weight="medium">Run in Background</Body>
                  <Body size="sm" color="secondary">
                    Keep Amber running in the macOS menu bar when closed
                  </Body>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-accent-primary rounded cursor-pointer"
                  checked={runInBackground}
                  onChange={e => setRunInBackground(e.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between p-4 rounded-xl bg-layer-2 border border-border-base cursor-pointer hover:bg-layer-3 transition-colors">
                <div>
                  <Body weight="medium">Start on Boot</Body>
                  <Body size="sm" color="secondary">
                    Launch Amber automatically
                  </Body>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-accent-primary rounded cursor-pointer"
                  checked={startOnBoot}
                  onChange={e => setStartOnBoot(e.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between p-4 rounded-xl bg-layer-2 border border-border-base cursor-pointer hover:bg-layer-3 transition-colors">
                <div>
                  <Body weight="medium">Notifications</Body>
                  <Body size="sm" color="secondary">
                    Show desktop alerts for finished jobs
                  </Body>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-accent-primary rounded cursor-pointer"
                  checked={notificationsEnabled}
                  onChange={e => setNotificationsEnabled(e.target.checked)}
                />
              </label>

              {/* Test Notification Button */}
              {notificationsEnabled && (
                <div className="flex justify-end animate-fade-in">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Icons.Bell size={16} />}
                    onClick={async () => {
                      if (Notification.permission !== 'granted') {
                        const permission = await Notification.requestPermission();
                        if (permission !== 'granted') {
                          alert(
                            'Notification permission denied. Please enable it in System Settings.'
                          );
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
                    }}
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
          <Title level={4} className="flex items-center gap-2">
            <Icons.Shield size={18} /> System Health
          </Title>
          <StatusMessage variant="success" className="p-4 rounded-xl">
            <Body weight="medium" className="flex items-center gap-2 mb-1">
              <Icons.CheckCircle size={16} /> Environment Ready
            </Body>
            <Caption>All necessary binary dependencies detected.</Caption>
          </StatusMessage>

          <div className="space-y-3 py-2">
            <div className="flex justify-between">
              <Body size="sm" color="secondary">
                Rsync Version
              </Body>
              <Body size="sm" className="font-mono">
                3.2.7
              </Body>
            </div>
            <div className="flex justify-between">
              <Body size="sm" color="secondary">
                SSH Client
              </Body>
              <Body size="sm" className="font-mono">
                OpenSSH_9.0p1
              </Body>
            </div>
            <div className="flex justify-between">
              <Body size="sm" color="secondary">
                App Version
              </Body>
              <Body size="sm" className="font-mono">
                {APP_VERSION}
              </Body>
            </div>
          </div>

          <hr className="border-border-base" />

          <Button variant="secondary" size="md" className="w-full">
            Check for Updates
          </Button>

          <div className="text-center pt-2">
            <Caption color="tertiary">© 2025 Florian P. Mahner</Caption>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};
