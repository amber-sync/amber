import Link from "next/link";
import { ArrowRight, HardDrive, Clock, Zap, Shield, Download } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-[family-name:var(--font-geist-sans)]">
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto p-6 flex justify-between items-center">
        <div className="text-xl font-bold tracking-tight">Amber</div>
        <nav className="hidden md:flex gap-6 text-sm text-gray-500">
          <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
          <Link href="#download" className="hover:text-foreground transition-colors">Download</Link>
          <Link href="https://github.com/florianmahner/amber" className="hover:text-foreground transition-colors">GitHub</Link>
        </nav>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="text-center max-w-4xl mx-auto py-20 sm:py-32">
          <div className="mb-8 flex justify-center">
            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-sm text-gray-600 dark:text-gray-300 ring-1 ring-inset ring-gray-500/10">
              v1.0.0 Public Beta
            </span>
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-8 text-balance">
            Backup your life, <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-black to-gray-400 dark:from-white dark:to-gray-400">simply and securely.</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto text-balance">
            Amber brings the power of Rsync to a beautiful, native macOS interface. 
            Time Machine-style snapshots, background syncing, and zero config required.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              href="/download" 
              className="h-12 px-8 rounded-full bg-foreground text-background font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Download size={20} />
              Download for macOS
            </Link>
            <Link 
              href="#features" 
              className="h-12 px-8 rounded-full border border-gray-200 dark:border-gray-800 font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              Learn more <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="w-full max-w-6xl mx-auto py-20 border-t border-gray-100 dark:border-gray-900">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<HardDrive />}
              title="Rsync Power"
              description="Built on the industry-standard Rsync protocol for fast, reliable, and efficient file transfers."
            />
            <FeatureCard 
              icon={<Clock />}
              title="Time Machine"
              description="Create incremental snapshots that look like full backups but use a fraction of the space."
            />
            <FeatureCard 
              icon={<Zap />}
              title="Background Sync"
              description="Runs quietly in the background. Set it and forget it with customizable schedules."
            />
            <FeatureCard 
              icon={<Shield />}
              title="Privacy First"
              description="Your data never leaves your devices. No cloud, no tracking, just your files."
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-gray-100 dark:border-gray-900 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-sm text-gray-500">
            © {new Date().getFullYear()} Amber. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="https://github.com/florianmahner/amber" className="hover:text-foreground transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-background border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-4 text-foreground">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
