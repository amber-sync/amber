# Amber Typography System Specification

A comprehensive, semantic typography system for the Amber desktop application built with Tauri and React.

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Typography Scale](#typography-scale)
4. [Implementation](#implementation)
5. [Usage Guide](#usage-guide)
6. [Accessibility](#accessibility)
7. [Examples](#examples)

---

## Overview

The Amber typography system provides a consistent, accessible, and maintainable approach to text rendering across the application. It uses:

- **CSS Custom Properties** for easy theming and customization
- **Semantic naming** for clear intent and maintainability
- **rem-based sizing** for accessibility (respects user font preferences)
- **Tailwind integration** for convenient utility classes
- **React components** for type-safe, consistent usage

---

## Design Principles

### 1. Semantic Over Presentational

Use semantic names that describe **purpose**, not appearance:

- ✅ `text-heading-1`, `text-caption`, `text-label`
- ❌ `text-20px`, `text-gray-600`, `text-bold-14`

### 2. Accessibility First

- Minimum font size: 11px (0.6875rem) for maximum legibility
- Contrast ratios meet WCAG AA standards (4.5:1 for body text)
- rem-based sizing respects user font preferences
- Proper semantic HTML elements for screen readers

### 3. Consistent Hierarchy

Clear visual hierarchy through systematic size, weight, and spacing:

```
Display (40px) - Rare, hero moments
  ↓
Heading 1 (28px) - Page titles
  ↓
Heading 2 (24px) - Section headers
  ↓
Heading 3 (20px) - Subsections
  ↓
Heading 4 (18px) - Card headers
  ↓
Body (14px) - Default text
  ↓
Caption (11px) - Metadata
```

### 4. Performance

- CSS custom properties enable instant theme switching
- No JavaScript required for basic typography
- Minimal CSS output through shared tokens

---

## Typography Scale

### Display/Hero Text

**Purpose:** App name, major headlines, hero sections (rare use)

```css
Font Size: 2.5rem (40px)
Line Height: 1.1 (44px)
Font Weight: 700 (Bold)
Letter Spacing: -0.02em
Font Family: Plus Jakarta Sans (display font)
Color: var(--text-primary)
```

**Usage:**
```tsx
<Text variant="display">Amber Backup</Text>
```

---

### Heading 1

**Purpose:** Page titles, primary headings

```css
Font Size: 1.75rem (28px)
Line Height: 1.2 (33.6px)
Font Weight: 700 (Bold)
Letter Spacing: -0.015em
Font Family: Plus Jakarta Sans
Color: var(--text-primary)
```

**Usage:**
```tsx
<Text variant="heading-1">Dashboard</Text>
<Heading1>Backup Jobs</Heading1>
```

---

### Heading 2

**Purpose:** Section headers, secondary headings

```css
Font Size: 1.5rem (24px)
Line Height: 1.25 (30px)
Font Weight: 600 (Semibold)
Letter Spacing: -0.01em
Font Family: Plus Jakarta Sans
Color: var(--text-primary)
```

**Usage:**
```tsx
<Text variant="heading-2">Recent Activity</Text>
<Heading2>Settings</Heading2>
```

---

### Heading 3

**Purpose:** Subsection headers, card titles

```css
Font Size: 1.25rem (20px)
Line Height: 1.3 (26px)
Font Weight: 600 (Semibold)
Letter Spacing: -0.005em
Font Family: Plus Jakarta Sans
Color: var(--text-primary)
```

**Usage:**
```tsx
<Text variant="heading-3">Job Configuration</Text>
<CardTitle>Backup Details</CardTitle>
```

---

### Heading 4

**Purpose:** Tertiary headings, emphasized sections

```css
Font Size: 1.125rem (18px)
Line Height: 1.35 (24.3px)
Font Weight: 600 (Semibold)
Letter Spacing: 0em
Font Family: DM Sans
Color: var(--text-primary)
```

**Usage:**
```tsx
<Text variant="heading-4">Source Directory</Text>
<Heading4>Advanced Options</Heading4>
```

---

### Body

**Purpose:** Default paragraph text, primary content

```css
Font Size: 0.875rem (14px)
Line Height: 1.5 (21px)
Font Weight: 400 (Normal)
Letter Spacing: 0em
Font Family: DM Sans
Color: var(--text-primary)
```

**Usage:**
```tsx
<Text variant="body">This is the default paragraph text.</Text>
<Body>Configure your backup settings here.</Body>
```

---

### Body Large

**Purpose:** Emphasized paragraph text, introductions

```css
Font Size: 1rem (16px)
Line Height: 1.5 (24px)
Font Weight: 400 (Normal)
Letter Spacing: 0em
Font Family: DM Sans
Color: var(--text-primary)
```

**Usage:**
```tsx
<Text variant="body-lg">Important information goes here.</Text>
<BodyLarge>Welcome to Amber Backup.</BodyLarge>
```

---

### Body Small

**Purpose:** De-emphasized text, descriptions, secondary content

```css
Font Size: 0.8125rem (13px)
Line Height: 1.5 (19.5px)
Font Weight: 400 (Normal)
Letter Spacing: 0em
Font Family: DM Sans
Color: var(--text-secondary)
```

**Usage:**
```tsx
<Text variant="body-sm">Additional details and notes.</Text>
<BodySmall color="tertiary">Optional information</BodySmall>
```

---

### Label (Uppercase)

**Purpose:** Form labels, section labels, field headers

```css
Font Size: 0.75rem (12px)
Line Height: 1.4 (16.8px)
Font Weight: 600 (Semibold)
Letter Spacing: 0.03em
Text Transform: uppercase
Font Family: DM Sans
Color: var(--text-secondary)
```

**Usage:**
```tsx
<Text variant="label">Source Directory</Text>
<FormLabel htmlFor="name">Job Name</FormLabel>
```

---

### Label Normal (No Transform)

**Purpose:** Labels without uppercase transformation

```css
Font Size: 0.875rem (14px)
Line Height: 1.4 (19.6px)
Font Weight: 500 (Medium)
Letter Spacing: 0em
Font Family: DM Sans
Color: var(--text-secondary)
```

**Usage:**
```tsx
<Text variant="label-normal">Backup frequency</Text>
<LabelNormal>Select a destination</LabelNormal>
```

---

### Caption

**Purpose:** Timestamps, metadata, helper text

```css
Font Size: 0.6875rem (11px)
Line Height: 1.4 (15.4px)
Font Weight: 400 (Normal)
Letter Spacing: 0.01em
Font Family: DM Sans
Color: var(--text-tertiary)
```

**Usage:**
```tsx
<Text variant="caption">Last backup: 2 hours ago</Text>
<Timestamp>2024-12-05 14:30</Timestamp>
```

---

### Caption Small

**Purpose:** Very small metadata, fine print

```css
Font Size: 0.625rem (10px)
Line Height: 1.4 (14px)
Font Weight: 400 (Normal)
Letter Spacing: 0.01em
Font Family: DM Sans
Color: var(--text-tertiary)
```

**Usage:**
```tsx
<Text variant="caption-sm">Version 1.0.0</Text>
<CaptionSmall>Updated 5 minutes ago</CaptionSmall>
```

---

### Code/Mono

**Purpose:** File paths, technical data, code snippets

```css
Font Size: 0.8125rem (13px)
Line Height: 1.5 (19.5px)
Font Weight: 400 (Normal)
Letter Spacing: 0em
Font Family: JetBrains Mono (monospace)
Color: var(--text-primary)
```

**Usage:**
```tsx
<Text variant="code">/Users/name/Documents</Text>
<FilePath>/path/to/backup/destination</FilePath>
```

---

### Code Small

**Purpose:** Inline code, small technical text

```css
Font Size: 0.75rem (12px)
Line Height: 1.5 (18px)
Font Weight: 400 (Normal)
Letter Spacing: 0em
Font Family: JetBrains Mono
Color: var(--text-secondary)
```

**Usage:**
```tsx
<Text variant="code-sm">rsync -av</Text>
<CodeSmall>--exclude=*.tmp</CodeSmall>
```

---

### UI Text

**Purpose:** Buttons, navigation, menu items, interactive elements

```css
Font Size: 0.875rem (14px)
Line Height: 1.3 (18.2px)
Font Weight: 500 (Medium)
Letter Spacing: 0.005em
Font Family: DM Sans
Color: var(--text-primary)
```

**Usage:**
```tsx
<Text variant="ui">Save Changes</Text>
<UIText>Create New Job</UIText>
```

---

### UI Small

**Purpose:** Small buttons, compact UI elements

```css
Font Size: 0.8125rem (13px)
Line Height: 1.3 (16.9px)
Font Weight: 500 (Medium)
Letter Spacing: 0.005em
Font Family: DM Sans
Color: var(--text-primary)
```

**Usage:**
```tsx
<Text variant="ui-sm">Cancel</Text>
<UITextSmall>Edit</UITextSmall>
```

---

### Badge

**Purpose:** Badges, tags, status indicators, counts

```css
Font Size: 0.6875rem (11px)
Line Height: 1.2 (13.2px)
Font Weight: 600 (Semibold)
Letter Spacing: 0.02em
Text Transform: uppercase
Font Family: DM Sans
```

**Usage:**
```tsx
<Text variant="badge">Active</Text>
<BadgeText>New</BadgeText>
```

---

## Implementation

### 1. CSS Custom Properties

All typography tokens are defined as CSS custom properties in `/src/styles/typography.css`:

```css
:root {
  --typo-body-size: 0.875rem;
  --typo-body-line-height: 1.5;
  --typo-body-weight: 400;
  --typo-body-letter-spacing: 0em;
  --typo-body-family: var(--font-sans);
}
```

### 2. CSS Classes

Semantic classes apply complete typography styles:

```css
.text-body {
  font-family: var(--typo-body-family);
  font-size: var(--typo-body-size);
  font-weight: var(--typo-body-weight);
  line-height: var(--typo-body-line-height);
  letter-spacing: var(--typo-body-letter-spacing);
  color: var(--text-primary);
}
```

### 3. Tailwind Integration

Import typography styles in your CSS entry point:

```css
@import './styles/tokens.css';
@import './styles/typography.css';
@import './styles/typography-utilities.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 4. React Components

Type-safe components with variant props:

```tsx
import { Text, Heading1, Body, Caption } from '@/components/ui/Text';

function MyComponent() {
  return (
    <div>
      <Heading1>Page Title</Heading1>
      <Body color="secondary">Description text</Body>
      <Caption>Metadata</Caption>
    </div>
  );
}
```

---

## Usage Guide

### CSS Classes

```html
<!-- Using semantic classes directly -->
<h1 class="text-heading-1">Dashboard</h1>
<p class="text-body text-secondary">Welcome message</p>
<time class="text-caption">2 hours ago</time>
```

### Tailwind Utilities

```html
<!-- Combined with Tailwind utilities -->
<h2 class="text-heading-2 mb-4">Section Title</h2>
<p class="text-body-sm text-tertiary mt-2">Helper text</p>
```

### React Components

```tsx
// Basic usage
<Text variant="heading-1">Dashboard</Text>

// With color modifier
<Text variant="body" color="secondary">Description</Text>

// With weight override
<Text variant="body" weight="semibold">Important text</Text>

// Custom HTML element
<Text variant="caption" as="time">2024-12-05</Text>

// With truncation
<Text variant="code" truncate>/very/long/path/to/file</Text>

// Multi-line clamp
<Text variant="body" clamp={3}>
  Long text that will be truncated after 3 lines...
</Text>
```

### Convenience Components

```tsx
// Specialized components for common patterns
<PageTitle>Dashboard</PageTitle>
<SectionTitle>Recent Jobs</SectionTitle>
<CardTitle>Backup Details</CardTitle>
<FormLabel htmlFor="name">Job Name</FormLabel>
<HelpText>Enter a unique name</HelpText>
<FilePath>/Users/name/Documents</FilePath>
<Timestamp>2 hours ago</Timestamp>
<ErrorMessage>Invalid input</ErrorMessage>
<SuccessMessage>Saved successfully</SuccessMessage>
```

---

## Accessibility

### WCAG Compliance

All typography meets WCAG AA standards:

- **Normal text** (< 18px): 4.5:1 contrast ratio minimum
- **Large text** (≥ 18px or ≥ 14px bold): 3:1 contrast ratio minimum
- **UI components**: 3:1 contrast ratio minimum

### Font Sizing

- All sizes use `rem` units to respect user font preferences
- Minimum font size: 11px (0.6875rem) for readability
- Line heights ensure comfortable reading on desktop displays

### Semantic HTML

Use appropriate HTML elements:

```tsx
// ✅ Good - Semantic HTML
<Heading1>Page Title</Heading1>        // Renders as <h1>
<FormLabel htmlFor="name">Name</FormLabel>  // Renders as <label>
<Timestamp>2 hours ago</Timestamp>     // Renders as <time>

// ❌ Avoid - Non-semantic
<Text variant="heading-1" as="div">Title</Text>
<Text variant="label" as="span">Name</Text>
```

### Screen Readers

The typography system maintains semantic structure for screen readers:

- Heading hierarchy (h1 → h2 → h3)
- Proper label associations
- Meaningful text content

---

## Examples

### Page Layout

```tsx
function DashboardPage() {
  return (
    <div className="p-6">
      <PageTitle>Dashboard</PageTitle>
      <HelpText className="mt-2">
        Manage your backup jobs and view recent activity
      </HelpText>

      <SectionTitle className="mt-8 mb-4">Active Jobs</SectionTitle>

      <div className="card">
        <CardTitle>Documents Backup</CardTitle>
        <Body className="mt-2">
          Daily backup of your documents folder to cloud storage
        </Body>
        <FilePath className="mt-2">/Users/name/Documents</FilePath>
        <Timestamp className="mt-1">Last run: 2 hours ago</Timestamp>
      </div>
    </div>
  );
}
```

### Form

```tsx
function BackupForm() {
  return (
    <form>
      <FormLabel htmlFor="jobName">Job Name</FormLabel>
      <input id="jobName" type="text" />
      <HelpText className="mt-1">
        Enter a unique name to identify this backup job
      </HelpText>

      <FormLabel htmlFor="source" className="mt-4">
        Source Directory
      </FormLabel>
      <input id="source" type="text" />
      <ErrorMessage className="mt-1">
        Please select a valid directory
      </ErrorMessage>

      <button className="mt-6">
        <UIText>Create Backup Job</UIText>
      </button>
    </form>
  );
}
```

### Card Component

```tsx
function JobCard({ job }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <CardTitle>{job.name}</CardTitle>
        <BadgeText className="px-2 py-1 bg-success-subtle text-success">
          {job.status}
        </BadgeText>
      </div>

      <BodySmall color="secondary" className="mt-2">
        {job.description}
      </BodySmall>

      <div className="mt-4 space-y-1">
        <div className="flex items-center gap-2">
          <Label>Source</Label>
          <FilePath>{job.source}</FilePath>
        </div>
        <div className="flex items-center gap-2">
          <Label>Destination</Label>
          <FilePath>{job.destination}</FilePath>
        </div>
      </div>

      <Caption className="mt-4">
        Last backup: {formatTimestamp(job.lastRun)}
      </Caption>
    </div>
  );
}
```

### Table

```tsx
function FileTable({ files }) {
  return (
    <table>
      <thead>
        <tr>
          <th className="text-label text-tertiary">Name</th>
          <th className="text-label text-tertiary">Size</th>
          <th className="text-label text-tertiary">Modified</th>
        </tr>
      </thead>
      <tbody>
        {files.map(file => (
          <tr key={file.id}>
            <td>
              <Body>{file.name}</Body>
            </td>
            <td>
              <BodySmall color="secondary">
                {formatFileSize(file.size)}
              </BodySmall>
            </td>
            <td>
              <Caption>{formatDate(file.modified)}</Caption>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## Color Modifiers

Use semantic color tokens for text color:

```tsx
<Text variant="body" color="primary">Default text</Text>
<Text variant="body" color="secondary">Less prominent</Text>
<Text variant="body" color="tertiary">Muted text</Text>
<Text variant="body" color="quaternary">Very subtle</Text>
<Text variant="body" color="success">Success message</Text>
<Text variant="body" color="warning">Warning message</Text>
<Text variant="body" color="error">Error message</Text>
<Text variant="body" color="info">Info message</Text>
```

---

## Weight Modifiers

Override font weight when needed:

```tsx
<Text variant="body" weight="normal">Regular text</Text>
<Text variant="body" weight="medium">Medium weight</Text>
<Text variant="body" weight="semibold">Semibold text</Text>
<Text variant="body" weight="bold">Bold text</Text>
```

---

## Responsive Behavior

Typography automatically scales on small windows:

```css
@media (max-width: 768px) {
  :root {
    --typo-display-size: 2rem;      /* 40px → 32px */
    --typo-h1-size: 1.5rem;         /* 28px → 24px */
    --typo-h2-size: 1.25rem;        /* 24px → 20px */
    --typo-h3-size: 1.125rem;       /* 20px → 18px */
  }
}
```

---

## Best Practices

### Do's ✅

- Use semantic variants that describe purpose
- Apply color modifiers through the `color` prop
- Use convenience components for common patterns
- Maintain heading hierarchy (h1 → h2 → h3)
- Use `rem` units for all custom typography
- Test with browser zoom and user font preferences

### Don'ts ❌

- Don't use arbitrary font sizes (`text-[14px]`)
- Don't skip heading levels (h1 → h3)
- Don't use `px` units for font sizes
- Don't hardcode colors (`text-gray-600`)
- Don't use display font for body text
- Don't use monospace for UI elements

---

## Migration Guide

Replace existing typography with semantic variants:

```tsx
// Before
<h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
<p className="text-sm text-text-secondary">Description</p>
<span className="text-2xs text-text-tertiary">Metadata</span>

// After
<Heading1>Dashboard</Heading1>
<BodySmall color="secondary">Description</BodySmall>
<Caption>Metadata</Caption>
```

---

## Files

- **Tokens:** `/src/styles/typography.css`
- **Utilities:** `/src/styles/typography-utilities.css`
- **React Component:** `/src/components/ui/Text.tsx`
- **Documentation:** `/docs/Typography-System-Specification.md`

---

## Support

For questions or issues with the typography system:

1. Review this specification
2. Check existing component usage in the codebase
3. Refer to the design system tokens in `/src/styles/tokens.css`

---

**Last Updated:** December 5, 2024
**Version:** 1.0.0
