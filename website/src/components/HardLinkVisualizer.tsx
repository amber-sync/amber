"use client";

import React, { useState, useEffect } from 'react';
import { Play, Link as LinkIcon, Loader2, FolderClock, FileText, HardDrive, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileNode {
  name: string;
  size: number;
  changed: boolean;
  id: string;
}

const DEMO_FILES: FileNode[] = [
  { name: 'config.json', size: 2.4, changed: false, id: 'config' },
  { name: 'data.db', size: 150.5, changed: true, id: 'data' },
  { name: 'index.html', size: 8.2, changed: false, id: 'index' },
  { name: 'app.js', size: 45.3, changed: true, id: 'app' },
  { name: 'styles.css', size: 12.7, changed: false, id: 'styles' },
];

export const HardLinkVisualizer: React.FC = () => {
  const [activeSnapshot, setActiveSnapshot] = useState<number>(0);
  const [showLinks, setShowLinks] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'scanning' | 'linking' | 'complete'>('idle');

  useEffect(() => {
    if (animationPhase === 'idle') return;

    const timers: NodeJS.Timeout[] = [];

    if (animationPhase === 'scanning') {
      timers.push(setTimeout(() => setAnimationPhase('linking'), 1500));
    } else if (animationPhase === 'linking') {
      setShowLinks(true);
      timers.push(setTimeout(() => setAnimationPhase('complete'), 1500));
    } else if (animationPhase === 'complete') {
      timers.push(setTimeout(() => setAnimationPhase('idle'), 3000));
    }

    return () => timers.forEach(clearTimeout);
  }, [animationPhase]);

  const startAnimation = () => {
    setShowLinks(false);
    setAnimationPhase('scanning');
    setActiveSnapshot(1); // Focus on the second snapshot for the demo
  };

  const snapshots = [
    { label: 'Backup #1', date: '2025-01-15 14:30', folder: '2025-01-15-143000' },
    { label: 'Backup #2', date: '2025-01-16 14:30', folder: '2025-01-16-143000' },
    { label: 'Backup #3', date: '2025-01-17 14:30', folder: '2025-01-17-143000' },
  ];

  return (
    <div className="space-y-8 my-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
        <div>
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Lightbulb className="text-amber-500" size={24} />
            Interactive Visualizer
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
            See how Amber uses hard links to save space. Click "Animate" to watch the process.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={startAnimation}
            disabled={animationPhase !== 'idle'}
            className="px-5 py-2.5 bg-foreground text-background hover:opacity-90 disabled:opacity-50 rounded-lg font-medium transition-all flex items-center gap-2"
          >
            {animationPhase === 'idle' ? <Play size={16} /> : <Loader2 size={16} className="animate-spin" />}
            {animationPhase === 'idle' ? 'Animate Process' : 'Running...'}
          </button>
          <button
            onClick={() => setShowLinks(!showLinks)}
            className="px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 rounded-lg font-medium transition-all flex items-center gap-2"
          >
            <LinkIcon size={16} />
            {showLinks ? 'Hide Links' : 'Show Links'}
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <AnimatePresence>
        {animationPhase !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex items-center gap-3 text-blue-700 dark:text-blue-300">
              <Loader2 size={20} className="animate-spin" />
              <span className="font-medium">
                {animationPhase === 'scanning' && 'Scanning files and comparing with previous backup...'}
                {animationPhase === 'linking' && 'Creating hard links for unchanged files...'}
                {animationPhase === 'complete' && 'Backup complete! Only modified files took up space.'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Tree */}
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 relative overflow-hidden shadow-sm">
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="relative grid md:grid-cols-3 gap-8">
          {snapshots.map((snapshot, snapshotIdx) => {
            const isFirst = snapshotIdx === 0;

            return (
              <div key={snapshotIdx} className="space-y-4">
                {/* Snapshot Header */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className={`bg-gray-50 dark:bg-gray-900 border-2 ${
                    activeSnapshot === snapshotIdx
                      ? 'border-blue-500 shadow-lg shadow-blue-500/10'
                      : 'border-transparent'
                  } rounded-xl p-4 cursor-pointer transition-all`}
                  onClick={() => setActiveSnapshot(snapshotIdx)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FolderClock size={18} className="text-blue-500" />
                    <p className="font-bold">{snapshot.label}</p>
                  </div>
                  <p className="text-xs text-gray-500 font-mono">{snapshot.folder}</p>
                </motion.div>

                {/* Files */}
                <div className="space-y-2">
                  {DEMO_FILES.map((file, fileIdx) => {
                    const changedInThisBackup = !isFirst && file.changed;
                    const isScanning = animationPhase === 'scanning' && snapshotIdx === 1;
                    const isLinked = !isFirst && !changedInThisBackup;

                    return (
                      <div key={fileIdx} className="relative group">
                        <div
                          className={`bg-white dark:bg-gray-900 border rounded-lg p-3 transition-all ${
                            changedInThisBackup
                              ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10'
                              : 'border-gray-100 dark:border-gray-800'
                          } ${
                            isScanning ? 'animate-pulse ring-2 ring-blue-500/20' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FileText
                              size={14}
                              className={changedInThisBackup ? 'text-orange-500' : 'text-gray-400'}
                            />
                            <p className="text-xs font-mono flex-1 truncate">
                              {file.name}
                            </p>
                            {changedInThisBackup && (
                              <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded font-bold">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center mt-1">
                             <p className="text-[10px] text-gray-400">
                              {file.size} KB
                            </p>
                            {isLinked && (
                               <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                 <LinkIcon size={10} /> Linked
                               </span>
                            )}
                          </div>
                        </div>

                        {/* Hard Link Connection Line */}
                        {showLinks && isLinked && snapshotIdx > 0 && (
                          <motion.div
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: '2rem' }}
                            className="absolute top-1/2 -left-8 h-[2px] bg-blue-400/30 dark:bg-blue-500/30 pointer-events-none"
                            style={{ transform: 'translateY(-50%)' }}
                          >
                             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Storage Stats */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-1">
                    <HardDrive size={12} /> Disk Usage
                  </div>
                  <p className="font-bold text-lg">
                    {isFirst
                      ? '219.1 KB'
                      : snapshotIdx === 1
                        ? '57.5 KB'
                        : '65.8 KB'
                    }
                  </p>
                  {!isFirst && (
                    <p className="text-[10px] text-green-600 font-bold">
                      {snapshotIdx === 1 ? '74% Saved' : '70% Saved'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
