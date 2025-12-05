# Typography System Architecture

Visual architecture and data flow for the Amber typography system.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                             │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Dashboard   │  │  Job Editor  │  │   Settings   │             │
│  │  Component   │  │  Component   │  │  Component   │   ...more   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                  │                  │                      │
└─────────┼──────────────────┼──────────────────┼──────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TYPOGRAPHY LAYER (3 Patterns)                     │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  React Pattern   │  │  Utility Pattern │  │   CSS Pattern   │  │
│  ├──────────────────┤  ├──────────────────┤  ├─────────────────┤  │
│  │ <Heading1>       │  │ .text-page-title │  │ .text-heading-1 │  │
│  │ <Body>           │  │ .text-form-label │  │ .text-body      │  │
│  │ <FormLabel>      │  │ .text-file-path  │  │ .text-label     │  │
│  │ ...              │  │ ...              │  │ ...             │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬────────┘  │
│           │                     │                      │            │
│           └─────────────────────┼──────────────────────┘            │
│                                 │                                   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         TOKEN LAYER                                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  CSS Custom Properties (Design Tokens)                       │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  --typo-heading-1-size: 1.75rem;                             │  │
│  │  --typo-heading-1-line-height: 1.2;                          │  │
│  │  --typo-heading-1-weight: 700;                               │  │
│  │  --typo-heading-1-letter-spacing: -0.015em;                  │  │
│  │  --typo-heading-1-family: var(--font-display);               │  │
│  │  ...                                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FOUNDATION LAYER                                │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Font Files  │  │    Colors    │  │   Spacing    │             │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤             │
│  │ Plus Jakarta │  │ --text-      │  │ --space-*    │             │
│  │ DM Sans      │  │   primary    │  │ 8px grid     │             │
│  │ JetBrains    │  │ --text-      │  │              │             │
│  │ Mono         │  │   secondary  │  │              │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Token → Class → Component Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. DEFINE TOKENS (typography.css)                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  :root {                                                             │
│    --typo-heading-1-size: 1.75rem;                                  │
│    --typo-heading-1-line-height: 1.2;                               │
│    --typo-heading-1-weight: 700;                                    │
│    --typo-heading-1-letter-spacing: -0.015em;                       │
│    --typo-heading-1-family: var(--font-display);                    │
│  }                                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. CREATE SEMANTIC CLASSES (typography.css)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  .text-heading-1 {                                                  │
│    font-family: var(--typo-heading-1-family);                       │
│    font-size: var(--typo-heading-1-size);                           │
│    font-weight: var(--typo-heading-1-weight);                       │
│    line-height: var(--typo-heading-1-line-height);                  │
│    letter-spacing: var(--typo-heading-1-letter-spacing);            │
│    color: var(--text-primary);                                      │
│  }                                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. BUILD REACT COMPONENTS (Text.tsx)                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  export const Heading1 = (props) => (                               │
│    <Text variant="heading-1" {...props} />                          │
│  );                                                                  │
│                                                                      │
│  // Internal mapping:                                               │
│  variantToClass = {                                                 │
│    'heading-1': 'text-heading-1'                                    │
│  }                                                                   │
│                                                                      │
│  variantToElement = {                                               │
│    'heading-1': 'h1'                                                │
│  }                                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. USE IN APPLICATION                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  // Option A: React component                                       │
│  <Heading1>Dashboard</Heading1>                                     │
│                                                                      │
│  // Option B: CSS class                                             │
│  <h1 className="text-heading-1">Dashboard</h1>                      │
│                                                                      │
│  // Option C: Utility class                                         │
│  <h1 className="text-page-title">Dashboard</h1>                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

### React Component Tree

```
Text (Base Component)
├── variant: TypographyVariant
├── color: TextColor
├── weight: TextWeight
├── as: TextElement
└── ...props

Convenience Components (Specific Variants)
├── Display
├── Heading1
├── Heading2
├── Heading3
├── Heading4
├── Body
│   ├── BodyLarge
│   └── BodySmall
├── Label
│   └── LabelNormal
├── Caption
│   └── CaptionSmall
├── Code
│   └── CodeSmall
├── UIText
│   └── UITextSmall
└── BadgeText

Specialized Components (Common Patterns)
├── PageTitle (= Heading1 + color="primary")
├── SectionTitle (= Heading2 + color="primary")
├── CardTitle (= Heading3 + color="primary")
├── FormLabel (= Label + color="secondary" + as="label")
├── HelpText (= Caption + color="tertiary")
├── FilePath (= Code + color="secondary" + truncate)
├── Timestamp (= Caption + color="quaternary" + as="time")
├── ErrorMessage (= BodySmall + color="error")
├── SuccessMessage (= BodySmall + color="success")
└── WarningMessage (= BodySmall + color="warning")
```

---

## Typography Scale Visualization

```
Display     ████████████████████████████  40px  Bold    -0.020em

Heading 1   ████████████████████████      28px  Bold    -0.015em

Heading 2   ██████████████████            24px  Semibold -0.010em

Heading 3   ████████████████              20px  Semibold -0.005em

Heading 4   ██████████████                18px  Semibold  0.000em

Body Large  ████████████                  16px  Normal    0.000em

Body        ███████████                   14px  Normal    0.000em

Body Small  ██████████                    13px  Normal    0.000em

Label       ████████                      12px  Semibold  0.030em

Caption     ███████                       11px  Normal    0.010em

Caption Sm  ██████                        10px  Normal    0.010em
```

---

## File Structure

```
amber/
├── src/
│   ├── components/
│   │   └── ui/
│   │       └── Text.tsx                    # React components
│   │
│   ├── styles/
│   │   ├── tokens.css                      # Base design tokens
│   │   ├── typography.css                  # Typography tokens + classes
│   │   ├── typography-utilities.css        # Utility classes
│   │   └── pages.css                       # Page-specific styles
│   │
│   └── index.css                           # CSS entry point
│
└── docs/
    ├── Typography-System-Specification.md  # Full specification
    ├── Typography-Quick-Reference.md       # Cheat sheet
    ├── Typography-System-Summary.md        # Implementation summary
    └── Typography-Architecture.md          # This file
```

---

## Token Naming Convention

```
Pattern: --typo-{variant}-{property}

Examples:
  --typo-heading-1-size
  --typo-heading-1-line-height
  --typo-heading-1-weight
  --typo-heading-1-letter-spacing
  --typo-heading-1-family

  --typo-body-size
  --typo-body-line-height
  --typo-body-weight
  --typo-body-letter-spacing
  --typo-body-family
```

---

## Class Naming Convention

```
Pattern: .text-{variant}

Semantic Classes:
  .text-display
  .text-heading-1
  .text-heading-2
  .text-heading-3
  .text-heading-4
  .text-body
  .text-body-lg
  .text-body-sm
  .text-label
  .text-label-normal
  .text-caption
  .text-caption-sm
  .text-code
  .text-code-sm
  .text-ui
  .text-ui-sm
  .text-badge

Utility Classes:
  .text-page-title
  .text-section-title
  .text-card-title
  .text-form-label
  .text-help
  .text-file-path
  .text-timestamp
```

---

## Theme Integration

```
┌────────────────────────────────────────────────────────────┐
│  Theme Context                                             │
│  ┌──────────────┐         ┌──────────────┐                │
│  │ Light Theme  │         │  Dark Theme  │                │
│  ├──────────────┤         ├──────────────┤                │
│  │ --text-      │         │ --text-      │                │
│  │   primary:   │         │   primary:   │                │
│  │   #18181b    │         │   #fafafa    │                │
│  │              │         │              │                │
│  │ --text-      │         │ --text-      │                │
│  │   secondary: │         │   secondary: │                │
│  │   #52525b    │         │   #a1a1aa    │                │
│  └──────────────┘         └──────────────┘                │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│  Typography System                                         │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  .text-heading-1 {                                   │ │
│  │    /* ... size, weight, spacing ... */               │ │
│  │    color: var(--text-primary);  ← Uses theme color   │ │
│  │  }                                                    │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│  Rendered Component                                        │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  <h1 class="text-heading-1">                         │ │
│  │    Dashboard                                          │ │
│  │  </h1>                                                │ │
│  │                                                       │ │
│  │  Automatically adapts to light/dark theme!           │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## Responsive Behavior

```
Desktop (Default)              Small Window (<768px)
┌──────────────────┐          ┌──────────────────┐
│ Display: 40px    │    →     │ Display: 32px    │
│ Heading 1: 28px  │    →     │ Heading 1: 24px  │
│ Heading 2: 24px  │    →     │ Heading 2: 20px  │
│ Heading 3: 20px  │    →     │ Heading 3: 18px  │
│ Body: 14px       │    →     │ Body: 14px       │
│ Caption: 11px    │    →     │ Caption: 11px    │
└──────────────────┘          └──────────────────┘

Media query automatically scales headings down
while maintaining body text and UI sizes.
```

---

## Type Safety Flow

```
TypeScript Types (Text.tsx)
  ↓
┌────────────────────────────────────────┐
│ type TypographyVariant =               │
│   | 'display'                          │
│   | 'heading-1'                        │
│   | 'body'                             │
│   | ...                                │
└────────────────────────────────────────┘
  ↓
┌────────────────────────────────────────┐
│ interface TextProps {                  │
│   variant?: TypographyVariant;         │
│   color?: TextColor;                   │
│   weight?: TextWeight;                 │
│   ...                                  │
│ }                                      │
└────────────────────────────────────────┘
  ↓
┌────────────────────────────────────────┐
│ Usage with Autocomplete:               │
│                                        │
│ <Text variant="[autocomplete]" />     │
│            ↑                           │
│   IDE shows all 16 variants           │
│   TypeScript catches typos            │
└────────────────────────────────────────┘
```

---

## Performance Characteristics

### CSS Loading
```
Initial Page Load
  ↓
Load tokens.css (8KB)
  ↓
Load typography.css (8KB)
  ↓
Load typography-utilities.css (5KB)
  ↓
Apply to DOM (instant, CSS-only)
```

### Theme Switching
```
User clicks theme toggle
  ↓
JavaScript updates <html> class
  ↓
CSS custom properties update (instant)
  ↓
All typography re-colors automatically
  ↓
No JavaScript re-rendering needed
```

### Component Rendering
```
<Heading1>Text</Heading1>
  ↓
React creates <h1> element
  ↓
Applies className="text-heading-1"
  ↓
Browser applies CSS (GPU accelerated)
  ↓
Renders in 1 paint cycle
```

---

## Accessibility Flow

```
Developer writes code:
  <FormLabel htmlFor="name">Job Name</FormLabel>
  <input id="name" />
                ↓
Component renders semantic HTML:
  <label class="text-label" for="name">Job Name</label>
  <input id="name" />
                ↓
Screen reader announces:
  "Job Name, edit text"
                ↓
User can navigate and edit with confidence
```

---

## Decision Tree: Which Pattern to Use?

```
Start: Need to add text?
  │
  ├─→ Is this TypeScript/React?
  │   └─→ YES: Use React components
  │       └─→ <Heading1>, <Body>, etc.
  │
  └─→ Is this HTML/CSS only?
      └─→ YES: Use CSS classes
          └─→ .text-heading-1, .text-body, etc.

Need common pattern?
  │
  └─→ Use specialized component
      ├─→ Page title? → <PageTitle>
      ├─→ Form label? → <FormLabel>
      ├─→ File path? → <FilePath>
      └─→ Timestamp? → <Timestamp>

Need custom styling?
  │
  └─→ Use base <Text> with props
      └─→ <Text variant="body" color="error" weight="bold">
```

---

## Extension Points

### Adding New Variant

```
1. Define tokens (typography.css)
   ↓
2. Create class (typography.css)
   ↓
3. Add TypeScript type (Text.tsx)
   ↓
4. Add to variant mappings (Text.tsx)
   ↓
5. Create convenience component (Text.tsx)
   ↓
6. Document usage (documentation)
```

### Custom Theme

```
1. Override tokens in :root or .theme-custom
   --typo-heading-1-size: 2rem;
   ↓
2. All components automatically use new size
   ↓
3. No component changes needed
```

---

**Last Updated:** December 5, 2024
**Version:** 1.0.0
