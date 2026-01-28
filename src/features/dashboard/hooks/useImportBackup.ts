/**
 * TIM-220: Hook for importing orphan backups
 */

import { useState, useCallback } from 'react';
import { api } from '@/api';
import type { DiscoveredBackup, SyncJob } from '@/types';

interface UseImportBackupReturn {
  // State
  isScanning: boolean;
  isImporting: boolean;
  discoveredBackups: DiscoveredBackup[];
  error: string | null;

  // Actions
  scanForBackups: () => Promise<void>;
  importBackup: (backupPath: string) => Promise<SyncJob | null>;
  clearResults: () => void;
}

export function useImportBackup(knownJobIds: string[]): UseImportBackupReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [discoveredBackups, setDiscoveredBackups] = useState<DiscoveredBackup[]>([]);
  const [error, setError] = useState<string | null>(null);

  const scanForBackups = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    setDiscoveredBackups([]);

    try {
      // Find orphan backups on all mounted volumes
      const backups = await api.findOrphanBackups(knownJobIds);
      setDiscoveredBackups(backups);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsScanning(false);
    }
  }, [knownJobIds]);

  const importBackup = useCallback(async (backupPath: string): Promise<SyncJob | null> => {
    setIsImporting(true);
    setError(null);

    try {
      const job = await api.importBackupAsJob(backupPath);
      // Remove from discovered list
      setDiscoveredBackups(prev => prev.filter(b => b.backupPath !== backupPath));
      return job;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setIsImporting(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setDiscoveredBackups([]);
    setError(null);
  }, []);

  return {
    isScanning,
    isImporting,
    discoveredBackups,
    error,
    scanForBackups,
    importBackup,
    clearResults,
  };
}
