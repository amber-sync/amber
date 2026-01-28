# Frontend Architecture & Design System Strategy (2025 Edition)

## 1. Core Philosophy: Type-Safe, Declarative, and Feature-Driven

To address the issues of "vibe coding" inconsistency and cumbersome CSS structures, we are adopting a strict, modern architecture based on **Headless UI principles**, **Tailwind CSS**, and **Class Variance Authority (CVA)**.

### Key Principles
1.  **DRY via Composition, Not Inheritance**: Use `cva` to define component variants (size, intent, state) in a single place.
2.  **Strict Feature Separation**: Move from a generic `components/` dump to a `features/` directory structure.
    *   `src/components/ui`: **Dumb**, domain-agnostic primitives (Button, Card, Input).
    *   `src/features/<domain>`: **Smart**, domain-specific logic and composition (JobCard, SettingsForm).
3.  **Token-Driven Design**: All styles must map to the existing CSS variables defined in `tokens.css`. No hardcoded hex values or arbitrary pixels.

## 2. Directory Structure

We will migrate to the following structure:

```text
src/
├── features/                 # Domain-specific modules
│   ├── jobs/                 # Job management feature
│   │   ├── components/       # Job-specific components (JobCard, JobStatus)
│   │   ├── hooks/            # Job-specific hooks (useJobStatus)
│   │   └── types.ts
│   ├── navigation/           # Navigation feature
│   └── theme/                # Theme management
├── components/
│   └── ui/                   # SHARED PRIMITIVES (The "Design System")
│       ├── Button.tsx        # Refactored with CVA
│       ├── Typography.tsx    # New unified typography component
│       ├── Card.tsx
│       └── ...
├── lib/                      # Utilities
│   └── utils.ts              # cn() helper (clsx + tailwind-merge)
└── styles/                   # Global design tokens (Keep existing)
    ├── tokens.css
    └── typography.css
```

## 3. The Component Pattern (The "Expert" Way)

Every UI primitive must follow this pattern to ensure consistency and type safety.

### The `cn()` Utility
We standardize class merging to avoid conflicts.

```ts
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### The CVA Component
Instead of manual string concatenation, we use `cva`.

```tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
```

## 4. Typography Strategy

We will move away from applying raw classes like `.text-heading-1` directly in features. Instead, we will use a `Typography` component or specific semantic components that enforce the design system.

```tsx
// Example usage
<Typography variant="h1">Page Title</Typography>
<Typography variant="body" className="text-muted-foreground">Description...</Typography>
```

## 5. Action Plan

1.  [x] Install `class-variance-authority`.
2.  [ ] Create `src/lib/utils.ts` for the `cn` helper.
3.  [ ] Refactor `src/components/ui/Button.tsx` to use CVA.
4.  [ ] Refactor `src/components/ui/Badge.tsx` (and others) to use CVA.
5.  [ ] Audit `src/features` and migrate generic components to `src/components/ui`.
