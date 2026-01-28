"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "How is Amber different from Time Machine?",
    answer:
      "While both use incremental backups with hard links, Amber offers more flexibility. You can create multiple backup jobs to different destinations, use custom exclude patterns, sync to remote servers via SSH, and run backups on your own schedule. Plus, Amber is open source.",
  },
  {
    question: "Is my data safe with Amber?",
    answer:
      "Absolutely. Amber never sends your data anywhere - everything stays on your devices. It uses the battle-tested rsync protocol, which has been the gold standard for file synchronization for decades. Before each sync, Amber verifies your backup destination is mounted to prevent accidental data loss.",
  },
  {
    question: "Can I restore files from a backup?",
    answer:
      "Yes! Amber includes a built-in restore wizard. You can browse through your snapshots, preview files, and restore individual files or entire folders to any location. Each snapshot appears as a complete backup, making it easy to find what you need.",
  },
  {
    question: "Does Amber work with network drives?",
    answer:
      "Yes, Amber supports local drives, network-attached storage (NAS), and remote servers via SSH. For network destinations, Amber ensures the drive is mounted before starting a backup to prevent errors.",
  },
  {
    question: "How much disk space do backups use?",
    answer:
      "Amber uses hard links for unchanged files, meaning subsequent backups only store files that have actually changed. This is the same technique Time Machine uses. In practice, your backups will use much less space than the total size of all your files.",
  },
  {
    question: "Is Amber really free?",
    answer:
      "Yes, Amber is completely free and open source. There's no trial period, no premium features, and no data collection. The source code is available on GitHub for anyone to review, modify, or contribute to.",
  },
  {
    question: "What macOS versions are supported?",
    answer:
      "Amber supports macOS 12 (Monterey) and later. It's built with Tauri and React, providing a native macOS experience while being lightweight and fast.",
  },
  {
    question: "Can I exclude certain files from backups?",
    answer:
      "Yes, Amber has a powerful exclusion system. You can exclude files by pattern (like *.log), by path, or use preset patterns for common exclusions like node_modules, .git directories, and system cache files.",
  },
];

function FAQItemComponent({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <button
        onClick={onToggle}
        className="w-full py-5 flex items-center justify-between text-left hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <span className="font-medium pr-8">{item.question}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="w-full max-w-3xl mx-auto py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl font-bold tracking-tight mb-4">Frequently Asked Questions</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Everything you need to know about Amber.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {faqs.map((faq, index) => (
          <FAQItemComponent
            key={index}
            item={faq}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex(openIndex === index ? null : index)}
          />
        ))}
      </motion.div>
    </section>
  );
}
