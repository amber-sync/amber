"use client";

import { motion } from "framer-motion";

interface MacWindowProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

/**
 * macOS-style window chrome component
 * Wraps content in a realistic macOS window frame
 */
export function MacWindow({ children, title = "Amber", className = "" }: MacWindowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
      className={`relative rounded-xl overflow-hidden shadow-2xl ${className}`}
    >
      {/* Window Chrome */}
      <div className="h-8 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-2">
        {/* Traffic Lights */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
        </div>
        {/* Window Title */}
        <span className="flex-1 text-center text-xs text-gray-500 dark:text-gray-400 font-medium">
          {title}
        </span>
        {/* Spacer for symmetry */}
        <div className="w-14" />
      </div>

      {/* Window Content */}
      <div className="bg-gray-900">
        {children}
      </div>
    </motion.div>
  );
}
