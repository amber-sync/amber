import React from 'react';
import * as Icons from 'lucide-react';

export const HelpSection: React.FC = () => {
  const openDocs = () => {
    // In a real Electron app, this would open in the default browser
    window.open('https://amber-sync.vercel.app/docs', '_blank');
  };

  const openRsyncDocs = () => {
    window.open('https://download.samba.org/pub/rsync/rsync.1', '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-12 text-center">
      <div className="mb-8 inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-teal-500 to-indigo-600 rounded-3xl shadow-xl shadow-teal-500/20">
        <Icons.BookOpen size={40} className="text-white" />
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Documentation & Help
      </h1>
      
      <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-12">
        We've moved our detailed guides and technical explanations to our website to keep the app lightweight and focused.
      </p>

      <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        <button 
          onClick={openDocs}
          className="group relative overflow-hidden p-8 rounded-2xl bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-indigo-900 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all duration-300 text-left shadow-sm hover:shadow-md"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Icons.ExternalLink size={80} />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400">
              <Icons.Globe size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Online Documentation</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Read about Time Machine mode, backup strategies, and troubleshooting in our comprehensive guides.
            </p>
          </div>
        </button>

        <button 
          onClick={openRsyncDocs}
          className="group relative overflow-hidden p-8 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-300 text-left shadow-sm hover:shadow-md"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Icons.Terminal size={80} />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mb-4 text-gray-600 dark:text-gray-400">
              <Icons.Command size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Rsync Manual</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View the official documentation for rsync to understand advanced flags and options.
            </p>
          </div>
        </button>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800">
        <p className="text-sm text-gray-500">
          Version 1.0.0 • Built with ❤️ for macOS
        </p>
      </div>
    </div>
  );
};
