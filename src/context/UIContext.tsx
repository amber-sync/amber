import React, { createContext, useContext, useState, useEffect } from 'react';
import { useJobs } from './JobsContext';

type ViewType = 'DASHBOARD' | 'TIME_MACHINE' | 'JOB_EDITOR' | 'APP_SETTINGS' | 'HELP' | 'RESTORE_WIZARD';

interface UIContextType {
  activeJobId: string | null;
  view: ViewType;
  setActiveJobId: (id: string | null) => void;
  setView: (view: ViewType) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>('DASHBOARD');
  const { jobs } = useJobs();

  // Initialize activeJobId with first job when jobs are loaded
  useEffect(() => {
    if (activeJobId === null && jobs.length > 0) {
      setActiveJobId(jobs[0].id);
    }
  }, [jobs, activeJobId]);

  return (
    <UIContext.Provider
      value={{
        activeJobId,
        view,
        setActiveJobId,
        setView,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
