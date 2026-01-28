import React from 'react';
import { Icons } from './IconComponents';
import { PageContainer } from './layout';
import { Title, Body, Card } from './ui';

interface DocLinkProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

const DocLink: React.FC<DocLinkProps> = ({ icon, title, description, onClick }) => (
  <button onClick={onClick} className="flex items-center gap-4 w-full text-left group">
    <div className="w-10 h-10 rounded-xl bg-layer-2 flex items-center justify-center shrink-0 group-hover:bg-layer-3 transition-colors">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <Body weight="medium">{title}</Body>
      <Body size="sm" color="secondary">
        {description}
      </Body>
    </div>
    <Icons.ExternalLink
      size={16}
      className="text-text-tertiary shrink-0 group-hover:text-text-secondary transition-colors"
    />
  </button>
);

interface ShortcutRowProps {
  keys: string[];
  description: string;
}

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-layer-2 border border-border-base text-text-secondary text-xs font-medium shadow-sm">
    {children}
  </kbd>
);

const ShortcutRow: React.FC<ShortcutRowProps> = ({ keys, description }) => (
  <div className="flex items-center justify-between">
    <Body size="sm" color="secondary">
      {description}
    </Body>
    <div className="flex items-center gap-1">
      {keys.map((key, i) => (
        <Kbd key={i}>{key}</Kbd>
      ))}
    </div>
  </div>
);

export const HelpSection: React.FC = () => {
  const openDocs = () => {
    window.open('https://amber-sync.vercel.app/docs', '_blank');
  };

  const openRsyncDocs = () => {
    window.open('https://download.samba.org/pub/rsync/rsync.1', '_blank');
  };

  return (
    <PageContainer width="narrow" scrollable animate>
      <div className="max-w-xl mx-auto space-y-6">
        {/* Documentation */}
        <Card variant="default" padding="md">
          <Title level={4} className="mb-4">
            Documentation
          </Title>
          <div className="space-y-4">
            <DocLink
              icon={<Icons.FileText size={18} className="text-accent-primary" />}
              title="Amber Guides"
              description="Backup strategies & troubleshooting"
              onClick={openDocs}
            />
            <div className="border-t border-dashed border-border-base" />
            <DocLink
              icon={<Icons.Terminal size={18} className="text-text-secondary" />}
              title="Rsync Reference"
              description="Technical flags & options"
              onClick={openRsyncDocs}
            />
          </div>
        </Card>

        {/* Performance */}
        <Card variant="default" padding="md">
          <Title level={4} className="mb-4">
            Performance
          </Title>
          <div className="flex justify-around mb-4">
            <div className="text-center">
              <Body weight="medium" className="text-accent-primary text-xl">
                65k+
              </Body>
              <Body size="sm" color="tertiary">
                files/sec
              </Body>
            </div>
            <div className="text-center">
              <Body weight="medium" className="text-success text-xl">
                Rust
              </Body>
              <Body size="sm" color="tertiary">
                backend
              </Body>
            </div>
            <div className="text-center">
              <Body weight="medium" className="text-info text-xl">
                Tauri
              </Body>
              <Body size="sm" color="tertiary">
                framework
              </Body>
            </div>
          </div>
          <Body size="sm" color="secondary" className="text-center">
            Powered by parallel processing for fast file scanning
          </Body>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card variant="default" padding="md">
          <Title level={4} className="mb-4">
            Keyboard Shortcuts
          </Title>
          <div className="space-y-3">
            <ShortcutRow keys={['⌘', 'K']} description="Command palette" />
            <ShortcutRow keys={['⌘', ',']} description="Settings" />
            <ShortcutRow keys={['⌘', 'N']} description="New backup job" />
          </div>
        </Card>

        {/* Copyright */}
        <div className="text-center pt-2">
          <Body size="sm" color="tertiary">
            © 2025 Florian P. Mahner
          </Body>
        </div>
      </div>
    </PageContainer>
  );
};
