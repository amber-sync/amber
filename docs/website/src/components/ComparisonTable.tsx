"use client";

import { motion } from "framer-motion";
import { Check, X, Minus } from "lucide-react";

interface Feature {
  name: string;
  amber: boolean | "partial";
  timeMachine: boolean | "partial";
  carbonCopy: boolean | "partial";
}

const features: Feature[] = [
  { name: "Incremental backups", amber: true, timeMachine: true, carbonCopy: true },
  { name: "Hard link snapshots", amber: true, timeMachine: true, carbonCopy: true },
  { name: "Scheduled backups", amber: true, timeMachine: true, carbonCopy: true },
  { name: "Background operation", amber: true, timeMachine: true, carbonCopy: true },
  { name: "Network destinations", amber: true, timeMachine: true, carbonCopy: true },
  { name: "Custom exclude patterns", amber: true, timeMachine: "partial", carbonCopy: true },
  { name: "Multiple backup jobs", amber: true, timeMachine: false, carbonCopy: true },
  { name: "Open source", amber: true, timeMachine: false, carbonCopy: false },
  { name: "Free to use", amber: true, timeMachine: true, carbonCopy: false },
  { name: "SSH/remote sync", amber: true, timeMachine: false, carbonCopy: true },
  { name: "Rsync under the hood", amber: true, timeMachine: false, carbonCopy: true },
  { name: "Bootable backups", amber: false, timeMachine: false, carbonCopy: true },
];

function FeatureCell({ value }: { value: boolean | "partial" }) {
  if (value === true) {
    return <Check className="w-5 h-5 text-green-500 mx-auto" />;
  }
  if (value === "partial") {
    return <Minus className="w-5 h-5 text-amber-500 mx-auto" />;
  }
  return <X className="w-5 h-5 text-gray-400 mx-auto" />;
}

export function ComparisonTable() {
  return (
    <section className="w-full max-w-5xl mx-auto py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl font-bold tracking-tight mb-4">How Amber Compares</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          See how Amber stacks up against other popular backup solutions for macOS.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="overflow-x-auto"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="text-left py-4 px-4 font-medium text-gray-500 dark:text-gray-400">
                Feature
              </th>
              <th className="py-4 px-4 font-semibold text-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white font-bold">
                    A
                  </div>
                  <span>Amber</span>
                </div>
              </th>
              <th className="py-4 px-4 font-medium text-center text-gray-600 dark:text-gray-300">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    🕐
                  </div>
                  <span>Time Machine</span>
                </div>
              </th>
              <th className="py-4 px-4 font-medium text-center text-gray-600 dark:text-gray-300">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    💾
                  </div>
                  <span>Carbon Copy</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature, i) => (
              <tr
                key={feature.name}
                className={`border-b border-gray-100 dark:border-gray-800/50 ${
                  i % 2 === 0 ? "bg-gray-50/50 dark:bg-gray-900/20" : ""
                }`}
              >
                <td className="py-3 px-4 text-sm">{feature.name}</td>
                <td className="py-3 px-4">
                  <FeatureCell value={feature.amber} />
                </td>
                <td className="py-3 px-4">
                  <FeatureCell value={feature.timeMachine} />
                </td>
                <td className="py-3 px-4">
                  <FeatureCell value={feature.carbonCopy} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6"
      >
        <Check className="w-4 h-4 text-green-500 inline mr-1" /> Full support
        <Minus className="w-4 h-4 text-amber-500 inline mx-1 ml-4" /> Partial support
        <X className="w-4 h-4 text-gray-400 inline mx-1 ml-4" /> Not supported
      </motion.p>
    </section>
  );
}
