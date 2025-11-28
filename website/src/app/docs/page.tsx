"use client";

import Link from "next/link";
import { ArrowLeft, Clock, HardDrive, Terminal } from "lucide-react";
import { motion } from "framer-motion";

export default function Docs() {
  return (
    <div className="min-h-screen pt-24 pb-20 px-6 max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft size={16} /> Back to Home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold mb-6">Documentation</h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 mb-12">
          Everything you need to know about using Amber and how it keeps your data safe.
        </p>

        <div className="space-y-16">
          {/* Section 1: How it Works */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Clock size={24} />
              </div>
              <h2 className="text-2xl font-semibold">How Time Machine Works</h2>
            </div>
            
            <div className="prose dark:prose-invert max-w-none">
              <p className="mb-6">
                Amber uses the same smart technology as macOS Time Machine (hard links) to create
                snapshots that look like full backups but take up almost no extra space.
              </p>

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 border border-gray-100 dark:border-gray-800 mb-6">
                <h3 className="font-semibold mb-4">Visualizing Snapshots</h3>
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-24 text-gray-500">Snapshot 1</div>
                    <div className="flex gap-2">
                      <span className="px-2 py-1 bg-green-500/20 text-green-700 dark:text-green-300 rounded">File A (10MB)</span>
                      <span className="px-2 py-1 bg-green-500/20 text-green-700 dark:text-green-300 rounded">File B (5MB)</span>
                    </div>
                    <div className="text-gray-400 text-xs">Total: 15MB</div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-24 text-gray-500">Snapshot 2</div>
                    <div className="flex gap-2">
                      <span className="px-2 py-1 bg-gray-200 dark:bg-gray-800 text-gray-500 rounded border border-dashed border-gray-400">File A (Link)</span>
                      <span className="px-2 py-1 bg-green-500/20 text-green-700 dark:text-green-300 rounded">File B (Modified)</span>
                    </div>
                    <div className="text-gray-400 text-xs">Total: 5MB (Only changes stored)</div>
                  </div>
                </div>
              </div>

              <p>
                When a file hasn't changed, Amber just points to the previous version. 
                This means you can keep months of history without filling up your drive.
              </p>
            </div>
          </section>

          {/* Section 2: Rsync Power */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <Terminal size={24} />
              </div>
              <h2 className="text-2xl font-semibold">Under the Hood: Rsync</h2>
            </div>
            
            <div className="prose dark:prose-invert max-w-none">
              <p className="mb-4">
                Amber is a native GUI wrapper around <code>rsync</code>, the industry-standard tool for file synchronization.
                It inherits all of Rsync's reliability and speed.
              </p>
              <p className="mb-6">
                For advanced users, you can pass custom flags directly to the rsync process in the job settings.
              </p>
              
              <Link 
                href="https://download.samba.org/pub/rsync/rsync.1" 
                target="_blank"
                className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 font-medium"
              >
                Read official Rsync documentation <ArrowRight size={16} />
              </Link>
            </div>
          </section>

          {/* Section 3: FAQ */}
          <section>
             <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                <HardDrive size={24} />
              </div>
              <h2 className="text-2xl font-semibold">Common Questions</h2>
            </div>

            <div className="grid gap-6">
              <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                <h3 className="font-semibold mb-2">Is my data encrypted?</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Amber transfers files directly. If you are syncing to a remote server over SSH, the transfer is encrypted. 
                  For local backups, data is stored as-is (unless your drive is encrypted).
                </p>
              </div>
              
              <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                <h3 className="font-semibold mb-2">Can I restore individual files?</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Yes! Since snapshots are just standard folders, you can browse them with Finder and drag-and-drop any file you want to restore.
                </p>
              </div>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}

import { ArrowRight } from "lucide-react";
