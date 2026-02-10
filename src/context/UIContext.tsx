import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { useJobs } from '@/features/jobs/context/JobsContext';

export type ViewType =
  | 'DASHBOARD'
  | 'TIME_MACHINE'
  | 'JOB_EDITOR'
  | 'APP_SETTINGS'
  | 'HELP'
  | 'RESTORE_WIZARD';

interface UIContextType {
  activeJobId: string | null;
  view: ViewType;
  previousView: ViewType | null;
  setActiveJobId: (id: string | null) => void;
  setView: (view: ViewType) => void;
  navigateBack: () => void;
  navigateToJob: (jobId: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>('DASHBOARD');
  const [previousView, setPreviousView] = useState<ViewType | null>(null);
  const { jobs } = useJobs();

  // Initialize activeJobId with first job when jobs are loaded
  useEffect(() => {
    if (activeJobId === null && jobs.length > 0) {
      setActiveJobId(jobs[0].id);
    }
  }, [jobs, activeJobId]);

  // Enhanced setView that tracks previous view
  const handleSetView = useCallback(
    (newView: ViewType) => {
      setPreviousView(view);
      setView(newView);
    },
    [view]
  );

  // Navigate back to previous view
  const navigateBack = useCallback(() => {
    if (previousView) {
      setView(previousView);
      setPreviousView(null);
    } else {
      // Default fallback to DASHBOARD if no previous view
      setView('DASHBOARD');
    }
  }, [previousView]);

  // Atomic navigation: sets job + view in a single batch to avoid intermediate renders
  const navigateToJob = useCallback(
    (jobId: string) => {
      setActiveJobId(jobId);
      setPreviousView(view);
      setView('TIME_MACHINE');
    },
    [view]
  );

  const value = useMemo(
    () => ({
      activeJobId,
      view,
      previousView,
      setActiveJobId,
      setView: handleSetView,
      navigateBack,
      navigateToJob,
    }),
    [activeJobId, view, previousView, handleSetView, navigateBack, navigateToJob]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
