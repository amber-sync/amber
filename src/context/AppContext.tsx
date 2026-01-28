import React from 'react';
import { JobsProvider, useJobs } from '@/features/jobs/context/JobsContext';
import { UIProvider, useUI } from './UIContext';
import { SettingsProvider, useSettings } from './SettingsContext';

/**
 * Combined AppContext provider that wraps all specialized contexts
 * This prevents cascading re-renders by splitting state into focused contexts
 */
export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SettingsProvider>
      <JobsProvider>
        <UIProvider>{children}</UIProvider>
      </JobsProvider>
    </SettingsProvider>
  );
};

/**
 * Backwards-compatible hook that combines all contexts.
 *
 * IMPORTANT: Prefer using specific hooks for better performance:
 * - useJobs() for jobs, runSync, stopSync, persistJob, deleteJob
 * - useUI() for activeJobId, setActiveJobId, setView, navigateBack
 * - useSettings() for app settings
 * - useTheme() for theme (from ThemeContext)
 *
 * Using useApp() causes re-renders when ANY context changes,
 * while specific hooks only re-render when their data changes.
 *
 * @deprecated Use specific hooks (useJobs, useUI, useSettings, useTheme) instead
 */
export const useApp = () => {
  const jobs = useJobs();
  const ui = useUI();
  const settings = useSettings();

  return {
    ...jobs,
    ...ui,
    ...settings,
  };
};
