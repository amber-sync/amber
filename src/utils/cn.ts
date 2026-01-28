/**
 * TIM-210: Utility for merging Tailwind CSS classes
 *
 * Combines clsx for conditional class handling with tailwind-merge
 * to properly handle Tailwind class conflicts.
 *
 * @example
 * // Conditional classes
 * cn('base-class', isActive && 'active-class', variant === 'large' && 'text-lg')
 *
 * // Overriding Tailwind classes
 * cn('px-4 py-2', 'px-8') // Returns 'py-2 px-8'
 *
 * // Array syntax
 * cn(['class1', 'class2'], isDisabled && 'opacity-50')
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind conflict resolution
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export default cn;
