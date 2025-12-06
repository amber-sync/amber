"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Download, Loader2 } from "lucide-react";
import { APP_VERSION } from "@/lib/version";
import { useEffect, useState } from "react";

interface ReleaseInfo {
  version: string;
  downloadUrl: string | null;
  error?: string;
  fallback?: boolean;
  fallbackUrl?: string;
}

export function Hero() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/latest-release')
      .then(res => res.json())
      .then(data => {
        setRelease(data);
        setLoading(false);
      })
      .catch(() => {
        setRelease({
          version: APP_VERSION,
          downloadUrl: null,
          fallback: true,
          fallbackUrl: 'https://github.com/florianmahner/amber-sync/releases',
        });
        setLoading(false);
      });
  }, []);

  const downloadUrl = release?.downloadUrl || release?.fallbackUrl || '#download';
  const isExternalLink = downloadUrl.startsWith('http');

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-24">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex justify-center"
        >
          <span className="rounded-full bg-gray-100 dark:bg-gray-800/50 backdrop-blur-sm px-3 py-1 text-sm text-gray-600 dark:text-gray-300 ring-1 ring-inset ring-gray-500/10">
            v{APP_VERSION}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl sm:text-7xl font-bold tracking-tight mb-8 text-balance"
        >
          Backup your life, <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-b from-black to-gray-400 dark:from-white dark:to-gray-400">
            simply and securely.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto text-balance"
        >
          Amber brings the power of Rsync to a beautiful, native macOS interface.
          Time Machine-style snapshots, background syncing, and zero config
          required.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          {isExternalLink ? (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 px-8 rounded-full bg-foreground text-background font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Download size={20} />
                  Download v{release?.version || APP_VERSION}
                </>
              )}
            </a>
          ) : (
            <Link
              href={downloadUrl}
              className="h-12 px-8 rounded-full bg-foreground text-background font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Download size={20} />
                  Download v{release?.version || APP_VERSION}
                </>
              )}
            </Link>
          )}
          <Link
            href="#features"
            className="h-12 px-8 rounded-full border border-gray-200 dark:border-gray-800 font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors backdrop-blur-sm"
          >
            Learn more <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>

      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none z-0">
        <div className="absolute top-[20%] left-[10%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] mix-blend-screen" />
        <div className="absolute top-[10%] right-[10%] w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] mix-blend-screen" />
      </div>
    </section>
  );
}
