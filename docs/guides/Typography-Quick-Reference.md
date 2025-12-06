# Typography System - Quick Reference

A cheat sheet for using the Amber typography system.

---

## Quick Variant Reference

| Variant | Size | Use For | React Component |
|---------|------|---------|-----------------|
| `display` | 40px | App name, hero text | `<Display>` |
| `heading-1` | 28px | Page titles | `<Heading1>` |
| `heading-2` | 24px | Section headers | `<Heading2>` |
| `heading-3` | 20px | Subsection headers | `<Heading3>` |
| `heading-4` | 18px | Card headers | `<Heading4>` |
| `body` | 14px | Default paragraph text | `<Body>` |
| `body-lg` | 16px | Emphasized paragraphs | `<BodyLarge>` |
| `body-sm` | 13px | Secondary text | `<BodySmall>` |
| `label` | 12px | Form labels (uppercase) | `<Label>` |
| `label-normal` | 14px | Labels (no uppercase) | `<LabelNormal>` |
| `caption` | 11px | Timestamps, metadata | `<Caption>` |
| `caption-sm` | 10px | Very small metadata | `<CaptionSmall>` |
| `code` | 13px | File paths, code | `<Code>` |
| `code-sm` | 12px | Inline code | `<CodeSmall>` |
| `ui` | 14px | Buttons, navigation | `<UIText>` |
| `ui-sm` | 13px | Small buttons | `<UITextSmall>` |
| `badge` | 11px | Badges, status tags | `<BadgeText>` |

---

## Usage Patterns

### CSS Classes

```html
<h1 class="text-heading-1">Page Title</h1>
<p class="text-body text-secondary">Description</p>
<time class="text-caption">2 hours ago</time>
<code class="text-code">/path/to/file</code>
```

### React Components

```tsx
import { Heading1, Body, Caption, FilePath } from '@/components/ui/Text';

<Heading1>Dashboard</Heading1>
<Body color="secondary">Welcome message</Body>
<Caption>Last updated 2 hours ago</Caption>
<FilePath>/Users/name/Documents</FilePath>
```

### Base Text Component

```tsx
import { Text } from '@/components/ui/Text';

// Basic usage
<Text variant="body">Default text</Text>

// With color
<Text variant="body" color="secondary">Muted text</Text>

// With weight override
<Text variant="body" weight="semibold">Bold text</Text>

// Custom HTML element
<Text variant="caption" as="time">2024-12-05</Text>

// Truncation
<Text variant="code" truncate>/very/long/path</Text>

// Multi-line clamp
<Text variant="body" clamp={3}>Long text...</Text>
```

---

## Color Modifiers

| Color | CSS Class | React Prop | Use For |
|-------|-----------|------------|---------|
| Primary | `.text-primary` | `color="primary"` | Main content |
| Secondary | `.text-secondary` | `color="secondary"` | Less important |
| Tertiary | `.text-tertiary` | `color="tertiary"` | Muted text |
| Quaternary | `.text-quaternary` | `color="quaternary"` | Very subtle |
| Success | `.text-success` | `color="success"` | Success messages |
| Warning | `.text-warning` | `color="warning"` | Warning messages |
| Error | `.text-error` | `color="error"` | Error messages |
| Info | `.text-info` | `color="info"` | Info messages |

---

## Weight Modifiers

| Weight | CSS Class | React Prop |
|--------|-----------|------------|
| Normal | `.font-weight-normal` | `weight="normal"` |
| Medium | `.font-weight-medium` | `weight="medium"` |
| Semibold | `.font-weight-semibold` | `weight="semibold"` |
| Bold | `.font-weight-bold` | `weight="bold"` |

---

## Specialized Components

Fast access to common typography patterns:

```tsx
import {
  PageTitle,      // Heading 1, primary color
  SectionTitle,   // Heading 2, primary color
  CardTitle,      // Heading 3, primary color
  FormLabel,      // Label, secondary color
  HelpText,       // Caption, tertiary color
  FilePath,       // Code, truncated
  Timestamp,      // Caption, quaternary color
  ErrorMessage,   // Body small, error color
  SuccessMessage, // Body small, success color
  WarningMessage, // Body small, warning color
} from '@/components/ui/Text';
```

---

## Common Layouts

### Page Header

```tsx
<div className="mb-8">
  <PageTitle>Dashboard</PageTitle>
  <HelpText className="mt-2">
    Manage your backup jobs
  </HelpText>
</div>
```

### Section

```tsx
<section className="mb-6">
  <SectionTitle className="mb-4">Active Jobs</SectionTitle>
  {/* Content */}
</section>
```

### Card

```tsx
<div className="card">
  <CardTitle>Job Details</CardTitle>
  <Body className="mt-2">Description text</Body>
  <FilePath className="mt-2">/path/to/source</FilePath>
  <Timestamp className="mt-1">2 hours ago</Timestamp>
</div>
```

### Form Field

```tsx
<div>
  <FormLabel htmlFor="name">Job Name</FormLabel>
  <input id="name" type="text" />
  <HelpText className="mt-1">Enter a unique name</HelpText>
</div>
```

### Table

```tsx
<table>
  <thead>
    <tr>
      <th className="text-label text-tertiary">Name</th>
      <th className="text-label text-tertiary">Size</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><Body>file.txt</Body></td>
      <td><BodySmall color="secondary">2.4 MB</BodySmall></td>
    </tr>
  </tbody>
</table>
```

---

## CSS Custom Properties

Direct token access for advanced use cases:

```css
.custom-text {
  font-family: var(--typo-body-family);
  font-size: var(--typo-body-size);
  font-weight: var(--typo-body-weight);
  line-height: var(--typo-body-line-height);
  letter-spacing: var(--typo-body-letter-spacing);
}
```

### Available Tokens

Each variant has:
- `--typo-{variant}-size`
- `--typo-{variant}-line-height`
- `--typo-{variant}-weight`
- `--typo-{variant}-letter-spacing`
- `--typo-{variant}-family`

Example: `--typo-heading-1-size`, `--typo-body-weight`, etc.

---

## Accessibility Checklist

- ✅ Use semantic HTML elements (h1, h2, label, etc.)
- ✅ Maintain heading hierarchy (h1 → h2 → h3)
- ✅ Ensure 4.5:1 contrast for body text
- ✅ Use rem units (already built-in)
- ✅ Associate labels with inputs
- ✅ Use meaningful text content

---

## Migration Examples

### Before

```tsx
<h1 className="text-xl font-bold text-text-primary">Title</h1>
<p className="text-sm text-text-secondary">Description</p>
<span className="text-2xs text-text-tertiary">Metadata</span>
<code className="font-mono text-xs">/path/to/file</code>
```

### After

```tsx
<Heading1>Title</Heading1>
<BodySmall color="secondary">Description</BodySmall>
<Caption>Metadata</Caption>
<FilePath>/path/to/file</FilePath>
```

---

## Files

- **CSS Tokens:** `/src/styles/typography.css`
- **Utilities:** `/src/styles/typography-utilities.css`
- **React:** `/src/components/ui/Text.tsx`
- **Full Spec:** `/docs/Typography-System-Specification.md`

---

## Decision Tree

**"What typography should I use?"**

1. **Is it a page title?** → `<PageTitle>` or `<Heading1>`
2. **Is it a section header?** → `<SectionTitle>` or `<Heading2>`
3. **Is it a card header?** → `<CardTitle>` or `<Heading3>`
4. **Is it a form label?** → `<FormLabel>` or `<Label>`
5. **Is it a file path?** → `<FilePath>` or `<Code>`
6. **Is it a timestamp?** → `<Timestamp>` or `<Caption>`
7. **Is it a button?** → `<UIText>` or `text-ui`
8. **Is it a badge/tag?** → `<BadgeText>` or `text-badge`
9. **Is it body text?** → `<Body>` or `text-body`
10. **Is it metadata?** → `<Caption>` or `text-caption`

---

**Last Updated:** December 5, 2024
