"use client";

import { motion } from "framer-motion";

export function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-background" />
      
      {/* Animated Gradients */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          rotate: [0, 90, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-blue-500/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen"
      />
      
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 100, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-[20%] -right-[10%] w-[60vw] h-[60vw] bg-purple-500/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen"
      />

      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
          y: [0, -50, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute -bottom-[20%] left-[20%] w-[50vw] h-[50vw] bg-indigo-500/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen"
      />
    </div>
  );
}
