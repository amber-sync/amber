import React from 'react';

export const AmbientBackground: React.FC = () => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
    <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-zinc-200/5 dark:bg-zinc-800/5 blur-[100px] animate-pulse" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-zinc-300/5 dark:bg-zinc-700/5 blur-[100px] animate-pulse delay-1000" />

    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 dark:opacity-10 mix-blend-overlay"></div>
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    />
    <div className="dark:hidden absolute inset-0 bg-gradient-to-b from-transparent to-white/50" />
  </div>
);
