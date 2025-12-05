import React from 'react';
import { JobsProvider, useJobs } from './JobsContext';
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
        <UIProvider>
          {children}
        </UIProvider>
      </JobsProvider>
    </SettingsProvider>
  );
};

/**
 * Backwards-compatible hook that combines all contexts
 * Prefer using specific hooks (useJobs, useUI, useSettings) for better performance
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
