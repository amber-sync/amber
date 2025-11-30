import React from 'react';
import { Icons } from './IconComponents';

export const SidecarBenchmark: React.FC = () => {
  return (
    <div className="p-6 bg-layer-2 rounded-xl border border-border-base">
      <div className="flex items-center gap-3 mb-4">
        <Icons.Zap className="text-accent-primary" size={24} />
        <h3 className="text-lg font-semibold text-text-primary">Performance</h3>
      </div>
      <p className="text-text-secondary text-sm">
        File scanning is powered by the Rust backend for optimal performance.
        Handles 65,000+ files per second using parallel processing.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="p-3 bg-layer-1 rounded-lg text-center">
          <div className="text-2xl font-bold text-accent-primary">65k+</div>
          <div className="text-xs text-text-tertiary">files/sec</div>
        </div>
        <div className="p-3 bg-layer-1 rounded-lg text-center">
          <div className="text-2xl font-bold text-success">Rust</div>
          <div className="text-xs text-text-tertiary">Backend</div>
        </div>
        <div className="p-3 bg-layer-1 rounded-lg text-center">
          <div className="text-2xl font-bold text-info">Tauri</div>
          <div className="text-xs text-text-tertiary">Framework</div>
        </div>
      </div>
    </div>
  );
};
