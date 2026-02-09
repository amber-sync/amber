import Link from "next/link";
import { HardDrive, Clock, Zap, Shield } from "lucide-react";
import { Hero } from "@/components/Hero";
import { FeatureCard } from "@/components/FeatureCard";
import { ComparisonTable } from "@/components/ComparisonTable";
import { FAQ } from "@/components/FAQ";
import { APP_VERSION } from "@/lib/version";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-[family-name:var(--font-geist-sans)] bg-background text-foreground overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200/50 dark:border-gray-800/50 bg-background/80 backdrop-blur-md">
        <div className="w-full max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center font-bold text-lg">
              A
            </div>
            Amber
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-gray-500 dark:text-gray-400">
            <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
            <Link href="#download" className="hover:text-foreground transition-colors">Download</Link>
            <Link href="https://github.com/amber-sync/amber-sync" className="hover:text-foreground transition-colors">GitHub</Link>
          </nav>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-16">
        <Hero />

        {/* Features Grid */}
        <section id="features" className="w-full max-w-7xl mx-auto py-24 border-t border-gray-100 dark:border-gray-900">
          <div className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Everything you need</h2>
            <p className="text-gray-500 dark:text-gray-400">
              Powerful features wrapped in a simple, elegant interface designed for macOS.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard 
              icon={<HardDrive />}
              title="Rsync Power"
              description="Built on the industry-standard Rsync protocol for fast, reliable, and efficient file transfers."
              delay={0.1}
            />
            <FeatureCard 
              icon={<Clock />}
              title="Time Machine"
              description="Create incremental snapshots that look like full backups but use a fraction of the space."
              delay={0.2}
            />
            <FeatureCard 
              icon={<Zap />}
              title="Background Sync"
              description="Runs quietly in the background. Set it and forget it with customizable schedules."
              delay={0.3}
            />
            <FeatureCard 
              icon={<Shield />}
              title="Privacy First"
              description="Your data never leaves your devices. No cloud, no tracking, just your files."
              delay={0.4}
            />
          </div>
        </section>

        {/* Comparison Table */}
        <ComparisonTable />

        {/* FAQ */}
        <FAQ />
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-gray-100 dark:border-gray-900 py-12 bg-gray-50/50 dark:bg-gray-900/20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-sm text-gray-500">
            © {new Date().getFullYear()} Amber v{APP_VERSION} · All rights reserved
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="https://github.com/amber-sync/amber-sync" className="hover:text-foreground transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
