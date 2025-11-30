# Tauri Migration - Simple Workflow Guide

## Quick Start

```bash
# See next ticket details
./scripts/next-ticket.sh TIM-100

# Start working on a ticket (two options)
```

## Option 1: Use Claude Code Task Tool (Recommended)

In Claude Code, simply say:

```
Complete TIM-100 (Initialize Tauri project) following the detailed spec in tickets/tauri-migration.md
```

The Task tool will:
- Read the ticket
- Create the necessary files
- Run tests
- Report back when complete

## Option 2: Manual Implementation

```bash
# 1. Create branch
git checkout -b feature/TIM-100-tauri-init

# 2. Read ticket
cat tickets/tauri-migration.md | grep -A 50 "TIM-100"

# 3. Implement following acceptance criteria

# 4. Test
npm run tauri:dev  # Should open window

# 5. Commit
git add .
git commit -m "feat(TIM-100): Initialize Tauri project"

# 6. Update Linear
./scripts/linear.sh done TIM-100
```

## Recommended Ticket Order

### Phase 1: Foundation (Week 1)
**Must complete first - everything depends on this:**
- ✅ TIM-100: Initialize Tauri project

### Phase 2: Backend Core (Week 2-3)
**Do these in order (dependencies):**
1. TIM-101: Rust backend structure
2. TIM-102: Tauri command stubs
3. TIM-110: Port FileService to Rust
4. TIM-111: Port RsyncService to Rust ⚠️ **CRITICAL**
5. TIM-112: Port SnapshotService to Rust
6. TIM-116: Port store.ts and preferences.ts

### Phase 3: Frontend Integration (Week 4)
**Frontend updates:**
1. TIM-103: Create frontend API abstraction
2. TIM-120: Update frontend for Tauri
3. TIM-121: Implement event streaming

### Phase 4: Supporting Services (Week 5)
**Can be done in any order:**
- TIM-113: Port JobScheduler
- TIM-114: Port VolumeWatcher
- TIM-115: Port KeychainService

### Phase 5: System Integration (Week 6)
**Critical testing:**
1. TIM-130: Create test suite
2. TIM-131: Benchmark performance
3. TIM-132: Verify feature parity ⚠️ **CRITICAL**

### Phase 6: Final Touches (Week 7)
**Polish:**
- TIM-122: System tray
- TIM-123: Notifications
- TIM-134: SQLite indexing
- TIM-133: Remove Electron ⚠️ **FINAL STEP**

### Phase 7: UI Polish (Ongoing)
**Can do anytime after TIM-103:**
- TIM-200-222: Design system, typography, animations, command palette, etc.

## Daily Workflow

```bash
# Morning: Check what's next
./scripts/next-ticket.sh

# Pick a ticket
./scripts/next-ticket.sh TIM-XXX

# Work on it (Task tool or manual)

# When done, mark complete
./scripts/linear.sh done TIM-XXX

# Repeat
```

## Using Task Tool Effectively

**Good prompts:**
```
Complete TIM-110 (Port FileService to Rust).
Follow the full specification in tickets/tauri-migration.md.
Create the branch, implement, test, and commit.
```

**What Task tool does:**
- Reads the ticket details
- Creates feature branch
- Implements solution
- Runs tests
- Commits changes
- Reports completion

**After Task completes:**
1. Review the changes
2. Test manually if needed
3. Push branch: `git push origin feature/TIM-XXX-...`
4. Mark ticket done in Linear

## Testing as You Go

After each ticket:
```bash
# For Rust tickets
cd src-tauri
cargo test
cargo build

# For frontend tickets
npm test
npm run tauri:dev

# For integration tickets
npm run tauri:build
```

## When You Get Stuck

1. **Read ticket again** - All details in `tickets/tauri-migration.md`
2. **Check dependencies** - Listed in ticket
3. **Ask Claude** - "I'm stuck on TIM-XXX because..."
4. **Review Tauri docs** - https://tauri.app/v2/

## Tracking Progress

```bash
# See all tickets
./scripts/linear.sh list

# See in-progress
./scripts/linear.sh list "In Progress"

# See completed
./scripts/linear.sh list Done
```

## Estimated Timeline

- **Solo with Claude help**: 6-8 weeks
- **Using Task tool heavily**: 4-6 weeks
- **Working part-time**: 10-12 weeks

## Success Criteria

When you're done:
- ✅ All 30 tickets marked Done in Linear
- ✅ `npm run tauri:build` produces working DMG
- ✅ All tests pass
- ✅ Benchmarks meet targets (startup <500ms, memory <100MB)
- ✅ No regressions in feature parity test
- ✅ Electron dependencies removed

## Current Status

- [ ] Foundation phase (TIM-100)
- [ ] Backend core (TIM-101, 102, 110-112, 116)
- [ ] Frontend integration (TIM-103, 120, 121)
- [ ] Supporting services (TIM-113, 114, 115)
- [ ] Testing & benchmarks (TIM-130, 131, 132)
- [ ] System integration (TIM-122, 123, 134)
- [ ] Cleanup (TIM-133)
- [ ] UI polish (TIM-200-222)

---

**Ready to start?**

```bash
./scripts/next-ticket.sh TIM-100
```

Then either use Claude Code Task tool or follow the manual steps. Good luck! 🚀
