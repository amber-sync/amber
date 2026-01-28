/**
 * TIM-220: Modal for discovering and importing orphan backups
 * Allows browsing any folder (local or mounted drive) to find Amber backups
 */

import React, { useState } from 'react';
import { Card, Button, Title, Body, Caption, Code } from '@/components/ui';
import { Icons } from '@/components/IconComponents';
import { useImportBackup } from '../hooks/useImportBackup';
import type { DiscoveredBackup, SyncJob } from '@/types';
import { open } from '@tauri-apps/plugin-dialog';

interface ImportBackupModalProps {
  knownJobIds: string[];
  onImport: (job: SyncJob) => void;
  onClose: () => void;
}

export function ImportBackupModal({ knownJobIds, onImport, onClose }: ImportBackupModalProps) {
  const {
    isScanning,
    isImporting,
    discoveredBackups,
    error,
    scanFolder,
    importBackup,
    clearResults,
  } = useImportBackup(knownJobIds);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const handleImport = async (backup: DiscoveredBackup) => {
    const job = await importBackup(backup.backupPath);
    if (job) {
      onImport(job);
    }
  };

  const handleBrowse = async () => {
    const path = await open({
      directory: true,
      multiple: false,
      title: 'Select folder containing Amber backup',
    });
    if (path && typeof path === 'string') {
      setSelectedPath(path);
      clearResults();
      scanFolder(path);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <Card
        variant="modal"
        className="w-full max-w-2xl max-h-[80vh] overflow-hidden animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-base">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-secondary flex items-center justify-center">
              <Icons.HardDrive size={20} className="text-accent-primary" />
            </div>
            <div>
              <Title level={4}>Import Backup</Title>
              <Caption color="tertiary">Import from any folder or drive</Caption>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-layer-3 rounded-lg text-text-tertiary transition-colors"
          >
            <Icons.X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {/* Initial State - Dropzone style browse */}
          {!isScanning && !selectedPath && discoveredBackups.length === 0 && (
            <button
              onClick={handleBrowse}
              className="w-full py-12 px-8 border-2 border-dashed border-border-base rounded-2xl hover:border-accent-primary hover:bg-accent-primary/5 transition-all duration-200 cursor-pointer group"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-layer-2 group-hover:bg-accent-primary/10 flex items-center justify-center transition-colors">
                  <Icons.FolderOpen
                    size={28}
                    className="text-text-tertiary group-hover:text-accent-primary transition-colors"
                  />
                </div>
                <div className="text-center">
                  <Title
                    level={4}
                    color="secondary"
                    className="group-hover:text-text-primary transition-colors"
                  >
                    Click to browse for backup folder
                  </Title>
                  <Body size="sm" color="tertiary" className="mt-1">
                    Select any folder on your Mac or external drive
                  </Body>
                </div>
              </div>
            </button>
          )}

          {/* Scanning State */}
          {isScanning && (
            <div className="flex flex-col items-center justify-center py-16 gap-6">
              <div className="w-12 h-12 border-3 border-accent-primary border-t-transparent rounded-full animate-spin" />
              <div className="space-y-2 text-center">
                <Body color="secondary">Scanning folder for backups...</Body>
                {selectedPath && (
                  <Code size="sm" className="max-w-md truncate block">
                    {selectedPath}
                  </Code>
                )}
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isScanning && (
            <div className="p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-xl mb-4">
              <div className="flex items-center gap-2">
                <Icons.AlertCircle size={18} className="text-[var(--color-error)]" />
                <Body size="sm" className="text-[var(--color-error)]">
                  {error}
                </Body>
              </div>
            </div>
          )}

          {/* No Results after scanning */}
          {!isScanning && selectedPath && discoveredBackups.length === 0 && !error && (
            <div className="space-y-4">
              <div className="p-4 bg-layer-2 rounded-xl text-center">
                <div className="flex items-center justify-center gap-2 text-text-tertiary">
                  <Icons.Search size={16} />
                  <Body size="sm" color="tertiary">
                    No Amber backups found in:
                  </Body>
                </div>
                <Code size="sm" className="mt-1 block truncate">
                  {selectedPath}
                </Code>
              </div>
              <button
                onClick={handleBrowse}
                className="w-full py-8 px-8 border-2 border-dashed border-border-base rounded-2xl hover:border-accent-primary hover:bg-accent-primary/5 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex flex-col items-center gap-3">
                  <Icons.FolderOpen
                    size={24}
                    className="text-text-tertiary group-hover:text-accent-primary transition-colors"
                  />
                  <Body
                    size="sm"
                    color="secondary"
                    className="group-hover:text-text-primary transition-colors"
                  >
                    Try a different folder
                  </Body>
                </div>
              </button>
            </div>
          )}

          {/* Results List */}
          {!isScanning && discoveredBackups.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <Body size="sm" color="secondary">
                  Found {discoveredBackups.length} backup{discoveredBackups.length !== 1 ? 's' : ''}
                </Body>
                <Button variant="ghost" size="sm" onClick={handleBrowse}>
                  <Icons.Folder size={14} />
                  Browse Different
                </Button>
              </div>

              {discoveredBackups.map(backup => (
                <BackupCard
                  key={backup.backupPath}
                  backup={backup}
                  onImport={() => handleImport(backup)}
                  isImporting={isImporting}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-base bg-layer-2/50">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}

function BackupCard({
  backup,
  onImport,
  isImporting,
}: {
  backup: DiscoveredBackup;
  onImport: () => void;
  isImporting: boolean;
}) {
  return (
    <div className="p-4 bg-layer-2 rounded-xl border border-border-base">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icons.FolderSync size={18} className="text-accent-primary flex-shrink-0" />
            <Title level={4} truncate>
              {backup.jobName}
            </Title>
          </div>

          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <Caption color="tertiary">Source:</Caption>
              <Code size="sm" truncate>
                {backup.sourcePath}
              </Code>
            </div>
            <div className="flex items-center gap-2">
              <Caption color="tertiary">Location:</Caption>
              <Code size="sm" truncate>
                {backup.backupPath}
              </Code>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3">
            <Caption color="tertiary">
              <Icons.Clock size={12} className="inline mr-1" />
              {backup.snapshotCount} snapshot{backup.snapshotCount !== 1 ? 's' : ''}
            </Caption>
            <Caption color="quaternary">Machine: {backup.machineId.split('-')[0]}</Caption>
          </div>
        </div>

        <Button onClick={onImport} disabled={isImporting} size="sm">
          {isImporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Icons.DownloadCloud size={16} />
              Import
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
