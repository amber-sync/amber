import React from 'react';
import { Icons } from '../components/IconComponents';
import { useTheme, Theme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { logger } from '../utils/logger';

const APP_VERSION = '0.0.1-beta';

export const AppSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const {
    runInBackground,
    startOnBoot,
    notificationsEnabled,
    setRunInBackground,
    setStartOnBoot,
    setNotificationsEnabled,
  } = useApp();

  const themes: { id: Theme; label: string; color: string; description?: string }[] = [
    {
      id: 'system',
      label: 'System',
      color: 'linear-gradient(135deg, #ffffff 50%, #1f2937 50%)',
      description: 'Follow system',
    },
    { id: 'light', label: 'Light', color: '#ffffff' },
    { id: 'dark', label: 'Dark', color: '#1f2937' },
  ];

  return (
    <div className="page page-scroll page-animate-in">
      <div className="page-content">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Settings Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Appearance */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Icons.Sun size={18} /> Appearance
              </h3>
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
                    <span
                      className={`text-xs font-medium ${theme === t.id ? 'text-text-primary' : 'text-text-secondary'}`}
                    >
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* System */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Icons.Cpu size={18} /> System
              </h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-layer-2 border border-border-base cursor-pointer hover:bg-layer-3 transition-colors">
                  <div>
                    <div className="font-medium text-text-primary">Run in Background</div>
                    <div className="text-sm text-text-secondary">
                      Keep Amber running in the macOS menu bar when closed
                    </div>
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
                    <div className="font-medium text-text-primary">Start on Boot</div>
                    <div className="text-sm text-text-secondary">Launch Amber automatically</div>
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
                    <div className="font-medium text-text-primary">Notifications</div>
                    <div className="text-sm text-text-secondary">
                      Show desktop alerts for finished jobs
                    </div>
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
                    <button
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
                      className="px-4 py-2 text-sm font-medium text-accent-primary bg-accent-secondary/20 hover:bg-accent-secondary/30 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Icons.Bell size={16} />
                      Test Notification
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* System Health Sidebar */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <Icons.Shield size={18} /> System Health
            </h3>
            <div className="p-4 rounded-xl bg-success-subtle border border-[var(--color-success)]/20">
              <div className="flex items-center gap-2 text-[var(--color-success)] font-medium mb-1">
                <Icons.CheckCircle size={16} /> Environment Ready
              </div>
              <p className="text-xs text-[var(--color-success)]/80">
                All necessary binary dependencies detected.
              </p>
            </div>

            <div className="space-y-3 py-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Rsync Version</span>
                <span className="font-mono text-text-primary">3.2.7</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">SSH Client</span>
                <span className="font-mono text-text-primary">OpenSSH_9.0p1</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">App Version</span>
                <span className="font-mono text-text-primary">{APP_VERSION}</span>
              </div>
            </div>

            <hr className="border-border-base" />

            <button className="w-full py-2.5 rounded-xl bg-layer-2 hover:bg-layer-3 text-sm font-medium text-text-primary transition-colors border border-border-base">
              Check for Updates
            </button>

            <div className="text-center pt-2">
              <p className="text-xs text-text-tertiary">© 2025 Florian P. Mahner</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
