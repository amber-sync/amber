import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';

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
  const [animationPhase, setAnimationPhase] = useState<
    'idle' | 'scanning' | 'linking' | 'complete'
  >('idle');

  useEffect(() => {
    if (animationPhase === 'idle') return;

    const timers: NodeJS.Timeout[] = [];

    if (animationPhase === 'scanning') {
      timers.push(setTimeout(() => setAnimationPhase('linking'), 1500));
    } else if (animationPhase === 'linking') {
      setShowLinks(true);
      timers.push(setTimeout(() => setAnimationPhase('complete'), 1500));
    } else if (animationPhase === 'complete') {
      timers.push(setTimeout(() => setAnimationPhase('idle'), 1000));
    }

    return () => timers.forEach(clearTimeout);
  }, [animationPhase]);

  const startAnimation = () => {
    setShowLinks(false);
    setAnimationPhase('scanning');
  };

  const snapshots = [
    { label: 'Backup #1', date: '2025-01-15 14:30', folder: '2025-01-15-143000' },
    { label: 'Backup #2', date: '2025-01-16 14:30', folder: '2025-01-16-143000' },
    { label: 'Backup #3', date: '2025-01-17 14:30', folder: '2025-01-17-143000' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-primary mb-2">How Hard Links Work</h3>
        <p className="text-secondary max-w-3xl mx-auto">
          Each backup appears as a complete copy, but unchanged files share the same disk space
          through hard links. Only modified files consume additional storage.
        </p>
      </div>

      {/* Animation Controls */}
      <div className="flex justify-center gap-4">
        <button
          onClick={startAnimation}
          disabled={animationPhase !== 'idle'}
          className="px-6 py-2.5 bg-accent-primary hover:bg-accent-primary-hover disabled:bg-layer-3 disabled:opacity-50 text-white rounded-lg font-medium shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          <Icons.Play size={16} />
          {animationPhase === 'idle' ? 'Animate Backup Process' : 'Running...'}
        </button>
        <button
          onClick={() => setShowLinks(!showLinks)}
          className="px-6 py-2.5 bg-layer-1 border-2 border-layer-3 hover:border-[var(--color-info)] text-primary rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
        >
          <Icons.Link size={16} />
          {showLinks ? 'Hide Links' : 'Show Links'}
        </button>
      </div>

      {/* Status Indicator */}
      {animationPhase !== 'idle' && (
        <div className="bg-layer-2 border border-layer-3 rounded-xl p-4 flex items-center gap-3">
          <div className="animate-spin">
            <Icons.Loader2 size={20} className="text-[var(--color-info)]" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-primary">
              {animationPhase === 'scanning' &&
                'Scanning files and comparing with previous backup...'}
              {animationPhase === 'linking' && 'Creating hard links for unchanged files...'}
              {animationPhase === 'complete' && 'Backup complete! Storage saved.'}
            </p>
          </div>
        </div>
      )}

      {/* Visual Tree */}
      <div className="bg-layer-1 border border-layer-3 rounded-2xl p-8 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative grid grid-cols-3 gap-8">
          {snapshots.map((snapshot, snapshotIdx) => {
            const isFirst = snapshotIdx === 0;

            return (
              <div key={snapshotIdx} className="space-y-4">
                {/* Snapshot Header */}
                <div
                  className={`bg-layer-2 border-2 ${
                    activeSnapshot === snapshotIdx
                      ? 'border-[var(--color-info)] shadow-lg'
                      : 'border-layer-3'
                  } rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-md`}
                  onClick={() => setActiveSnapshot(snapshotIdx)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icons.FolderClock size={18} className="text-[var(--color-info)]" />
                    <p className="font-bold text-primary">{snapshot.label}</p>
                  </div>
                  <p className="text-xs text-tertiary font-mono">{snapshot.folder}</p>
                  <p className="text-xs text-secondary mt-1">{snapshot.date}</p>
                </div>

                {/* Files */}
                <div className="space-y-2">
                  {DEMO_FILES.map((file, fileIdx) => {
                    const changedInThisBackup = !isFirst && file.changed;
                    const isScanning = animationPhase === 'scanning' && snapshotIdx === 1;
                    const uniqueId = `${snapshotIdx}-${file.id}`;

                    return (
                      <div key={fileIdx} className="relative">
                        <div
                          id={uniqueId}
                          className={`bg-layer-2 border-2 rounded-lg p-3 transition-all duration-300 ${
                            changedInThisBackup
                              ? 'border-accent-primary shadow-md'
                              : 'border-layer-3'
                          } ${isScanning ? 'animate-pulse' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <Icons.FileText
                              size={14}
                              className={
                                changedInThisBackup ? 'text-accent-primary' : 'text-tertiary'
                              }
                            />
                            <p className="text-xs font-mono text-secondary flex-1">{file.name}</p>
                            {changedInThisBackup && (
                              <span className="text-[10px] bg-accent-secondary text-accent-primary px-1.5 py-0.5 rounded font-semibold">
                                MODIFIED
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-tertiary mt-1">
                            {file.size} KB {!changedInThisBackup && !isFirst && '(linked)'}
                          </p>
                        </div>

                        {/* Hard Link Lines */}
                        {showLinks && !isFirst && !changedInThisBackup && snapshotIdx > 0 && (
                          <svg
                            className="absolute top-1/2 -left-8 w-8 h-1 pointer-events-none animate-fade-in"
                            style={{ transform: 'translateY(-50%)' }}
                          >
                            <line
                              x1="0"
                              y1="0"
                              x2="32"
                              y2="0"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeDasharray="4 4"
                              className="text-[var(--color-success)]"
                            />
                            <circle
                              cx="16"
                              cy="0"
                              r="3"
                              fill="currentColor"
                              className="text-[var(--color-success)]"
                            />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Storage Indicator */}
                <div className="bg-layer-2 border border-layer-3 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-secondary">Storage Used</p>
                    <Icons.HardDrive size={14} className="text-tertiary" />
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {isFirst ? '219.1 KB' : snapshotIdx === 1 ? '57.5 KB' : '65.8 KB'}
                  </p>
                  {!isFirst && (
                    <p className="text-[10px] text-[var(--color-success)] font-semibold mt-1">
                      {snapshotIdx === 1 ? '↓ 73.8% saved' : '↓ 70.0% saved'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-accent-primary rounded" />
            <span className="text-secondary">Modified file (new copy)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-layer-3 rounded" />
            <span className="text-secondary">Unchanged file (hard link)</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-6 h-0.5">
              <line
                x1="0"
                y1="0"
                x2="24"
                y2="0"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="text-[var(--color-success)]"
              />
            </svg>
            <span className="text-secondary">Hard link connection</span>
          </div>
        </div>
      </div>

      {/* Key Takeaway */}
      <div className="bg-layer-2 border-2 border-[var(--color-success)] rounded-xl p-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-[var(--color-success)] rounded-full flex items-center justify-center">
              <Icons.Lightbulb size={24} className="text-white" />
            </div>
          </div>
          <div>
            <h4 className="font-bold text-primary mb-2">The Magic of Hard Links</h4>
            <p className="text-sm text-secondary leading-relaxed">
              When rsync runs with{' '}
              <code className="px-1.5 py-0.5 bg-layer-3 rounded font-mono text-xs">
                --link-dest
              </code>
              , it compares each file to the previous backup. If a file hasn't changed, instead of
              copying it again, rsync creates a <strong>hard link</strong>—both filenames point to
              the same data on disk. You get complete, browsable snapshots while only storing what
              actually changed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
