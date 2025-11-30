import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { CodeBlock } from './CodeBlock';

interface ModeDetails {
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  bgGradient: string;
  borderColor: string;
  tagline: string;
  description: string;
  useCase: string;
  command: string;
  commandExplanation: string;
  pros: string[];
  cons: string[];
}

const MODES: ModeDetails[] = [
  {
    name: 'Time Machine',
    icon: Icons.FolderClock,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgGradient: 'from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    tagline: 'Versioned snapshots with hard links',
    description:
      'Creates dated snapshot folders (e.g., 2025-01-15-143000) where unchanged files are hard-linked to previous backups. You get complete browsable snapshots while only storing what changed.',
    useCase:
      'Perfect for: Development projects, photo libraries, document archives—anywhere you need version history without massive storage.',
    command:
      'rsync -D --numeric-ids --links --hard-links --one-file-system -a --link-dest={linkDest} {source}/ {dest}',
    commandExplanation:
      'The --link-dest flag points to the previous snapshot, allowing rsync to create hard links for unchanged files.',
    pros: [
      'Massive storage savings (70-90% typical)',
      'Complete version history',
      'Fast browsing of any snapshot',
      'Automatic pruning of old snapshots',
    ],
    cons: [
      'Requires filesystem with hard link support',
      'Cannot use on FAT/exFAT (though Amber detects this)',
    ],
  },
  {
    name: 'Mirror',
    icon: Icons.RefreshCw,
    color: 'text-teal-600 dark:text-teal-400',
    bgGradient: 'from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20',
    borderColor: 'border-teal-200 dark:border-teal-800',
    tagline: 'Exact replica of source',
    description:
      'Destination becomes an exact mirror of the source. Files deleted from source are also deleted from destination. One-to-one correspondence.',
    useCase:
      'Perfect for: Deployment mirrors, disaster recovery, creating bootable clones—anywhere you need an exact copy.',
    command:
      'rsync -D --numeric-ids --links --hard-links --one-file-system -a --delete {source}/ {dest}',
    commandExplanation:
      "The --delete flag removes files from destination that don't exist in source, ensuring perfect synchronization.",
    pros: [
      'Destination always matches source',
      'Simple to understand and verify',
      'Minimal storage (just one copy)',
      'Fast incremental updates',
    ],
    cons: [
      'No version history',
      'Deleted files are gone forever',
      'Accidental deletions propagate',
    ],
  },
  {
    name: 'Archive',
    icon: Icons.Archive,
    color: 'text-amber-600 dark:text-amber-400',
    bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    tagline: 'Copy everything, never delete',
    description:
      'Copies all files from source to destination but never removes anything from destination. Deleted files from source remain in the backup.',
    useCase:
      'Perfect for: Long-term archival, compliance requirements, paranoid backups—when you never want to lose data.',
    command: 'rsync -D --numeric-ids --links --hard-links --one-file-system -a {source}/ {dest}',
    commandExplanation:
      'No --delete flag means files are only added or updated, never removed from the destination.',
    pros: [
      'Never loses data',
      'Simple accumulation model',
      'Deleted files preserved',
      'Good for compliance',
    ],
    cons: [
      'Storage grows indefinitely',
      'No snapshot organization',
      "Can't tell when files were deleted",
    ],
  },
  {
    name: 'Custom',
    icon: Icons.Code,
    color: 'text-purple-600 dark:text-purple-400',
    bgGradient: 'from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    tagline: 'Full control over rsync',
    description:
      'Provide your own rsync command with custom flags and options. Amber provides placeholders for source, destination, and linkDest.',
    useCase:
      "Perfect for: Advanced users, special requirements, testing, or learning rsync—when presets don't fit.",
    command: 'rsync [your-flags] {source}/ {dest}',
    commandExplanation:
      'Use placeholders: {source}, {dest}, {linkDest}. Your command runs as-is. Clear to return to presets.',
    pros: [
      'Complete flexibility',
      'Can add custom filters',
      'Educational for rsync',
      'Power user features',
    ],
    cons: ['Requires rsync knowledge', 'Easy to make mistakes', 'No safety guardrails'],
  },
];

export const SyncModesComparison: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<string>('Time Machine');

  const selected = MODES.find(m => m.name === selectedMode) || MODES[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Sync Modes Explained
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          Amber offers four sync strategies, each optimized for different backup needs. Choose the
          mode that matches your workflow.
        </p>
      </div>

      {/* Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {MODES.map(mode => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.name;

          return (
            <button
              key={mode.name}
              onClick={() => setSelectedMode(mode.name)}
              className={`text-left p-5 rounded-xl border-2 transition-all duration-300 ${
                isSelected
                  ? `${mode.borderColor} shadow-xl scale-105`
                  : 'border-gray-200 dark:border-gray-700 hover:shadow-lg hover:scale-102'
              } bg-white dark:bg-gray-800`}
            >
              <div
                className={`w-12 h-12 rounded-lg bg-gradient-to-br ${mode.bgGradient} flex items-center justify-center mb-3`}
              >
                <Icon size={24} className={mode.color} />
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-1">{mode.name}</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">{mode.tagline}</p>
              {isSelected && (
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Icons.ChevronRight size={14} />
                  Selected
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Detailed View */}
      <div
        className={`bg-gradient-to-br ${selected.bgGradient} border-2 ${selected.borderColor} rounded-2xl p-8 animate-fade-in`}
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0">
            <div
              className={`w-16 h-16 rounded-xl bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center border-2 ${selected.borderColor}`}
            >
              {React.createElement(selected.icon, { size: 32, className: selected.color })}
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {selected.name}
            </h4>
            <p className={`text-sm font-semibold ${selected.color} mb-3`}>{selected.tagline}</p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {selected.description}
            </p>
          </div>
        </div>

        {/* Use Case */}
        <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-2">
            <Icons.Target size={18} className={`${selected.color} flex-shrink-0 mt-0.5`} />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-1">Use Case</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{selected.useCase}</p>
            </div>
          </div>
        </div>

        {/* Pros and Cons */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                <Icons.Check size={14} className="text-white" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">Advantages</p>
            </div>
            <ul className="space-y-2">
              {selected.pros.map((pro, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <Icons.Plus
                    size={14}
                    className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5"
                  />
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                <Icons.AlertCircle size={14} className="text-white" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">Considerations</p>
            </div>
            <ul className="space-y-2">
              {selected.cons.map((con, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <Icons.Minus
                    size={14}
                    className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5"
                  />
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Command */}
        <div>
          <p className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Icons.Terminal size={16} />
            rsync Command
          </p>
          <CodeBlock
            code={selected.command}
            language="bash"
            explanation={selected.commandExplanation}
          />
        </div>
      </div>

      {/* Quick Reference Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">
                  Mode
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">
                  Versions
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">
                  Deletes
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">
                  Storage
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">
                  Best For
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-6 py-4 font-semibold text-indigo-600 dark:text-indigo-400">
                  Time Machine
                </td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                  Multiple dated snapshots
                </td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                  Kept in old snapshots
                </td>
                <td className="px-6 py-4 text-teal-600 dark:text-teal-400 font-semibold">
                  Minimal (hard links)
                </td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">Version control</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-6 py-4 font-semibold text-teal-600 dark:text-teal-400">Mirror</td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">Single current state</td>
                <td className="px-6 py-4 text-orange-600 dark:text-orange-400">
                  Deleted from backup
                </td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">One full copy</td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">Exact clones</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-6 py-4 font-semibold text-amber-600 dark:text-amber-400">
                  Archive
                </td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">All files ever added</td>
                <td className="px-6 py-4 text-teal-600 dark:text-teal-400">Never deleted</td>
                <td className="px-6 py-4 text-orange-600 dark:text-orange-400">
                  Grows indefinitely
                </td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">Long-term archives</td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-6 py-4 font-semibold text-purple-600 dark:text-purple-400">
                  Custom
                </td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">Depends on command</td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">Depends on command</td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">Depends on command</td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">Advanced users</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
