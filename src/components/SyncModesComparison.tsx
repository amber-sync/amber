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
    color: 'text-accent-primary',
    bgGradient: 'bg-accent-secondary',
    borderColor: 'border-accent-primary',
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
    color: 'text-[var(--color-success)]',
    bgGradient: 'bg-[var(--color-success-subtle)]',
    borderColor: 'border-[var(--color-success)]',
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
    color: 'text-accent-primary',
    bgGradient: 'bg-accent-secondary',
    borderColor: 'border-accent-primary',
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
    color: 'text-[var(--color-info)]',
    bgGradient: 'bg-[var(--color-info-subtle)]',
    borderColor: 'border-[var(--color-info)]',
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
        <h3 className="text-2xl font-bold text-text-primary mb-2">Sync Modes Explained</h3>
        <p className="text-text-secondary max-w-3xl mx-auto">
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
                  : 'border-border-base hover:shadow-lg hover:scale-102'
              } bg-layer-1`}
            >
              <div
                className={`w-12 h-12 rounded-lg ${mode.bgGradient} flex items-center justify-center mb-3`}
              >
                <Icon size={24} className={mode.color} />
              </div>
              <h4 className="font-bold text-text-primary mb-1">{mode.name}</h4>
              <p className="text-xs text-text-secondary">{mode.tagline}</p>
              {isSelected && (
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-accent-primary">
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
        className={`${selected.bgGradient} border-2 ${selected.borderColor} rounded-2xl p-8 animate-fade-in`}
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0">
            <div
              className={`w-16 h-16 rounded-xl bg-layer-1 shadow-lg flex items-center justify-center border-2 ${selected.borderColor}`}
            >
              {React.createElement(selected.icon, { size: 32, className: selected.color })}
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-2xl font-bold text-text-primary mb-1">{selected.name}</h4>
            <p className={`text-sm font-semibold ${selected.color} mb-3`}>{selected.tagline}</p>
            <p className="text-text-secondary leading-relaxed">{selected.description}</p>
          </div>
        </div>

        {/* Use Case */}
        <div className="bg-layer-1/50 backdrop-blur-sm border border-border-base rounded-xl p-4 mb-6">
          <div className="flex items-start gap-2">
            <Icons.Target size={18} className={`${selected.color} flex-shrink-0 mt-0.5`} />
            <div>
              <p className="font-semibold text-text-primary mb-1">Use Case</p>
              <p className="text-sm text-text-secondary">{selected.useCase}</p>
            </div>
          </div>
        </div>

        {/* Pros and Cons */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-layer-1/50 backdrop-blur-sm border border-border-base rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-[var(--color-success)] rounded-full flex items-center justify-center">
                <Icons.Check size={14} className="text-white" />
              </div>
              <p className="font-semibold text-text-primary">Advantages</p>
            </div>
            <ul className="space-y-2">
              {selected.pros.map((pro, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Icons.Plus
                    size={14}
                    className="text-[var(--color-success)] flex-shrink-0 mt-0.5"
                  />
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-layer-1/50 backdrop-blur-sm border border-border-base rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-accent-primary rounded-full flex items-center justify-center">
                <Icons.AlertCircle size={14} className="text-white" />
              </div>
              <p className="font-semibold text-text-primary">Considerations</p>
            </div>
            <ul className="space-y-2">
              {selected.cons.map((con, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Icons.Minus size={14} className="text-accent-primary flex-shrink-0 mt-0.5" />
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Command */}
        <div>
          <p className="font-semibold text-text-primary mb-3 flex items-center gap-2">
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
      <div className="bg-layer-1 border border-border-base rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-layer-2 border-b border-border-base">
                <th className="px-6 py-4 text-left font-semibold text-text-primary">Mode</th>
                <th className="px-6 py-4 text-left font-semibold text-text-primary">Versions</th>
                <th className="px-6 py-4 text-left font-semibold text-text-primary">Deletes</th>
                <th className="px-6 py-4 text-left font-semibold text-text-primary">Storage</th>
                <th className="px-6 py-4 text-left font-semibold text-text-primary">Best For</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border-subtle hover:bg-layer-2">
                <td className="px-6 py-4 font-semibold text-accent-primary">Time Machine</td>
                <td className="px-6 py-4 text-text-secondary">Multiple dated snapshots</td>
                <td className="px-6 py-4 text-text-secondary">Kept in old snapshots</td>
                <td className="px-6 py-4 text-[var(--color-success)] font-semibold">
                  Minimal (hard links)
                </td>
                <td className="px-6 py-4 text-text-secondary">Version control</td>
              </tr>
              <tr className="border-b border-border-subtle hover:bg-layer-2">
                <td className="px-6 py-4 font-semibold text-[var(--color-success)]">Mirror</td>
                <td className="px-6 py-4 text-text-secondary">Single current state</td>
                <td className="px-6 py-4 text-accent-primary">Deleted from backup</td>
                <td className="px-6 py-4 text-text-secondary">One full copy</td>
                <td className="px-6 py-4 text-text-secondary">Exact clones</td>
              </tr>
              <tr className="border-b border-border-subtle hover:bg-layer-2">
                <td className="px-6 py-4 font-semibold text-accent-primary">Archive</td>
                <td className="px-6 py-4 text-text-secondary">All files ever added</td>
                <td className="px-6 py-4 text-[var(--color-success)]">Never deleted</td>
                <td className="px-6 py-4 text-accent-primary">Grows indefinitely</td>
                <td className="px-6 py-4 text-text-secondary">Long-term archives</td>
              </tr>
              <tr className="hover:bg-layer-2">
                <td className="px-6 py-4 font-semibold text-[var(--color-info)]">Custom</td>
                <td className="px-6 py-4 text-text-secondary">Depends on command</td>
                <td className="px-6 py-4 text-text-secondary">Depends on command</td>
                <td className="px-6 py-4 text-text-secondary">Depends on command</td>
                <td className="px-6 py-4 text-text-secondary">Advanced users</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
