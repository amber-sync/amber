import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';
import { logger } from '../utils/logger';

interface SettingsContextType {
  runInBackground: boolean;
  startOnBoot: boolean;
  notificationsEnabled: boolean;
  setRunInBackground: (val: boolean) => void;
  setStartOnBoot: (val: boolean) => void;
  setNotificationsEnabled: (val: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [runInBackground, setRunInBackground] = useState(false);
  const [startOnBoot, setStartOnBoot] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load preferences
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const prefs = await api.getPreferences();
        setRunInBackground(prefs.runInBackground);
        setStartOnBoot(prefs.startOnBoot);
        setNotificationsEnabled(prefs.notifications);
        setPrefsLoaded(true);
      } catch (err) {
        logger.error('Failed to load preferences', err);
        setPrefsLoaded(true);
      }
    };
    loadPrefs();
  }, []);

  // Persist preferences
  useEffect(() => {
    if (!prefsLoaded) return;
    api
      .setPreferences({
        runInBackground,
        startOnBoot,
        notifications: notificationsEnabled,
      })
      .catch(err => logger.error('Failed to save preferences', err));
  }, [runInBackground, startOnBoot, notificationsEnabled, prefsLoaded]);

  return (
    <SettingsContext.Provider
      value={{
        runInBackground,
        startOnBoot,
        notificationsEnabled,
        setRunInBackground,
        setStartOnBoot,
        setNotificationsEnabled,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
