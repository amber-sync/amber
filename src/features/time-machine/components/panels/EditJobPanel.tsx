import { useState, useEffect } from 'react';
import { SyncJob, SyncMode, RsyncConfig } from '../../../../types';
import { api } from '../../../../api';
import { MODE_PRESETS } from '../../../../config';
import { Icons } from '../../../../components/IconComponents';
import {
  TextInput,
  PathInput,
  Select,
  FormField,
  Button,
  IconButton,
  StatusMessage,
} from '../../../../components/ui';

interface EditJobPanelProps {
  job: SyncJob;
  onSave: (job: SyncJob) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * EditJobPanel - Slide-out panel for editing job settings (TIM-135)
 *
 * Provides a simplified form for editing the most common job settings.
 */
export function EditJobPanel({ job, onSave, onDelete, onClose }: EditJobPanelProps) {
  // Form state
  const [name, setName] = useState(job.name);
  const [sourcePath, setSourcePath] = useState(job.sourcePath);
  const [destPath, setDestPath] = useState(job.destPath);
  const [mode, setMode] = useState(job.mode);
  const [scheduleInterval, setScheduleInterval] = useState<number | null>(job.scheduleInterval);
  const [excludePatterns, setExcludePatterns] = useState<string[]>(job.config.excludePatterns);
  const [tempPattern, setTempPattern] = useState('');

  // Advanced section toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Reset form when job changes
  useEffect(() => {
    setName(job.name);
    setSourcePath(job.sourcePath);
    setDestPath(job.destPath);
    setMode(job.mode);
    setScheduleInterval(job.scheduleInterval);
    setExcludePatterns(job.config.excludePatterns);
    setTempPattern('');
    setConfirmDelete(false);
  }, [job]);

  const handleSelectDirectory = async (target: 'source' | 'dest') => {
    const path = await api.selectDirectory();
    if (path) {
      if (target === 'source') setSourcePath(path);
      else setDestPath(path);
    }
  };

  const handleAddPattern = () => {
    const trimmed = tempPattern.trim();
    if (trimmed && !excludePatterns.includes(trimmed)) {
      setExcludePatterns([...excludePatterns, trimmed]);
      setTempPattern('');
    }
  };

  const handleRemovePattern = (pattern: string) => {
    setExcludePatterns(excludePatterns.filter(p => p !== pattern));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: RsyncConfig = {
        ...MODE_PRESETS[mode],
        excludePatterns,
        customFlags: job.config.customFlags || '',
        customCommand: job.config.customCommand,
      };

      const updatedJob: SyncJob = {
        ...job,
        name,
        sourcePath,
        destPath,
        mode,
        scheduleInterval,
        config,
      };

      onSave(updatedJob);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete();
      onClose();
    } else {
      setConfirmDelete(true);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Form content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Job Name */}
        <FormField label="Job Name" className="mb-4">
          <TextInput
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Backup Job"
          />
        </FormField>

        {/* Source Path */}
        <FormField label="Source Path" className="mb-4">
          <PathInput
            value={sourcePath}
            onChange={setSourcePath}
            onBrowse={() => handleSelectDirectory('source')}
            placeholder="/Users/you/Documents"
          />
        </FormField>

        {/* Destination Path */}
        <FormField label="Destination Path" className="mb-4">
          <PathInput
            value={destPath}
            onChange={setDestPath}
            onBrowse={() => handleSelectDirectory('dest')}
            placeholder="/Volumes/Backup"
          />
        </FormField>

        {/* Sync Mode */}
        <FormField label="Backup Mode" className="mb-4">
          <Select
            value={mode}
            onChange={e => setMode(e.target.value as SyncMode)}
            options={[
              { value: SyncMode.TIME_MACHINE, label: 'Time Machine (incremental with hard links)' },
              { value: SyncMode.MIRROR, label: 'Mirror (exact copy with deletions)' },
              { value: SyncMode.ARCHIVE, label: 'Archive (copy only, no deletions)' },
            ]}
          />
        </FormField>

        {/* Schedule */}
        <FormField label="Schedule" className="mb-4">
          <Select
            value={scheduleInterval?.toString() ?? ''}
            onChange={e => setScheduleInterval(e.target.value ? Number(e.target.value) : null)}
            options={[
              { value: '', label: 'Manual only' },
              { value: '60', label: 'Every hour' },
              { value: '240', label: 'Every 4 hours' },
              { value: '1440', label: 'Daily' },
              { value: '10080', label: 'Weekly' },
            ]}
          />
        </FormField>

        {/* Advanced Section */}
        <div className="border-t border-border-base pt-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <span>Advanced Settings</span>
            <Icons.ChevronDown
              className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            />
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              {/* Exclude Patterns */}
              <FormField label="Exclude Patterns">
                <div className="flex gap-2">
                  <TextInput
                    value={tempPattern}
                    onChange={e => setTempPattern(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPattern()}
                    placeholder=".DS_Store, node_modules/"
                    className="flex-1"
                  />
                  <IconButton
                    variant="secondary"
                    size="md"
                    onClick={handleAddPattern}
                    label="Add pattern"
                  >
                    <Icons.Plus className="h-4 w-4" />
                  </IconButton>
                </div>
                {excludePatterns.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {excludePatterns.map(pattern => (
                      <span
                        key={pattern}
                        className="inline-flex items-center gap-1 rounded-full bg-layer-3 px-2 py-1 text-xs"
                      >
                        {pattern}
                        <button
                          onClick={() => handleRemovePattern(pattern)}
                          className="text-text-tertiary hover:text-text-secondary"
                        >
                          <Icons.X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </FormField>
            </div>
          )}
        </div>
      </div>

      {/* Footer with actions */}
      <div className="border-t border-border-base p-4">
        <div className="flex items-center justify-between">
          <Button variant={confirmDelete ? 'danger' : 'ghost'} size="md" onClick={handleDelete}>
            {confirmDelete ? 'Confirm Delete' : 'Delete Job'}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={saving || !name.trim() || !sourcePath.trim() || !destPath.trim()}
              loading={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
        {confirmDelete && (
          <StatusMessage variant="error" size="sm" className="mt-2">
            Click "Confirm Delete" again to permanently delete this job.
          </StatusMessage>
        )}
      </div>
    </div>
  );
}

export default EditJobPanel;
