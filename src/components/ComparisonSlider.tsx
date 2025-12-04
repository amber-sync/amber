import React, { useState, useEffect, useMemo } from 'react';
import * as Icons from 'lucide-react';

export const ComparisonSlider: React.FC = () => {
  const [sliderValue, setSliderValue] = useState(50);
  const [animatedStorage, setAnimatedStorage] = useState({ traditional: 0, timeMachine: 0 });
  const [animatedFiles, setAnimatedFiles] = useState({ traditional: 0, timeMachine: 0 });

  const numBackups = 10;
  const avgBackupSize = 2500; // MB
  const changeRate = 0.15; // 15% of files change between backups

  // Memoize computed values for stable references
  const { traditionalStorage, timeMachineStorage, traditionalFiles, timeMachineFiles } = useMemo(
    () => ({
      traditionalStorage: numBackups * avgBackupSize,
      timeMachineStorage: avgBackupSize + avgBackupSize * changeRate * (numBackups - 1),
      traditionalFiles: numBackups * 10000,
      timeMachineFiles: 10000 + 10000 * changeRate * (numBackups - 1),
    }),
    [] // Constants never change
  );

  // Animate counters
  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const interval = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setAnimatedStorage({
        traditional: Math.round(traditionalStorage * progress),
        timeMachine: Math.round(timeMachineStorage * progress),
      });

      setAnimatedFiles({
        traditional: Math.round(traditionalFiles * progress),
        timeMachine: Math.round(timeMachineFiles * progress),
      });

      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [traditionalStorage, timeMachineStorage, traditionalFiles, timeMachineFiles]);

  const formatStorage = (mb: number) => {
    return `${(mb / 1000).toFixed(1)} GB`;
  };

  const formatFiles = (num: number) => {
    return num.toLocaleString();
  };

  const savings = ((traditionalStorage - timeMachineStorage) / traditionalStorage) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-text-primary mb-2">
          Traditional Backups vs. Time Machine
        </h3>
        <p className="text-text-secondary max-w-3xl mx-auto">
          Compare storage requirements for {numBackups} backups of a {formatStorage(avgBackupSize)}{' '}
          dataset with {changeRate * 100}% of files changing between backups.
        </p>
      </div>

      {/* Interactive Slider */}
      <div className="bg-gradient-to-br from-layer-1 to-layer-2 border border-border-base rounded-2xl overflow-hidden shadow-lg">
        <div className="relative h-96">
          {/* Left Side - Traditional */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-br from-accent-secondary to-accent-secondary/80 transition-all duration-300 ease-out overflow-hidden"
            style={{ width: `${sliderValue}%` }}
          >
            <div className="h-full p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-accent-primary rounded-xl flex items-center justify-center shadow-lg">
                    <Icons.Copy size={24} className="text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-text-primary">Traditional Backups</h4>
                    <p className="text-xs text-text-secondary">Complete copy every time</p>
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  <div className="bg-layer-1/60 backdrop-blur-sm rounded-xl p-4 border border-accent-primary">
                    <p className="text-xs text-text-secondary mb-1">Total Storage</p>
                    <p className="text-3xl font-extrabold text-text-primary">
                      {formatStorage(animatedStorage.traditional)}
                    </p>
                  </div>

                  <div className="bg-layer-1/60 backdrop-blur-sm rounded-xl p-4 border border-accent-primary">
                    <p className="text-xs text-text-secondary mb-1">Total Files Stored</p>
                    <p className="text-2xl font-bold text-text-primary">
                      {formatFiles(animatedFiles.traditional)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-text-primary">
                  <Icons.X size={16} className="text-[var(--color-danger)]" />
                  <span>Every backup is a full copy</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-text-primary">
                  <Icons.X size={16} className="text-[var(--color-danger)]" />
                  <span>Wastes disk space on duplicates</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-text-primary">
                  <Icons.X size={16} className="text-[var(--color-danger)]" />
                  <span>Linear storage growth</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Time Machine */}
          <div
            className="absolute inset-y-0 right-0 bg-gradient-to-bl from-[var(--color-info-subtle)] to-[var(--color-info-subtle)]/80 transition-all duration-300 ease-out overflow-hidden"
            style={{ width: `${100 - sliderValue}%` }}
          >
            <div className="h-full p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-info)] to-[var(--color-info)]/80 rounded-xl flex items-center justify-center shadow-lg">
                    <Icons.Link size={24} className="text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-text-primary">Time Machine Mode</h4>
                    <p className="text-xs text-text-secondary">Smart incremental with hard links</p>
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  <div className="bg-layer-1/60 backdrop-blur-sm rounded-xl p-4 border border-[var(--color-info)]">
                    <p className="text-xs text-text-secondary mb-1">Total Storage</p>
                    <p className="text-3xl font-extrabold text-text-primary">
                      {formatStorage(animatedStorage.timeMachine)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Icons.TrendingDown size={14} className="text-[var(--color-info)]" />
                      <span className="text-xs font-semibold text-[var(--color-info)]">
                        {savings.toFixed(0)}% less storage
                      </span>
                    </div>
                  </div>

                  <div className="bg-layer-1/60 backdrop-blur-sm rounded-xl p-4 border border-[var(--color-info)]">
                    <p className="text-xs text-text-secondary mb-1">Physical Files Stored</p>
                    <p className="text-2xl font-bold text-text-primary">
                      {formatFiles(animatedFiles.timeMachine)}
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      ({formatFiles(animatedFiles.traditional)} appear to user)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-text-primary">
                  <Icons.Check size={16} className="text-[var(--color-info)]" />
                  <span>Only changed files copied</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-text-primary">
                  <Icons.Check size={16} className="text-[var(--color-info)]" />
                  <span>Unchanged files use hard links</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-text-primary">
                  <Icons.Check size={16} className="text-[var(--color-info)]" />
                  <span>Massive storage savings</span>
                </div>
              </div>
            </div>
          </div>

          {/* Slider Handle */}
          <div
            className="absolute inset-y-0 w-1 bg-gradient-to-b from-text-secondary to-text-primary shadow-2xl cursor-ew-resize z-10 transition-all duration-150"
            style={{ left: `${sliderValue}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-layer-1 border-4 border-border-base rounded-full shadow-xl flex items-center justify-center">
              <Icons.ChevronsLeftRight size={20} className="text-text-secondary" />
            </div>
          </div>

          {/* Interactive overlay */}
          <input
            type="range"
            min="20"
            max="80"
            value={sliderValue}
            onChange={e => setSliderValue(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
          />
        </div>

        {/* Instructions */}
        <div className="bg-layer-1 border-t border-border-base px-8 py-4">
          <p className="text-center text-sm text-text-secondary flex items-center justify-center gap-2">
            <Icons.Hand size={16} />
            Drag the slider to compare storage methods
          </p>
        </div>
      </div>

      {/* Savings Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-layer-1 border border-border-base rounded-xl p-6">
          <h4 className="font-bold text-text-primary mb-4 flex items-center gap-2">
            <Icons.Calculator size={18} className="text-[var(--color-info)]" />
            Storage Calculation
          </h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center pb-2 border-b border-border-base">
              <span className="text-text-secondary">Dataset size:</span>
              <span className="font-mono font-semibold text-text-primary">
                {formatStorage(avgBackupSize)}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border-base">
              <span className="text-text-secondary">Number of backups:</span>
              <span className="font-mono font-semibold text-text-primary">{numBackups}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border-base">
              <span className="text-text-secondary">Change rate:</span>
              <span className="font-mono font-semibold text-text-primary">{changeRate * 100}%</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-text-primary font-bold">Space saved:</span>
              <span className="font-mono font-bold text-[var(--color-info)] text-lg">
                {formatStorage(traditionalStorage - timeMachineStorage)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[var(--color-info-subtle)] to-[var(--color-info-subtle)]/60 border-2 border-[var(--color-info)] rounded-xl p-6">
          <h4 className="font-bold text-text-primary mb-3 flex items-center gap-2">
            <Icons.Zap size={18} className="text-[var(--color-info)]" />
            Real-World Impact
          </h4>
          <ul className="space-y-2 text-sm text-text-primary">
            <li className="flex items-start gap-2">
              <Icons.ArrowRight
                size={16}
                className="text-[var(--color-info)] flex-shrink-0 mt-0.5"
              />
              <span>Keep more history without filling your disk</span>
            </li>
            <li className="flex items-start gap-2">
              <Icons.ArrowRight
                size={16}
                className="text-[var(--color-info)] flex-shrink-0 mt-0.5"
              />
              <span>Faster backups (only copying changes)</span>
            </li>
            <li className="flex items-start gap-2">
              <Icons.ArrowRight
                size={16}
                className="text-[var(--color-info)] flex-shrink-0 mt-0.5"
              />
              <span>Lower cloud storage costs if backing up remotely</span>
            </li>
            <li className="flex items-start gap-2">
              <Icons.ArrowRight
                size={16}
                className="text-[var(--color-info)] flex-shrink-0 mt-0.5"
              />
              <span>Every snapshot looks complete when browsing</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
