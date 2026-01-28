"use client";

import { MacWindow } from "./MacWindow";
import { HardDrive, Clock, CheckCircle, Play, FolderSync } from "lucide-react";

/**
 * Stylized preview of the Amber app interface
 * Shows key UI elements without requiring actual screenshots
 */
export function AppPreview() {
  return (
    <MacWindow title="Amber — Backup Dashboard" className="w-full max-w-4xl mx-auto">
      <div className="flex min-h-[400px]">
        {/* Sidebar */}
        <div className="w-44 bg-gray-950 border-r border-gray-800 p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <FolderSync size={16} className="text-white" />
            </div>
            <span className="font-semibold text-white text-sm">Amber</span>
          </div>

          <nav className="space-y-1">
            <SidebarItem icon={<HardDrive size={16} />} label="Dashboard" active />
            <SidebarItem icon={<Clock size={16} />} label="Time Machine" />
          </nav>

          <div className="mt-auto text-xs text-gray-500 text-center">
            v0.0.1-beta
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-gray-900 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">Your Backups</h2>
            <p className="text-sm text-gray-400">3 jobs configured</p>
          </div>

          <div className="space-y-3">
            <JobCard
              name="Documents Backup"
              status="success"
              lastRun="2 hours ago"
              source="~/Documents"
              dest="/Volumes/Backup"
            />
            <JobCard
              name="Projects Sync"
              status="running"
              lastRun="Running now..."
              source="~/Projects"
              dest="/Volumes/External"
            />
            <JobCard
              name="Photos Archive"
              status="idle"
              lastRun="Yesterday"
              source="~/Pictures"
              dest="/Volumes/Archive"
            />
          </div>
        </div>
      </div>
    </MacWindow>
  );
}

function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
      active
        ? "bg-amber-500/20 text-amber-400"
        : "text-gray-400 hover:text-gray-300"
    }`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function JobCard({
  name,
  status,
  lastRun,
  source,
  dest
}: {
  name: string;
  status: "success" | "running" | "idle";
  lastRun: string;
  source: string;
  dest: string;
}) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white text-sm">{name}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{lastRun}</p>
        </div>
        <button className="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
          <Play size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <code className="px-1.5 py-0.5 bg-gray-800 rounded">{source}</code>
        <span>→</span>
        <code className="px-1.5 py-0.5 bg-gray-800 rounded">{dest}</code>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "success" | "running" | "idle" }) {
  const styles = {
    success: "bg-green-500/20 text-green-400",
    running: "bg-amber-500/20 text-amber-400",
    idle: "bg-gray-700 text-gray-400",
  };

  const labels = {
    success: "Synced",
    running: "Syncing",
    idle: "Idle",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status === "success" && <CheckCircle size={10} className="inline mr-1" />}
      {labels[status]}
    </span>
  );
}
