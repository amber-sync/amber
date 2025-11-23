import React from 'react';
import { Icons } from '../components/IconComponents';

interface AppSettingsProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const AppSettings: React.FC<AppSettingsProps> = ({ darkMode, onToggleDarkMode }) => (
  <div className="p-8 space-y-6 animate-fade-in relative z-10">
    <header className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-1">Application preferences and configuration.</p>
    </header>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      <div className="xl:col-span-2 space-y-8">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          {/* Appearance */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Icons.Sun size={20} /> Appearance
            </h3>
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Dark Mode</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Toggle application theme</div>
              </div>
              <button
                onClick={onToggleDarkMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${darkMode ? 'bg-teal-600' : 'bg-gray-200 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {/* System */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Icons.Cpu size={20} /> System
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Run in Background</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Keep Amber running in the macOS menu bar when closed</div>
                </div>
                <input type="checkbox" className="w-4 h-4 text-teal-600 rounded" defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Start on Boot</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Launch Amber automatically</div>
                </div>
                <input type="checkbox" className="w-4 h-4 text-teal-600 rounded" defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Notifications</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Show desktop alerts for finished jobs</div>
                </div>
                <input type="checkbox" className="w-4 h-4 text-teal-600 rounded" defaultChecked />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About / System Check */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700 p-6 h-fit">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <Icons.Shield size={20} /> System Health
        </h3>
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-1">
              <Icons.CheckCircle size={16} /> Environment Ready
            </div>
            <p className="text-xs text-green-600 dark:text-green-500">
              All necessary binary dependencies detected.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Rsync Version</span>
              <span className="font-mono text-gray-900 dark:text-gray-200">3.2.7</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">SSH Client</span>
              <span className="font-mono text-gray-900 dark:text-gray-200">OpenSSH_9.0p1</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">App Version</span>
              <span className="font-mono text-gray-900 dark:text-gray-200">1.0.0-beta</span>
            </div>
          </div>

          <hr className="border-gray-100 dark:border-gray-700" />

          <button className="w-full py-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
            Check for Updates
          </button>

          <div className="text-center pt-2">
            <p className="text-xs text-gray-400 dark:text-gray-600">
              © 2024 Amber Sync Inc.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);
