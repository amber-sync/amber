import React from 'react';
import * as Icons from 'lucide-react';
import { SidecarBenchmark } from './SidecarBenchmark';
import { Title, Body, Caption } from './ui';

export const HelpSection: React.FC = () => {
  const openDocs = () => {
    window.open('https://amber-sync.vercel.app/docs', '_blank');
  };

  const openRsyncDocs = () => {
    window.open('https://download.samba.org/pub/rsync/rsync.1', '_blank');
  };

  return (
    <div className="page-content page-content--narrow page-animate-in">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Online Docs Card */}
        <button
          onClick={openDocs}
          className="flex items-start gap-4 p-5 rounded-xl bg-layer-2 border border-border-subtle hover:border-accent-primary hover:shadow-md transition-all text-left group"
        >
          <div className="p-3 bg-accent-primary/10 rounded-lg text-accent-primary group-hover:bg-accent-primary/20 transition-colors">
            <Icons.Globe size={20} />
          </div>
          <div>
            <Title level={4} className="mb-1 flex items-center gap-2">
              Online Documentation
              <Icons.ExternalLink size={12} className="opacity-50" />
            </Title>
            <Body size="sm" color="secondary" className="leading-relaxed">
              Comprehensive guides on Time Machine mode, backup strategies, and troubleshooting.
            </Body>
          </div>
        </button>

        {/* Rsync Manual Card */}
        <button
          onClick={openRsyncDocs}
          className="flex items-start gap-4 p-5 rounded-xl bg-layer-2 border border-border-subtle hover:border-border-medium hover:shadow-md transition-all text-left group"
        >
          <div className="p-3 bg-layer-3 rounded-lg text-text-secondary group-hover:bg-layer-3/80 transition-colors">
            <Icons.Terminal size={20} />
          </div>
          <div>
            <Title level={4} className="mb-1 flex items-center gap-2">
              Rsync Manual
              <Icons.ExternalLink size={12} className="opacity-50" />
            </Title>
            <Body size="sm" color="secondary" className="leading-relaxed">
              Official technical documentation for rsync flags and advanced configuration options.
            </Body>
          </div>
        </button>
      </div>

      <div className="mt-8 pt-6 border-t border-border-subtle flex justify-between items-center">
        <Caption color="tertiary">Version 1.0.0</Caption>
        <Caption color="tertiary">Built with ❤️ for macOS</Caption>
      </div>

      <div className="mt-8">
        <SidecarBenchmark />
      </div>
    </div>
  );
};
