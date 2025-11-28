import React from 'react';
import * as Icons from 'lucide-react';

export const HelpSection: React.FC = () => {
  const openDocs = () => {
    window.open('https://amber-sync.vercel.app/docs', '_blank');
  };

  const openRsyncDocs = () => {
    window.open('https://download.samba.org/pub/rsync/rsync.1', '_blank');
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
          <Icons.BookOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Documentation & Resources
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Online Docs Card */}
        <button 
          onClick={openDocs}
          className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all text-left group"
        >
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
            <Icons.Globe size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              Online Documentation
              <Icons.ExternalLink size={12} className="opacity-50" />
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Comprehensive guides on Time Machine mode, backup strategies, and troubleshooting.
            </p>
          </div>
        </button>

        {/* Rsync Manual Card */}
        <button 
          onClick={openRsyncDocs}
          className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-md transition-all text-left group"
        >
          <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg text-gray-600 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
            <Icons.Terminal size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              Rsync Manual
              <Icons.ExternalLink size={12} className="opacity-50" />
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Official technical documentation for rsync flags and advanced configuration options.
            </p>
          </div>
        </button>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs text-gray-400">
        <span>Version 1.0.0</span>
        <span>Built with ❤️ for macOS</span>
      </div>
    </div>
  );
};
