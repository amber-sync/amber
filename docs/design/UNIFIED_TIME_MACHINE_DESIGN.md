# Unified Time Machine - Design Specification

## Problem Statement

The current Amber UI has fragmented backup exploration across **three separate views**:
- **TimeExplorer** (TIM-129): Job-focused, left sidebar with snapshots, cluttered layout
- **TimelineView**: Cross-job timeline, better immersion but disconnected from job management
- **JobDetail**: Live activity, analytics, file browser, but separate from time navigation

This creates a disjointed experience where users must mentally map relationships between views. The goal is to **unify these into a single, immersive Time Machine experience**.

---

## Design Philosophy

### Aesthetic Direction: "Observatory"

The user is an **observer of their data through time**. Like astronomers tracking celestial events, users observe their backup history unfolding. This metaphor informs every design decision:

| Principle | Implementation |
|-----------|----------------|
| **Darkness as Canvas** | Deep, rich dark backgrounds that make data shine |
| **Amber as Signal** | The brand color (#F59E0B) represents the "now" - live activity, current selection |
| **Time as Primary Axis** | Timeline is THE navigation, not a feature |
| **Data as Light** | Stats, files, analytics emerge from darkness like stars |
| **Calm Confidence** | Spacious, unhurried layouts that convey reliability |

### Typography

- **Display**: "Instrument Serif" - elegant, distinctive for dates and headers
- **Body**: "IBM Plex Sans" - technical precision for data, excellent legibility
- **Mono**: "IBM Plex Mono" - for file paths, technical info

### Color System

```css
/* Core Palette - Observatory Dark */
--tm-void: #0a0a0b;           /* Deepest background */
--tm-space: #111113;          /* Primary surfaces */
--tm-nebula: #1a1a1e;         /* Elevated surfaces */
--tm-dust: #2a2a30;           /* Subtle borders */

/* Amber Signal System */
--tm-amber-glow: #F59E0B;     /* Primary accent */
--tm-amber-dim: #92400E;      /* Muted amber */
--tm-amber-wash: rgba(245, 158, 11, 0.08);  /* Background wash */

/* Data Colors - Subtle, Scientific */
--tm-success: #22C55E;        /* Complete backups */
--tm-warning: #EAB308;        /* Partial */
--tm-error: #EF4444;          /* Failed */
--tm-neutral: #71717A;        /* Inactive/past */

/* Text Hierarchy */
--tm-text-bright: #FAFAFA;    /* Primary text */
--tm-text-soft: #A1A1AA;      /* Secondary */
--tm-text-dim: #52525B;       /* Tertiary */
```

### Motion Principles

1. **Timeline Transitions**: Smooth, physics-based scrolling with momentum
2. **Snapshot Focus**: 300ms ease-out when selecting, content fades in with stagger
3. **Live Activity**: Subtle pulse (2s cycle) on amber elements during sync
4. **Panel Reveals**: Slide + fade from edges, 400ms with cubic-bezier
5. **Micro-interactions**: 150ms for hover states, immediate feedback

---

## Architecture

### Component Hierarchy

```
<TimeMachine>                           # Root view (replaces TimeExplorer, TimelineView, JobDetail)
├── <TimeMachineHeader>                 # Minimal header with job switcher + settings
│   ├── Job Dropdown                    # Quick switch between jobs
│   ├── Live Status Indicator           # Amber pulse when syncing
│   └── Settings/Back                   # Minimal actions
│
├── <TimelineRuler>                     # THE primary navigation
│   ├── Year markers                    # Vertical tick marks
│   ├── Month labels                    # Hover to see
│   ├── Snapshot markers                # Clustered dots
│   ├── Now indicator                   # Right edge, amber glow
│   └── Selection highlight             # Vertical beam on selection
│
├── <SnapshotFocus>                     # Central content area
│   ├── <SnapshotMeta>                  # Date, time, relative time
│   ├── <SnapshotStats>                 # Files, size, changes, duration
│   ├── <QuickActions>                  # Browse, Restore, Open in Finder
│   └── <AnalyticsPreview>              # Top file types, largest files (on demand)
│
├── <LiveActivityBar>                   # Fixed bottom bar when sync running
│   ├── Progress indicator              # Thin amber progress line
│   ├── Current file                    # Truncated, monospace
│   ├── ETA                             # Time remaining
│   └── Expand to terminal              # Opens log overlay
│
└── <Overlays>                          # Modal-like panels
    ├── <FileExplorer>                  # Slide-in file browser
    ├── <RestoreWizard>                 # Restore workflow
    ├── <TerminalOverlay>               # Full-screen logs
    └── <AnalyticsDetail>               # Expanded analytics
```

### State Management

```typescript
interface TimeMachineState {
  // Job Context
  activeJobId: string | null;

  // Timeline Navigation
  selectedTimestamp: number | null;
  zoomLevel: 'all' | 'year' | 'month' | 'week';
  viewportRange: { start: number; end: number };

  // UI State
  activeOverlay: 'files' | 'restore' | 'terminal' | 'analytics' | null;
  fileBrowserPath: string | null;

  // Live Activity (from parent context)
  isRunning: boolean;
  progress: RsyncProgressData | null;
  logs: LogEntry[];
}
```

---

## Layout Specifications

### Desktop (1200px+)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◀ Back    [Job Dropdown ▾]                        ⚙ Settings   ● Live│  48px header
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  80px timeline
│  2023          2024                                           NOW ⬤  │
│  ┃    · ·  ···  ·    ·· · ···· ··· ··  ·· ·· ····· ··· ▮ ···· ··  ┃  │
│                                          ▲                           │
│                                      selected                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                        December 3, 2024                              │  Main content
│                     Tuesday, 2:45:32 PM                              │  centered
│                       3 hours ago                                    │
│                                                                      │
│     ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│     │  FILES  │  │  SIZE   │  │ CHANGES │  │ DURATION│              │
│     │ 12,453  │  │ 4.2 GB  │  │   847   │  │  2m 34s │              │
│     └─────────┘  └─────────┘  └─────────┘  └─────────┘              │
│                                                                      │
│           [ Browse Files ]  [ Restore ]  [ Open in Finder ]         │
│                                                                      │
│     ┌─ Analytics ─────────────────────────────────────────────┐     │
│     │  .tsx (234)  .ts (189)  .json (45)  .md (23)  ...      │     │
│     │  Largest: node_modules/... (890 MB)                     │     │
│     └─────────────────────────────────────────────────────────┘     │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  syncing... 45%  README.md  ETA 2:34  [▤]  │  40px live bar
└──────────────────────────────────────────────────────────────────────┘
```

### Tablet (768px - 1199px)

- Timeline ruler: horizontal, scrollable
- Stats: 2x2 grid
- Actions: stacked vertically
- Live bar: same fixed position

### Mobile (<768px)

- Timeline: vertical list mode (snapshot cards)
- Stats: single column
- Overlays: full screen

---

## Interaction Flows

### 1. Navigate Through Time

```
User drags/scrolls timeline → Viewport updates smoothly
User clicks snapshot marker → Selection animates (vertical beam + highlight)
                           → Snapshot details fade in with stagger (150ms delay each)
                           → Analytics loads async in background
```

### 2. Browse Snapshot Files

```
User clicks "Browse Files" → File overlay slides in from right (400ms)
                          → File browser loads directory from index
User navigates folders    → Breadcrumb updates, content transitions
User clicks file          → Preview panel shows (if previewable)
User clicks "Back"        → Overlay slides out, returns to snapshot focus
```

### 3. Live Sync Activity

```
Sync starts              → Live bar appears from bottom (slide up, 300ms)
                         → Header indicator pulses amber
During sync              → Progress bar fills, file name updates
                         → Timeline "now" marker pulses
User clicks expand       → Terminal overlay fades in
Sync completes           → New snapshot marker animates in
                         → Live bar collapses after 3s delay
```

### 4. Restore Workflow

```
User clicks "Restore"    → Restore wizard overlay slides in
Step 1: Confirm snapshot → Shows snapshot summary
Step 2: Choose target    → Directory picker
Step 3: Confirm          → Summary of what will be restored
During restore           → Progress shows in wizard
Complete                 → Success animation, option to open folder
```

---

## Linear Ticket Breakdown

### Epic: TIM-200 - Unified Time Machine Experience

| Ticket | Title | Priority | Estimate |
|--------|-------|----------|----------|
| TIM-201 | Create TimeMachine view shell and routing | P0 | 2h |
| TIM-202 | Build TimelineRuler component with gestures | P0 | 4h |
| TIM-203 | Create SnapshotFocus detail panel | P0 | 3h |
| TIM-204 | Implement LiveActivityBar component | P0 | 2h |
| TIM-205 | Build job switcher and header | P1 | 2h |
| TIM-206 | Create FileExplorer overlay | P1 | 4h |
| TIM-207 | Build RestoreWizard flow | P1 | 3h |
| TIM-208 | Add AnalyticsPreview and AnalyticsDetail | P2 | 3h |
| TIM-209 | Implement keyboard navigation | P2 | 2h |
| TIM-210 | Add timeline gestures (pinch zoom, momentum scroll) | P2 | 3h |
| TIM-211 | Create onboarding empty state | P2 | 1h |
| TIM-212 | Migrate routes from old views | P1 | 2h |
| TIM-213 | Remove deprecated views (cleanup) | P3 | 1h |

### Dependencies

```
TIM-201 ──┬─→ TIM-202 ──┬─→ TIM-209
          │             │
          ├─→ TIM-203 ──┼─→ TIM-206
          │             │
          ├─→ TIM-204   ├─→ TIM-207
          │             │
          └─→ TIM-205   └─→ TIM-208
                              │
TIM-212 depends on all P0/P1  │
TIM-213 depends on TIM-212 ───┘
```

---

## Migration Strategy

### Phase 1: Build New (Branch: `feature/unified-time-machine`)
- Create all new components in `src/views/TimeMachine/`
- Use new routing path `/time-machine`
- Keep old views working during development

### Phase 2: Test & Refine
- Internal testing with both views available
- Gather feedback on new experience
- Iterate on animations and interactions

### Phase 3: Migrate
- Make TimeMachine the default view for job selection
- Update Dashboard to navigate to new view
- Add feature flag for rollback if needed

### Phase 4: Cleanup
- Remove TimeExplorer, TimelineView, JobDetail
- Clean up unused components
- Update documentation

---

## Technical Considerations

### Performance

1. **Virtual Timeline**: Only render visible snapshot markers
2. **Lazy Analytics**: Load file type stats on demand, not on selection
3. **Indexed Queries**: Use SQLite FTS for all file operations
4. **Debounced Selection**: 100ms debounce on rapid timeline navigation

### Accessibility

1. **Keyboard Navigation**: Arrow keys for timeline, Tab for actions
2. **Screen Reader**: ARIA labels for timeline position, snapshot details
3. **Reduced Motion**: Respect `prefers-reduced-motion`
4. **Focus Management**: Trap focus in overlays, restore on close

### Testing

1. **Unit Tests**: Each component in isolation
2. **Integration Tests**: Navigation flows
3. **E2E Tests**: Full restore workflow
4. **Performance Tests**: Timeline with 1000+ snapshots

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Views to restore a file | 3+ | 1 |
| Time to understand backup status | ~10s | <3s |
| Clicks to browse snapshot | 4+ | 2 |
| Cognitive load (user feedback) | High | Low |

---

## Appendix: Rejected Alternatives

### A. Tabbed Interface
- Pros: Familiar, simple
- Cons: Still fragmented, doesn't solve core problem

### B. Sidebar + Content
- Pros: Works for complex apps
- Cons: Doesn't emphasize time as primary axis

### C. Card Grid
- Pros: Good for overview
- Cons: Loses timeline context, harder to navigate

The **Observatory** approach was chosen because it puts TIME at the center, which is the core value proposition of a Time Machine backup system.
