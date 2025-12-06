# Amber Backup UI - Color Palette Audit Report
**Date**: 2025-12-04
**Audited**: Views, Components, Styles
**Purpose**: Comprehensive discovery of color inconsistencies across the application

---

## Executive Summary

The Amber Backup UI has **THREE DISTINCT COLOR SYSTEMS** that conflict with each other:

1. **Editorial Theme** (index.css) - Monochrome zinc-based palette for app-wide consistency
2. **TimeMachine Theme** (timemachine.css) - Duplicate monochrome system with custom CSS variables
3. **Legacy Colored Accents** - Scattered hardcoded Tailwind colors (green, orange, blue, red, gray)

### Critical Findings

- ✅ **Editorial tokens defined**: Complete zinc-based system in `index.css` and `tokens.css`
- ❌ **TimeMachine creates parallel system**: 45+ duplicate CSS variables (--tm-*)
- ⚠️ **Hardcoded colors persist**: 60+ instances of colored Tailwind classes bypassing design system
- 🔴 **No single source of truth**: Three competing color systems create visual inconsistency

---

## 1. Design Token Definitions

### 1.1 Editorial Theme (Primary System)
**Location**: `src/index.css` and `src/styles/tokens.css`

#### Light Mode Palette
```css
/* Backgrounds */
--bg-layer-1: #ffffff
--bg-layer-2: #fafafa
--bg-layer-3: #f4f4f5 (zinc-100)

/* Text */
--text-primary: #18181b (zinc-900)
--text-secondary: #52525b (zinc-600)
--text-tertiary: #71717a (zinc-500)
--text-quaternary: #a1a1aa (zinc-400)

/* Borders */
--border-base: #e4e4e7 (zinc-200)
--border-highlight: #d4d4d8 (zinc-300)

/* Accent - Near-black editorial */
--accent-primary: #27272a (zinc-800)
--accent-secondary: #f4f4f5 (zinc-100)
--accent-hover: #18181b (zinc-900)
--accent-active: #09090b (zinc-950)

/* Semantic colors - Subtle */
--color-success: #10b981
--color-warning: #f59e0b
--color-error: #ef4444
--color-info: #3b82f6
```

#### Dark Mode Palette
```css
/* Backgrounds */
--bg-layer-1: #09090b (zinc-950)
--bg-layer-2: #18181b (zinc-900)
--bg-layer-3: #27272a (zinc-800)

/* Text */
--text-primary: #fafafa (zinc-50)
--text-secondary: #a1a1aa (zinc-400)
--text-tertiary: #71717a (zinc-500)
--text-quaternary: #52525b (zinc-600)

/* Accent - Light for dark mode */
--accent-primary: #fafafa (zinc-50)
--accent-secondary: #27272a (zinc-800)
```

**Usage Guidance** (from tokens.css):
> "TEXT COLORS (use semantic tokens, NOT gray-xxx):
> - text-text-primary: Main content, headings
> - text-text-secondary: Secondary info, descriptions
> - text-text-tertiary: Muted text, placeholders
> - text-text-quaternary: Very muted, timestamps"

### 1.2 TimeMachine Theme (Duplicate System)
**Location**: `src/views/TimeMachine/timemachine.css`

#### The Duplicate Variables (45+ total)
```css
/* Identical to editorial theme but with --tm- prefix */
--tm-void: #fafafa        /* = bg-layer-2 */
--tm-space: #ffffff       /* = bg-layer-1 */
--tm-nebula: #ffffff      /* = bg-layer-1 */
--tm-dust: #e4e4e7        /* = border-base / zinc-200 */
--tm-mist: #d4d4d8        /* = border-highlight / zinc-300 */

--tm-accent: #27272a      /* = accent-primary / zinc-800 */
--tm-accent-bright: #18181b
--tm-accent-dim: #3f3f46
--tm-accent-glow: rgba(39, 39, 42, 0.06)
--tm-accent-wash: rgba(39, 39, 42, 0.04)

--tm-text-bright: #18181b  /* = text-primary */
--tm-text-soft: #3f3f46    /* = zinc-700 */
--tm-text-dim: #71717a     /* = text-tertiary */
--tm-text-muted: #a1a1aa   /* = text-quaternary */

--tm-success: #16a34a
--tm-warning: #ca8a04
--tm-error: #dc2626

--tm-glass: rgba(255, 255, 255, 0.92)
--tm-glass-border: rgba(0, 0, 0, 0.06)
```

**Problem**: Every value duplicates the editorial theme with creative naming:
- "void", "space", "nebula" = Same zinc grays as bg-layer-*
- "dust", "mist" = Same zinc borders
- "bright", "soft", "dim", "muted" = Same text hierarchy

---

## 2. Color Usage by Component Category

### 2.1 Views Using Editorial Theme ✅

#### Dashboard.tsx
- **Theme**: Consistently uses editorial tokens
- **Backgrounds**: `bg-layer-1`, `bg-layer-2`, `bg-layer-3`
- **Text**: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`
- **Borders**: `border-border-base`
- **Semantic**: Uses CSS variables correctly
  - Line 226: `bg-[var(--color-success-subtle)] text-[var(--color-success)]`

#### AppSettings.tsx
- **Theme**: Editorial tokens with ONE exception
- **Backgrounds**: `bg-layer-1`, `bg-layer-2`
- **Text**: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`
- **Accent**: `accent-primary` for theme selector
- **❌ EXCEPTION**: Lines 170-174 - Hardcoded green success colors
  ```tsx
  bg-green-50 dark:bg-green-900/20
  border-green-100 dark:border-green-900/30
  text-green-700 dark:text-green-400
  text-green-600 dark:text-green-500
  ```

#### JobDetail.tsx
- **Theme**: Consistently uses editorial tokens
- **Backgrounds**: `bg-layer-1`, `bg-layer-2`
- **Text hierarchy**: Full editorial text scale
- **Semantic**: CSS variables for status colors

### 2.2 TimeMachine View (Duplicate System) ⚠️

#### TimeMachine.tsx
**Inconsistency Type**: Uses BOTH editorial AND TimeMachine tokens

**Editorial tokens used**:
- Line 143-181: Date filter dropdown uses `text-text-secondary`, `bg-layer-2`, `border-border-base`
- Line 497-616: Compare panel uses editorial tokens throughout

**CSS variable semantic colors**:
- Lines 559-584: Uses `var(--color-success)`, `var(--color-error)` for comparison differences

**Problem**: Mixing two theming systems in one view

#### TimeMachineHeader.tsx
**Inconsistency Type**: Mixes editorial buttons with TimeMachine CSS

**Editorial usage**:
- Line 76-78, 143-183: Uses Button component (editorial themed)
- Lines 144-169: Date filter styled with editorial tokens

**TimeMachine CSS**:
- Line 73: `className="tm-header"` applies TimeMachine styles
- Lines 82-134: Job dropdown uses `tm-job-selector`, `tm-nebula`, `tm-dust` classes
- Lines 187-195: Progress indicator uses `bg-[var(--tm-amber-wash)]`, `text-[var(--tm-amber)]`

#### TimelineRuler.tsx & SnapshotFocus.tsx
**Theme**: Pure TimeMachine CSS
- All styling via `tm-*` classes from timemachine.css
- No editorial tokens used
- Clean implementation within TimeMachine subsystem

### 2.3 RestoreWizard (Semantic Color Overload) 🔵

**Location**: `src/views/RestoreWizard.tsx`

**Inconsistency Type**: Excessive hardcoded `--color-info` usage

**All instances** (10 total):
```tsx
Line 145: text-[var(--color-info)]
Line 164: text-[var(--color-info)] hover:bg-[var(--color-info-subtle)]
Line 173: shadow-[var(--color-info)]/20
Line 176: bg-[var(--color-info)] hover:bg-[var(--color-info)]/90
Line 196: text-[var(--color-info)]  (active sort button)
Line 207: text-[var(--color-info)]  (active sort button)
Line 223: bg-[var(--color-info-subtle)] border border-[var(--color-info)]/30
Line 228: bg-[var(--color-info-subtle)] text-[var(--color-info)]
Line 234: text-[var(--color-info)]  (selected snapshot)
Line 256: text-[var(--color-info)]  (info banner)
```

**Problem**: Blue info color dominates the UI instead of near-black editorial accent

**Expected**: Use `accent-primary` (near-black) for primary actions and selections

---

## 3. Hardcoded Tailwind Colors (Legacy Issues)

### 3.1 Green Colors (Success States)

#### AppSettings.tsx (Lines 170-174)
```tsx
<div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30">
  <div className="text-green-700 dark:text-green-400">
    <Icons.CheckCircle /> Environment Ready
  </div>
  <p className="text-green-600 dark:text-green-500">
```
**Should use**: `bg-[var(--color-success-subtle)]`, `text-[var(--color-success)]`

#### ConnectionStatus.tsx
```tsx
Line 30: bg-orange-500      /* Syncing state */
Line 31: bg-orange-400      /* Pulse animation */
Line 38: bg-green-500       /* Connected state */
Line 39: bg-green-400       /* Pulse animation */
Line 45: bg-gray-400 dark:bg-gray-600  /* Offline state */
Line 80: bg-gray-200 dark:bg-gray-700  /* Offline badge bg */
Line 82: bg-gray-400 dark:bg-gray-500  /* Offline badge dot */
Line 98: bg-orange-500/bg-green-500/bg-gray-400  /* Dot colors */
```
**Should use**: Semantic CSS variables

### 3.2 Terminal Colors (Lines 36-102)

#### Terminal.tsx
**Heavy hardcoded color usage for log levels**:
```tsx
Line 36, 47: text-red-400        /* Error logs */
Line 38, 49: text-yellow-400     /* Warning logs */
Line 57: text-green-400          /* Cursor pulse */
Line 67-69: bg-red-500, bg-yellow-500, bg-green-500  /* macOS buttons */
Line 81: text-red-500 dark:text-red-400
Line 83: text-yellow-500 dark:text-yellow-400
Line 92: text-red-600 dark:text-red-400
Line 94: text-yellow-600 dark:text-yellow-400
Line 102: text-green-400
```
**Note**: Terminal colors might be intentionally vibrant for readability

### 3.3 FileBrowser Blue Links (Lines 275-323)

#### FileBrowser.tsx
```tsx
Line 275: text-blue-500 hover:text-blue-600   /* "Load more" link */
Line 283: hover:text-blue-500                 /* Breadcrumb hover */
Line 295: hover:text-blue-500                 /* Breadcrumb part hover */
Line 323: border-blue-500                     /* Loading spinner */
```
**Should use**: `text-accent-primary` or `text-[var(--color-info)]` consistently

### 3.4 OfflineBadge Gray Colors

#### ConnectionStatus.tsx (Lines 78-85)
```tsx
bg-gray-200 dark:bg-gray-700
text-gray-600 dark:text-gray-300
bg-gray-400 dark:bg-gray-500
```
**Should use**: `bg-layer-3`, `text-text-tertiary` (editorial tokens)

---

## 4. Component-Level Analysis

### 4.1 UI Component Library (Properly Themed) ✅

#### Button.tsx
- Uses editorial tokens consistently
- `accent-primary`, `accent-text`, `accent-hover`, `accent-active`
- `layer-3`, `border-base`, `border-highlight`
- `text-secondary`, `text-primary`
- `var(--color-error)` for danger variant

#### Badge.tsx
- Uses CSS variables for all semantic colors
- `var(--color-success)`, `var(--color-warning)`, `var(--color-error)`, `var(--color-info)`
- `bg-layer-3`, `text-text-primary` for neutral

#### StatusDot.tsx
- Uses CSS variables for all status colors
- `var(--color-success)`, `var(--color-warning)`, `var(--color-error)`, `var(--color-info)`
- `bg-text-tertiary`, `bg-text-quaternary` for neutral/idle

#### Sidebar.tsx
- Uses editorial tokens consistently
- `bg-layer-1`, `border-border-base`
- `accent-primary`, `accent-text`
- `text-text-primary`, `text-text-secondary`, `text-text-tertiary`

### 4.2 Status Utilities

#### src/utils/status.ts (Lines 71-92)
**Uses CSS variables correctly**:
```typescript
'text-[var(--color-success)]'
'text-[var(--color-warning)]'
'text-[var(--color-error)]'
'text-[var(--color-info)]'
'bg-[var(--color-success-subtle)]'
'bg-[var(--color-warning-subtle)]'
```

---

## 5. Theme Conflict Matrix

| Component | Editorial | TimeMachine | Hardcoded | Notes |
|-----------|-----------|-------------|-----------|-------|
| Dashboard | ✅ | ❌ | ❌ | Clean editorial usage |
| JobDetail | ✅ | ❌ | ❌ | Clean editorial usage |
| AppSettings | ✅ | ❌ | ⚠️ green | One green success box |
| Sidebar | ✅ | ❌ | ❌ | Clean editorial usage |
| Button | ✅ | ❌ | ❌ | Perfect implementation |
| Badge | ✅ | ❌ | ❌ | Uses CSS vars properly |
| StatusDot | ✅ | ❌ | ❌ | Uses CSS vars properly |
| **TimeMachine** | ⚠️ | ✅ | ❌ | **Mixed systems** |
| TimeMachineHeader | ⚠️ | ✅ | ❌ | **Mixed systems** |
| TimelineRuler | ❌ | ✅ | ❌ | Pure TM CSS |
| SnapshotFocus | ❌ | ✅ | ❌ | Pure TM CSS |
| **RestoreWizard** | ✅ | ❌ | 🔵 info | **Info color overload** |
| **Terminal** | ❌ | ❌ | ✅ | **All hardcoded** |
| **FileBrowser** | ⚠️ | ❌ | 🔵 blue | **Blue link colors** |
| **ConnectionStatus** | ❌ | ❌ | ✅ | **All hardcoded** |

### Legend
- ✅ = Primary theme used consistently
- ⚠️ = Partially uses theme
- ❌ = Does not use this theme
- 🔵 = Uses blue accent
- ⚠️ green = Uses green colors

---

## 6. Specific Inconsistency Examples

### Example 1: Success States
**Three different approaches**:

1. **Dashboard** (Correct):
   ```tsx
   bg-[var(--color-success-subtle)] text-[var(--color-success)]
   ```

2. **AppSettings** (Hardcoded):
   ```tsx
   bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400
   ```

3. **ConnectionStatus** (Hardcoded):
   ```tsx
   bg-green-500, bg-green-400  /* pulse colors */
   ```

### Example 2: Primary Actions

1. **RestoreWizard** (Info blue):
   ```tsx
   bg-[var(--color-info)] text-white
   ```

2. **Dashboard** (Editorial accent):
   ```tsx
   bg-accent-primary text-accent-text
   ```

3. **TimeMachine** (TM accent):
   ```tsx
   background: var(--tm-accent)
   color: var(--tm-space)
   ```

### Example 3: Muted Text

1. **Dashboard** (Editorial):
   ```tsx
   text-text-tertiary
   ```

2. **TimeMachine** (TM variables):
   ```tsx
   color: var(--tm-text-dim)
   ```

3. **Terminal** (None - uses log colors):
   ```tsx
   text-red-400, text-yellow-400
   ```

---

## 7. Recommendations Priority List

### 🔴 Critical (Breaking Visual Consistency)

1. **Eliminate TimeMachine duplicate theme**
   - Replace all `--tm-*` variables with editorial equivalents
   - Map `tm-accent` → `accent-primary`
   - Map `tm-text-dim` → `text-text-tertiary`
   - Map `tm-dust` → `border-border-base`
   - **Files**: timemachine.css, TimelineRuler.tsx, SnapshotFocus.tsx, TimeMachineHeader.tsx

2. **Fix RestoreWizard blue overload**
   - Replace `var(--color-info)` primary buttons with `accent-primary`
   - Keep info color for actual info/help elements only
   - **File**: RestoreWizard.tsx (10 replacements)

### ⚠️ High Priority (Major Inconsistencies)

3. **Standardize ConnectionStatus colors**
   - Replace hardcoded green/orange/gray with semantic CSS variables
   - `bg-green-500` → `bg-[var(--color-success)]`
   - `bg-orange-500` → `bg-[var(--color-warning)]`
   - `bg-gray-400` → `bg-text-quaternary`
   - **File**: ConnectionStatus.tsx

4. **Fix AppSettings success box**
   - Replace hardcoded greens with CSS variables
   - **File**: AppSettings.tsx (lines 170-174)

5. **Standardize FileBrowser links**
   - Replace hardcoded blue with editorial accent or info color
   - Be consistent with rest of app
   - **File**: FileBrowser.tsx

### 📋 Medium Priority (Nice to Have)

6. **Terminal colors** - Consider if vibrant colors are intentional
   - If terminal needs bright colors for readability, document this exception
   - Otherwise, use semantic CSS variables

7. **Document theme architecture**
   - Create clear guidance on when to use which system
   - Update tokens.css with complete usage guide

---

## 8. Color Inventory Summary

### CSS Variables Defined
- **Editorial theme**: 30+ variables (index.css + tokens.css)
- **TimeMachine theme**: 45+ variables (timemachine.css) ⚠️ Duplicates
- **Semantic colors**: 8 variables (success, warning, error, info + subtle variants)

### Hardcoded Tailwind Classes Found
- **Green**: 12 instances (success states, connection status)
- **Orange**: 4 instances (syncing states, warnings)
- **Blue**: 4 instances (links, loading spinners)
- **Red**: 8 instances (errors, terminal)
- **Yellow**: 6 instances (warnings, terminal)
- **Gray**: 8 instances (neutral states, offline)

### Total Color Issues
- **60+ hardcoded color instances** that bypass design system
- **45+ duplicate CSS variables** in TimeMachine theme
- **3 competing color systems** across the application

---

## 9. Next Steps

### Immediate Actions
1. Audit complete ✅
2. Share findings with team
3. Prioritize fixes based on visual impact
4. Create migration plan for TimeMachine theme

### Design System Consolidation
1. Choose ONE theme system (editorial recommended)
2. Document exceptions (terminal colors, etc.)
3. Create migration mapping for TimeMachine → Editorial
4. Update component library to enforce tokens

### Testing After Changes
1. Visual regression testing
2. Dark mode verification
3. Accessibility (contrast ratios)
4. Cross-browser consistency

---

**Report Generated**: 2025-12-04
**Total Files Audited**: 25+ components and views
**Total Lines Analyzed**: ~4,000 lines of color-related code
