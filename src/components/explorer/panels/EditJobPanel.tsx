import { useState, useEffect } from 'react';
import { SyncJob, SyncMode, RsyncConfig } from '../../../types';
import { api } from '../../../api';
import { MODE_PRESETS } from '../../../config';
import { Icons } from '../../IconComponents';

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
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Job Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-800"
            placeholder="My Backup Job"
          />
        </div>

        {/* Source Path */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Source Path
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={sourcePath}
              onChange={e => setSourcePath(e.target.value)}
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-800"
              placeholder="/Users/you/Documents"
            />
            <button
              onClick={() => handleSelectDirectory('source')}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-700"
            >
              <Icons.FolderOpen className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Destination Path */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Destination Path
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={destPath}
              onChange={e => setDestPath(e.target.value)}
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-800"
              placeholder="/Volumes/Backup"
            />
            <button
              onClick={() => handleSelectDirectory('dest')}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-700"
            >
              <Icons.FolderOpen className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sync Mode */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Backup Mode
          </label>
          <select
            value={mode}
            onChange={e => setMode(e.target.value as SyncMode)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-800"
          >
            <option value={SyncMode.TIME_MACHINE}>
              Time Machine (incremental with hard links)
            </option>
            <option value={SyncMode.MIRROR}>Mirror (exact copy with deletions)</option>
            <option value={SyncMode.ARCHIVE}>Archive (copy only, no deletions)</option>
          </select>
        </div>

        {/* Schedule */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Schedule
          </label>
          <select
            value={scheduleInterval ?? ''}
            onChange={e => setScheduleInterval(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-800"
          >
            <option value="">Manual only</option>
            <option value="60">Every hour</option>
            <option value="240">Every 4 hours</option>
            <option value="1440">Daily</option>
            <option value="10080">Weekly</option>
          </select>
        </div>

        {/* Advanced Section */}
        <div className="border-t border-stone-200 pt-4 dark:border-stone-700">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between text-sm font-medium text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
          >
            <span>Advanced Settings</span>
            <Icons.ChevronDown
              className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            />
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              {/* Exclude Patterns */}
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                  Exclude Patterns
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempPattern}
                    onChange={e => setTempPattern(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPattern()}
                    className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-800"
                    placeholder=".DS_Store, node_modules/"
                  />
                  <button
                    onClick={handleAddPattern}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-700"
                  >
                    <Icons.Plus className="h-4 w-4" />
                  </button>
                </div>
                {excludePatterns.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {excludePatterns.map(pattern => (
                      <span
                        key={pattern}
                        className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-1 text-xs dark:bg-stone-700"
                      >
                        {pattern}
                        <button
                          onClick={() => handleRemovePattern(pattern)}
                          className="text-stone-500 hover:text-stone-700"
                        >
                          <Icons.X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer with actions */}
      <div className="border-t border-stone-200 p-4 dark:border-stone-700">
        <div className="flex items-center justify-between">
          <button
            onClick={handleDelete}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              confirmDelete
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
            }`}
          >
            {confirmDelete ? 'Confirm Delete' : 'Delete Job'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || !sourcePath.trim() || !destPath.trim()}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
        {confirmDelete && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            Click &quot;Confirm Delete&quot; again to permanently delete this job.
          </p>
        )}
      </div>
    </div>
  );
}

export default EditJobPanel;
