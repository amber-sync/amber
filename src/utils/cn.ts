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

/**
 * Create a set of variants for a component
 * Simplified version of CVA (class-variance-authority)
 *
 * @example
 * const buttonVariants = createVariants({
 *   base: 'px-4 py-2 rounded font-medium',
 *   variants: {
 *     variant: {
 *       primary: 'bg-accent-primary text-white',
 *       secondary: 'bg-layer-2 text-text-primary',
 *     },
 *     size: {
 *       sm: 'text-sm px-2 py-1',
 *       md: 'text-base px-4 py-2',
 *       lg: 'text-lg px-6 py-3',
 *     },
 *   },
 *   defaultVariants: {
 *     variant: 'primary',
 *     size: 'md',
 *   },
 * });
 *
 * // Usage:
 * buttonVariants({ variant: 'secondary', size: 'lg' })
 */
export interface VariantConfig<T extends Record<string, Record<string, string>>> {
  base?: string;
  variants: T;
  defaultVariants?: { [K in keyof T]?: keyof T[K] };
}

export function createVariants<T extends Record<string, Record<string, string>>>(
  config: VariantConfig<T>
): (options?: { [K in keyof T]?: keyof T[K] }) => string {
  return (options = {}) => {
    const classes: string[] = [];

    if (config.base) {
      classes.push(config.base);
    }

    for (const [key, values] of Object.entries(config.variants)) {
      const variantKey = options[key as keyof T] ?? config.defaultVariants?.[key as keyof T];
      if (variantKey && typeof variantKey === 'string') {
        const variantValue = values[variantKey];
        if (variantValue) {
          classes.push(variantValue);
        }
      }
    }

    return cn(...classes);
  };
}

export default cn;
