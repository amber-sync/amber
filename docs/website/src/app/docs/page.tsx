"use client";

import Link from "next/link";
import { ArrowLeft, Clock, HardDrive, Terminal, Shield, Users, FileWarning, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { HardLinkVisualizer } from "@/components/HardLinkVisualizer";

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

        <div className="space-y-20">
          {/* Section 1: Intro & Visualizer */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Clock size={24} />
              </div>
              <h2 className="text-2xl font-semibold">How Time Machine Works</h2>
            </div>
            
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-lg leading-relaxed mb-8">
                Amber's "Time Machine" mode creates a series of snapshots that look like full backups of your files at a specific point in time. 
                However, instead of copying every file every time (which would fill up your disk instantly), Amber uses a clever file system feature called <strong>hard links</strong>.
              </p>

              <HardLinkVisualizer />

              <div className="grid md:grid-cols-3 gap-6 mt-8">
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <h3 className="font-bold mb-2">1. Initial Backup</h3>
                  <p className="text-sm text-gray-500">The first time you run Amber, it copies all your files to a new folder (e.g., <code>2025-01-01</code>).</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <h3 className="font-bold mb-2">2. Subsequent Scans</h3>
                  <p className="text-sm text-gray-500">On the next run, Amber compares your current files with the previous backup.</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <h3 className="font-bold mb-2">3. Smart Linking</h3>
                  <p className="text-sm text-gray-500">If a file hasn't changed, Amber creates a "link" to the old one. It takes up zero extra space!</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Technical Deep Dive */}
          <section>
             <div className="flex items-center gap-3 mb-8">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <Terminal size={24} />
              </div>
              <h2 className="text-2xl font-semibold">Technical Deep Dive</h2>
            </div>

            <div className="grid gap-8">
              {/* Backup Markers */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl">
                    <FileWarning size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Safety First: Backup Markers</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      One of the biggest risks in automation is accidentally syncing to the wrong drive (e.g., if your external drive gets disconnected and the path falls back to your local disk).
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-4 text-sm border border-gray-100 dark:border-gray-800">
                      <p className="font-semibold mb-2">How Amber Protects You:</p>
                      <ul className="list-disc list-inside space-y-1 text-gray-500">
                        <li>Amber places a hidden file <code>.amber_marker</code> in your destination root.</li>
                        <li>Before every sync, it checks for this marker.</li>
                        <li>If the marker is missing (e.g., drive unmounted), the backup <strong>aborts immediately</strong>.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-User Support */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Multi-User & Permissions</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Amber is designed to respect macOS file permissions, making it safe for multi-user environments.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-4 text-sm border border-gray-100 dark:border-gray-800">
                        <h4 className="font-bold mb-1 flex items-center gap-2">
                          <Shield size={14} className="text-green-500" /> Ownership
                        </h4>
                        <p className="text-gray-500">
                          Rsync preserves the original owner and group ID of every file (using <code>-a</code> archive mode).
                        </p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-4 text-sm border border-gray-100 dark:border-gray-800">
                        <h4 className="font-bold mb-1 flex items-center gap-2">
                          <Shield size={14} className="text-blue-500" /> ACLs & XAttrs
                        </h4>
                        <p className="text-gray-500">
                          Extended attributes (like Finder tags) and Access Control Lists are fully preserved.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Rsync Reference */}
          <section className="border-t border-gray-200 dark:border-gray-800 pt-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Powered by Rsync</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Amber is a native GUI wrapper around the industry-standard <code>rsync</code> tool.
                </p>
              </div>
              <Link 
                href="https://download.samba.org/pub/rsync/rsync.1" 
                target="_blank"
                className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                Read Official Manual <ArrowRight size={16} />
              </Link>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
