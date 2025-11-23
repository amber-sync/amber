import React from 'react';
import * as Icons from 'lucide-react';
import { HardLinkVisualizer } from './HardLinkVisualizer';
import { StorageTimeline } from './StorageTimeline';
import { ComparisonSlider } from './ComparisonSlider';
import { SyncModesComparison } from './SyncModesComparison';
import { CodeBlock } from './CodeBlock';

export const HelpSection: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto px-8 pb-12">
      {/* Hero Header */}
      <div className="mt-2 mb-8 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-teal-500/30">
            <Icons.FolderClock size={32} className="text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-3">
          Welcome to Amber
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          Professional Time Machine backups for macOS. Powered by rsync, designed for humans.
        </p>
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-pink-900/20 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl p-8 mb-12 shadow-lg">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Icons.Rocket size={24} className="text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Quick Start Guide</h2>
            <p className="text-gray-700 dark:text-gray-300">Get your first backup running in 3 easy steps</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center mb-4">
              <span className="text-white font-bold text-lg">1</span>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Create a Job</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Click the <Icons.Plus className="inline" size={14} /> button to create a new backup job. Select your source
              (local or SSH) and destination paths.
            </p>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-purple-200 dark:border-purple-800 rounded-xl p-6">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mb-4">
              <span className="text-white font-bold text-lg">2</span>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Choose Time Machine</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Select <strong>Time Machine</strong> mode for versioned snapshots with incredible storage efficiency.
              Set a schedule or run manually.
            </p>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-pink-200 dark:border-pink-800 rounded-xl p-6">
            <div className="w-10 h-10 bg-pink-500 rounded-lg flex items-center justify-center mb-4">
              <span className="text-white font-bold text-lg">3</span>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Run & Monitor</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Click <strong>Sync Now</strong> and watch the live terminal output. Your first snapshot will
              be ready in minutes!
            </p>
          </div>
        </div>
      </div>

      {/* Section Divider */}
      <div className="flex items-center gap-4 my-12">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-indigo-600 rounded-full shadow-lg">
          <Icons.Sparkles size={16} className="text-white" />
          <span className="text-sm font-bold text-white">Understanding Time Machine</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
      </div>

      {/* Time Machine Section - Most Important */}
      <div className="space-y-12 mb-16">
        {/* Intro */}
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">
            The Magic of Time Machine Mode
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            Time Machine is Amber's flagship feature. It creates <strong>complete, browsable snapshots</strong> of
            your data at different points in time, but through the clever use of <strong>hard links</strong>,
            you only store what actually changed. It's like having dozens of full backups while using the disk
            space of just one.
          </p>
        </div>

        {/* Hard Link Visualizer */}
        <HardLinkVisualizer />

        {/* Comparison Slider */}
        <ComparisonSlider />

        {/* Storage Timeline */}
        <StorageTimeline />

        {/* Technical Deep Dive */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Icons.BookOpen size={24} className="text-indigo-600 dark:text-indigo-400" />
            Technical Deep Dive
          </h3>

          <div className="space-y-6">
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-3">How Snapshots Are Created</h4>
              <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                When you run a Time Machine backup, Amber creates a new timestamped folder in your destination.
                The naming format is <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm">YYYY-MM-DD-HHMMSS</code>.
                A symlink called <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm">latest</code> always
                points to the most recent snapshot.
              </p>
              <CodeBlock
                code="backup-drive/
├── 2025-01-15-143000/    # First full backup
├── 2025-01-16-143000/    # Second snapshot (mostly links)
├── 2025-01-17-143000/    # Third snapshot (mostly links)
└── latest -> 2025-01-17-143000/"
                title="Snapshot Directory Structure"
                explanation="Each dated folder appears as a complete backup when you browse it, but hard links save space."
              />
            </div>

            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-3">What Are Hard Links?</h4>
              <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
                A <strong>hard link</strong> is like having two filenames that point to the same data on disk. When rsync
                detects that a file hasn't changed, instead of copying it again, it creates a hard link to the existing file.
                Both filenames exist, both are "real" (not shortcuts), but they share the same bytes on disk.
              </p>
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Icons.Info size={18} className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <p className="font-semibold mb-1">Key Insight:</p>
                    <p>
                      If you have a 100 MB file that doesn't change across 10 backups, you see it in 10 different snapshot
                      folders, but it only consumes 100 MB on disk (not 1 GB). Delete 9 of those snapshots? The file
                      still exists in the remaining one.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-3">Automatic Snapshot Pruning</h4>
              <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
                Amber automatically removes old snapshots using a smart retention strategy:
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icons.Calendar size={16} className="text-green-600 dark:text-green-400" />
                    <span className="font-bold text-gray-900 dark:text-white text-sm">Days 1-30</span>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    Keep <strong>every snapshot</strong> (daily granularity)
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icons.CalendarRange size={16} className="text-blue-600 dark:text-blue-400" />
                    <span className="font-bold text-gray-900 dark:text-white text-sm">Days 31-365</span>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    Keep <strong>one per week</strong> (weekly granularity)
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icons.CalendarDays size={16} className="text-purple-600 dark:text-purple-400" />
                    <span className="font-bold text-gray-900 dark:text-white text-sm">365+ Days</span>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    Keep <strong>one per month</strong> (monthly granularity)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section Divider */}
      <div className="flex items-center gap-4 my-12">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full shadow-lg">
          <Icons.Settings size={16} className="text-white" />
          <span className="text-sm font-bold text-white">Sync Modes</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
      </div>

      {/* Sync Modes */}
      <div className="mb-16">
        <SyncModesComparison />
      </div>

      {/* Section Divider */}
      <div className="flex items-center gap-4 my-12">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full shadow-lg">
          <Icons.Shield size={16} className="text-white" />
          <span className="text-sm font-bold text-white">Safety & Best Practices</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
      </div>

      {/* Safety Features */}
      <div className="grid md:grid-cols-2 gap-6 mb-16">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
              <Icons.ShieldAlert size={20} className="text-white" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">Safety Features</h3>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Icons.Check size={16} className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900 dark:text-white">Backup Marker:</strong>
                <p className="text-gray-700 dark:text-gray-300">
                  Destination must contain a marker file to prevent accidental overwrites of non-backup drives.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Icons.Check size={16} className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900 dark:text-white">One Filesystem:</strong>
                <p className="text-gray-700 dark:text-gray-300">
                  <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs">--one-file-system</code> prevents
                  runaway backups across mount points.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Icons.Check size={16} className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900 dark:text-white">FAT Detection:</strong>
                <p className="text-gray-700 dark:text-gray-300">
                  Automatically adds <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs">--modify-window=2</code> for
                  USB drives with coarse timestamps.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Icons.Check size={16} className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900 dark:text-white">SSH Host Keys:</strong>
                <p className="text-gray-700 dark:text-gray-300">
                  Host key checking enabled by default; disable only on trusted networks.
                </p>
              </div>
            </li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
              <Icons.Lightbulb size={20} className="text-white" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">Best Practices</h3>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Icons.Star size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900 dark:text-white">Test First:</strong>
                <p className="text-gray-700 dark:text-gray-300">
                  Run a manual sync before scheduling automatic backups to ensure everything works.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Icons.Star size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900 dark:text-white">Use Excludes:</strong>
                <p className="text-gray-700 dark:text-gray-300">
                  Exclude <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs">node_modules</code>,
                  <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs">.git</code>, and temp files
                  to save time and space.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Icons.Star size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900 dark:text-white">Monitor Disk Space:</strong>
                <p className="text-gray-700 dark:text-gray-300">
                  Check the Analytics view to see storage trends and ensure you're not filling up.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Icons.Star size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900 dark:text-white">Browse Snapshots:</strong>
                <p className="text-gray-700 dark:text-gray-300">
                  Use the Snapshot Browser to verify your backups and restore old file versions.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Icons.Heart size={20} className="text-red-500" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Built with Precision</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Amber combines the power of rsync with a beautiful, intuitive interface.
          Your data deserves enterprise-grade protection with consumer-grade simplicity.
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Icons.Terminal size={14} />
            <span>Powered by rsync</span>
          </div>
          <div className="w-1 h-1 bg-gray-400 rounded-full" />
          <div className="flex items-center gap-1">
            <Icons.Zap size={14} />
            <span>Fast & Efficient</span>
          </div>
          <div className="w-1 h-1 bg-gray-400 rounded-full" />
          <div className="flex items-center gap-1">
            <Icons.Lock size={14} />
            <span>Secure by Default</span>
          </div>
        </div>
      </div>
    </div>
  );
};
