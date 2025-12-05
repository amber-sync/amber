# JobCard Component Design Specification

## Overview
An expandable job card component that solves current UI problems by providing a clean, scannable collapsed state with detailed information revealed on expansion.

## Problem Statement
**Current Issues:**
- Jobs are cramped with too much information in a single row
- Hover actions overlay other content causing visual noise
- File paths are truncated and difficult to read
- Hard to scan through multiple jobs quickly

## Design Solution: Compact with Expandable Details (Option B)

### Component Structure

```typescript
interface JobCardProps {
  job: {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'success' | 'error' | 'paused';
    mode: 'mirror' | 'archive' | 'timemachine';
    sourcePath: string;
    destinationPath: string;
    schedule: {
      type: 'manual' | 'interval' | 'cron';
      value?: string;
    };
    lastRun?: {
      timestamp: string;
      duration: number;
      filesProcessed: number;
      status: 'success' | 'error';
    };
    progress?: {
      current: number;
      total: number;
      percentage: number;
    };
  };
  onRun: (jobId: string) => void;
  onPause: (jobId: string) => void;
  onStop: (jobId: string) => void;
  onViewHistory: (jobId: string) => void;
  onEditSettings: (jobId: string) => void;
  defaultExpanded?: boolean;
}
```

## Visual States

### 1. Collapsed State (Default)
**Purpose:** Fast scanning of all jobs at a glance

```
┌────────────────────────────────────────────────────────────────┐
│ ● Running  Job Name           MIRROR    2m ago    ▶ ⚙ 📊 ≡   │
└────────────────────────────────────────────────────────────────┘
```

**Layout:**
```
[Status] [Name]           [Mode Badge] [Relative Time] [Actions]
```

**Elements:**
- **Status Indicator** (left edge): `StatusDot` with pulse animation for running jobs
- **Job Name** (flex-1): Primary text, truncate with ellipsis at ~40 chars
- **Mode Badge**: Small pill showing MIRROR/ARCHIVE/TIME MACHINE
- **Relative Time**: Muted text showing last activity
- **Actions**: Always-visible icon buttons (no hover required)
  - Play/Pause button (conditional based on status)
  - Settings
  - History
  - Menu (more options)

**Interaction:**
- Click anywhere on the row (except actions) to expand/collapse
- Keyboard: Space/Enter to toggle expansion
- Actions remain clickable without expanding

### 2. Expanded State
**Purpose:** View and manage full job details

```
┌────────────────────────────────────────────────────────────────┐
│ ● Running  Job Name           MIRROR    2m ago    ▶ ⚙ 📊 ≡   │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SOURCE                                                          │
│  📁 /Users/john/Documents/Projects                              │
│                                                                  │
│  DESTINATION                                                     │
│  💾 /Volumes/Backup/Projects                                    │
│                                                                  │
│  SCHEDULE                                                        │
│  Every 6 hours                                                   │
│                                                                  │
│  LAST RUN                                                        │
│  2 minutes ago · 1m 34s · 2,453 files · Success                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Run Now    │  │   History    │  │   Settings   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

**Sections (in expanded area):**
1. **Source Path**: Label + icon + full path (with folder icon)
2. **Destination Path**: Label + icon + full path (with drive icon)
3. **Schedule**: Human-readable schedule description
4. **Last Run**: Compact summary with status indicator
5. **Action Buttons**: Full-width button group for primary actions

### 3. Running State (Expanded)
**Special case:** When job is running and expanded, show progress

```
┌────────────────────────────────────────────────────────────────┐
│ ● Running  Backup Documents   MIRROR    Running   ⏸ ⚙ 📊 ≡   │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PROGRESS                                                        │
│  ████████████████░░░░░░░░     2,453 / 5,000 files (49%)       │
│                                                                  │
│  SOURCE                                                          │
│  📁 /Users/john/Documents/Projects                              │
│  ...                                                             │
└────────────────────────────────────────────────────────────────┘
```

## Design Tokens Usage

### Colors
```css
/* Card Background */
bg-layer-1              /* Main card surface */
bg-layer-2              /* Expanded section background */

/* Text Colors */
text-text-primary       /* Job name */
text-text-secondary     /* Labels, relative time */
text-text-tertiary      /* Muted info */

/* Borders */
border-border-base      /* Card outline */
border-border-highlight /* Divider between collapsed/expanded */

/* Shadows */
shadow-[var(--shadow-card)]      /* Default card shadow */
shadow-[var(--shadow-elevated)]  /* Hover/expanded shadow */
```

### Spacing
```css
/* Card Padding */
p-4                     /* 16px - collapsed row padding */
p-6                     /* 24px - expanded content padding */

/* Gaps */
gap-3                   /* 12px - between elements in collapsed row */
gap-4                   /* 16px - between sections in expanded area */
gap-2                   /* 8px - between related items */
```

### Typography
```css
/* Collapsed Row */
text-sm font-medium     /* Job name (13px, 500 weight) */
text-xs                 /* Mode badge, relative time (11px) */

/* Expanded Area */
text-2xs font-semibold  /* Section labels (10px, uppercase, 600 weight) */
text-xs                 /* Paths and details (11px) */
```

## CSS Class Structure

### Base Card Classes
```css
.job-card {
  @apply bg-layer-1
         border border-border-base
         rounded-[var(--card-radius)]
         shadow-[var(--shadow-card)]
         transition-all duration-200;
}

.job-card:hover {
  @apply shadow-[var(--shadow-elevated)]
         border-border-highlight;
}

.job-card[data-expanded="true"] {
  @apply shadow-[var(--shadow-elevated)];
}
```

### Collapsed Row
```css
.job-card-header {
  @apply flex items-center gap-3 p-4
         cursor-pointer
         select-none;
}

.job-card-name {
  @apply flex-1
         text-sm font-medium text-text-primary
         truncate;
}

.job-card-meta {
  @apply flex items-center gap-3;
}

.job-card-time {
  @apply text-xs text-text-tertiary;
}

.job-card-actions {
  @apply flex items-center gap-1;
}
```

### Expanded Content
```css
.job-card-content {
  @apply border-t border-border-base
         p-6 pt-5
         space-y-4;
}

.job-card-section {
  @apply space-y-2;
}

.job-card-label {
  @apply text-2xs font-semibold
         text-text-tertiary
         uppercase tracking-wider;
}

.job-card-path {
  @apply flex items-center gap-2
         text-xs text-text-secondary
         font-mono
         break-all; /* Allow long paths to wrap */
}
```

## Animation

### Expand/Collapse Animation
```css
/* Framer Motion variants for smooth expansion */
const contentVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: {
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1], // ease-in-out
      },
      opacity: {
        duration: 0.15,
        ease: [0, 0, 0.2, 1], // ease-out
      },
    },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: {
      height: {
        duration: 0.25,
        ease: [0.4, 0, 0.2, 1],
      },
      opacity: {
        duration: 0.2,
        delay: 0.1, // Slight delay for content fade-in
        ease: [0, 0, 0.2, 1],
      },
    },
  },
};

/* Chevron rotation */
const chevronVariants = {
  collapsed: { rotate: 0 },
  expanded: { rotate: 90 },
};
```

### Hover Effects
```css
/* Smooth transition for all interactive states */
.job-card,
.job-card-header,
.job-card button {
  @apply transition-all duration-200 ease-in-out;
}

/* Subtle lift on hover */
.job-card:hover {
  @apply -translate-y-0.5;
}

/* Scale feedback on click */
.job-card-header:active {
  @apply scale-[0.995];
}
```

## Accessibility

### Keyboard Navigation
```typescript
// Keyboard event handlers
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
    case ' ': // Space
      e.preventDefault();
      setExpanded(!expanded);
      break;
    case 'Escape':
      if (expanded) {
        setExpanded(false);
      }
      break;
  }
};
```

### ARIA Attributes
```tsx
<div
  className="job-card"
  role="article"
  aria-labelledby={`job-name-${job.id}`}
  data-expanded={expanded}
>
  <button
    className="job-card-header"
    onClick={() => setExpanded(!expanded)}
    onKeyDown={handleKeyDown}
    aria-expanded={expanded}
    aria-controls={`job-content-${job.id}`}
    aria-label={`${expanded ? 'Collapse' : 'Expand'} job details for ${job.name}`}
  >
    <StatusDot status={statusMap[job.status]} pulse={job.status === 'running'} />
    <span id={`job-name-${job.id}`} className="job-card-name">
      {job.name}
    </span>
    <Badge variant="subtle" size="sm">{getModeLabel(job.mode)}</Badge>
    <span className="job-card-time" aria-label={`Last run ${getRelativeTime(job.lastRun?.timestamp)}`}>
      {getRelativeTime(job.lastRun?.timestamp)}
    </span>

    {/* Actions - prevent event bubbling */}
    <div className="job-card-actions" role="group" aria-label="Job actions">
      <IconButton
        variant="ghost"
        size="sm"
        label={job.status === 'running' ? 'Pause job' : 'Run job now'}
        onClick={(e) => {
          e.stopPropagation();
          job.status === 'running' ? onPause(job.id) : onRun(job.id);
        }}
      >
        {job.status === 'running' ? <PauseIcon /> : <PlayIcon />}
      </IconButton>
      <IconButton
        variant="ghost"
        size="sm"
        label="Edit job settings"
        onClick={(e) => {
          e.stopPropagation();
          onEditSettings(job.id);
        }}
      >
        <SettingsIcon />
      </IconButton>
      <IconButton
        variant="ghost"
        size="sm"
        label="View job history"
        onClick={(e) => {
          e.stopPropagation();
          onViewHistory(job.id);
        }}
      >
        <HistoryIcon />
      </IconButton>
    </div>

    {/* Expand indicator */}
    <ChevronRightIcon
      className="w-4 h-4 text-text-tertiary transition-transform duration-200"
      style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
      aria-hidden="true"
    />
  </button>

  {/* Expanded content */}
  <motion.div
    id={`job-content-${job.id}`}
    initial={false}
    animate={expanded ? 'expanded' : 'collapsed'}
    variants={contentVariants}
    className="overflow-hidden"
  >
    <div className="job-card-content">
      {/* Source Path */}
      <div className="job-card-section">
        <label className="job-card-label">Source</label>
        <div className="job-card-path">
          <FolderIcon className="w-4 h-4 text-text-tertiary flex-shrink-0" />
          <span>{job.sourcePath}</span>
        </div>
      </div>

      {/* Destination Path */}
      <div className="job-card-section">
        <label className="job-card-label">Destination</label>
        <div className="job-card-path">
          <DriveIcon className="w-4 h-4 text-text-tertiary flex-shrink-0" />
          <span>{job.destinationPath}</span>
        </div>
      </div>

      {/* Schedule */}
      <div className="job-card-section">
        <label className="job-card-label">Schedule</label>
        <p className="text-xs text-text-secondary">
          {getScheduleDescription(job.schedule)}
        </p>
      </div>

      {/* Last Run */}
      {job.lastRun && (
        <div className="job-card-section">
          <label className="job-card-label">Last Run</label>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <StatusDot status={job.lastRun.status === 'success' ? 'success' : 'error'} size="sm" />
            <span>{getRelativeTime(job.lastRun.timestamp)}</span>
            <span className="text-text-tertiary">·</span>
            <span>{formatDuration(job.lastRun.duration)}</span>
            <span className="text-text-tertiary">·</span>
            <span>{job.lastRun.filesProcessed.toLocaleString()} files</span>
          </div>
        </div>
      )}

      {/* Progress (if running) */}
      {job.status === 'running' && job.progress && (
        <div className="job-card-section">
          <label className="job-card-label">Progress</label>
          <div className="space-y-2">
            <div className="h-2 bg-layer-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-primary transition-all duration-300"
                style={{ width: `${job.progress.percentage}%` }}
              />
            </div>
            <p className="text-xs text-text-tertiary">
              {job.progress.current.toLocaleString()} / {job.progress.total.toLocaleString()} files
              ({job.progress.percentage}%)
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          className="flex-1 px-4 py-2 bg-accent-primary text-accent-text rounded-lg
                     text-sm font-medium
                     hover:bg-accent-hover active:scale-[0.98]
                     transition-all duration-150
                     disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onRun(job.id)}
          disabled={job.status === 'running'}
        >
          Run Now
        </button>
        <button
          className="flex-1 px-4 py-2 bg-layer-2 text-text-primary rounded-lg
                     text-sm font-medium border border-border-base
                     hover:bg-layer-3 active:scale-[0.98]
                     transition-all duration-150"
          onClick={() => onViewHistory(job.id)}
        >
          History
        </button>
        <button
          className="flex-1 px-4 py-2 bg-layer-2 text-text-primary rounded-lg
                     text-sm font-medium border border-border-base
                     hover:bg-layer-3 active:scale-[0.98]
                     transition-all duration-150"
          onClick={() => onEditSettings(job.id)}
        >
          Settings
        </button>
      </div>
    </div>
  </motion.div>
</div>
```

### Screen Reader Announcements
```typescript
// Announce state changes to screen readers
useEffect(() => {
  if (expanded) {
    announceToScreenReader(`Expanded job details for ${job.name}`);
  }
}, [expanded, job.name]);

// Live region for status updates
<div role="status" aria-live="polite" className="sr-only">
  {job.status === 'running' && `Job ${job.name} is running`}
  {job.status === 'success' && `Job ${job.name} completed successfully`}
  {job.status === 'error' && `Job ${job.name} failed`}
</div>
```

### Focus Management
```typescript
// Focus trap when expanded (optional, for modal-like behavior)
const cardRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (expanded && cardRef.current) {
    // Optionally focus the first actionable element
    const firstButton = cardRef.current.querySelector<HTMLButtonElement>(
      '.job-card-content button'
    );
    firstButton?.focus();
  }
}, [expanded]);

// Restore focus when collapsed
const headerRef = useRef<HTMLButtonElement>(null);

const handleCollapse = () => {
  setExpanded(false);
  // Return focus to header
  setTimeout(() => headerRef.current?.focus(), 100);
};
```

## Responsive Behavior

### Desktop (default)
- Full layout as designed
- All information visible in expanded state
- Hover effects active

### Tablet (< 1024px)
```css
@media (max-width: 1024px) {
  .job-card-meta {
    /* Stack mode badge and time */
    @apply flex-col items-end gap-1;
  }

  .job-card-actions {
    /* Keep essential actions only */
  }
}
```

### Mobile (< 640px)
```css
@media (max-width: 640px) {
  .job-card-header {
    /* Smaller padding */
    @apply p-3 gap-2;
  }

  .job-card-name {
    /* Allow name to take more space */
    @apply text-xs;
  }

  .job-card-time {
    /* Hide relative time in collapsed state */
    @apply hidden;
  }

  .job-card-content {
    /* Tighter spacing on mobile */
    @apply p-4 space-y-3;
  }

  .job-card-content .flex {
    /* Stack buttons vertically */
    @apply flex-col;
  }
}
```

## State Management

### Component State
```typescript
const JobCard: React.FC<JobCardProps> = ({ job, ...handlers }) => {
  // Expansion state
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  // Hover state (for subtle UI hints)
  const [isHovered, setIsHovered] = useState(false);

  // Status mapping
  const statusMap: Record<typeof job.status, StatusDotStatus> = {
    idle: 'neutral',
    running: 'info',
    success: 'success',
    error: 'error',
    paused: 'warning',
  };

  return (
    <div
      ref={cardRef}
      className="job-card"
      data-expanded={expanded}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Component JSX */}
    </div>
  );
};
```

## Helper Functions

```typescript
// Format relative time
const getRelativeTime = (timestamp?: string): string => {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

// Format duration
const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
};

// Get mode label
const getModeLabel = (mode: string): string => {
  const labels = {
    mirror: 'MIRROR',
    archive: 'ARCHIVE',
    timemachine: 'TIME MACHINE',
  };
  return labels[mode as keyof typeof labels] || mode.toUpperCase();
};

// Get schedule description
const getScheduleDescription = (schedule: typeof job.schedule): string => {
  if (schedule.type === 'manual') return 'Manual';
  if (schedule.type === 'interval') return schedule.value || 'Every 6 hours';
  if (schedule.type === 'cron') return schedule.value || 'Custom schedule';
  return 'Not scheduled';
};
```

## Performance Considerations

1. **Memoization**: Memoize expensive computations
```typescript
const relativeTime = useMemo(
  () => getRelativeTime(job.lastRun?.timestamp),
  [job.lastRun?.timestamp]
);
```

2. **Virtual Scrolling**: For large lists of jobs (>50), implement virtual scrolling
3. **Animation Performance**: Use CSS transforms and opacity for animations (GPU-accelerated)
4. **Event Delegation**: Consider event delegation for large job lists

## Testing Checklist

- [ ] Expand/collapse animation is smooth at 60fps
- [ ] Keyboard navigation works (Enter, Space, Escape)
- [ ] Screen readers announce state changes correctly
- [ ] Focus management works properly
- [ ] Actions don't expand card when clicked
- [ ] Long paths wrap correctly and don't break layout
- [ ] Running state shows progress correctly
- [ ] Mobile layout stacks appropriately
- [ ] Dark mode colors are correct
- [ ] Hover states work on all interactive elements

## Future Enhancements

1. **Drag to Reorder**: Allow users to reorder jobs by dragging cards
2. **Batch Selection**: Checkbox for multi-select with bulk actions
3. **Quick Actions**: Swipe gestures on mobile for common actions
4. **Status History**: Mini timeline showing recent run statuses
5. **Pinned Jobs**: Pin important jobs to the top of the list
6. **Custom Expansion**: Save per-job expansion state in user preferences
