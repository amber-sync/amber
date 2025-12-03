---
name: ticketing-workflow
description: Implement complex features using atomic tickets with step-by-step instructions. Use this skill when tackling multi-file features, refactors, or any work spanning multiple components. Ensures systematic progress with full test coverage.
license: MIT
---

This skill guides implementation of complex features through a disciplined ticketing workflow. Create detailed tickets before coding, implement one at a time, and maintain full test coverage throughout.

The user provides a feature request or task that requires multiple steps, files, or components. They may include context about architecture, constraints, or priorities.

## Ticket-First Thinking

Before writing any code, break down the work into atomic tickets:

- **Scope**: Each ticket = one component, one hook, one command, or one integration point
- **Size**: 15-60 minutes of focused work per ticket
- **Order**: Backend first → Types/API bindings → Components → Integration
- **Independence**: Each ticket should be committable and testable on its own

**CRITICAL**: Never start coding a complex feature without tickets. The upfront investment in planning pays off in clarity, trackability, and reduced context-switching.

## Ticket Anatomy

Every ticket must contain enough information to implement it with zero prior context:

```markdown
## TIM-XXX: [Descriptive title]

### Goal
One sentence: what this accomplishes.

### Files to Create
- path/to/NewFile.tsx

### Files to Modify
- path/to/Existing.tsx (what changes)

### Implementation Steps
1. Concrete step with code pattern or method name
2. Next step referencing existing patterns
3. Wire up in parent component

### Testing
- [ ] npm run typecheck
- [ ] npm run test
- [ ] Manual verification

### Acceptance Criteria
- [ ] Specific observable outcome
```

## Workflow Per Ticket

Execute this loop for every ticket:

1. **View**: `./scripts/linear.sh view TIM-XXX`
2. **Implement**: Follow the steps exactly
3. **Verify**: `npm run typecheck && npm run lint && npm test && npm run test:rust`
4. **Commit**: `git commit -m "feat(TIM-XXX): Description"`
5. **Close**: `./scripts/linear.sh done TIM-XXX`
6. **Next**: Move to the next ticket in sequence

## Architecture Patterns

Apply these patterns when creating tickets:

- **Rust-First**: Data filtering, aggregation, and search belong in Rust with SQL. Never fetch-all-then-filter in JavaScript.
- **Component Extraction**: When a view exceeds ~200 lines, extract sub-components. Each gets its own ticket.
- **Hook Extraction**: Reusable state logic (fetching, filtering, subscriptions) becomes a custom hook with its own ticket.
- **Type-First**: Add types to `types.ts` before implementing. Types are documentation.

## Common Ticket Types

**Backend Command**: Rust method → Tauri command → lib.rs registration → TypeScript binding → types

**React Component**: Props interface → Component implementation → Parent integration → Loading/error states

**Custom Hook**: Return type → Fetch logic → Loading/error handling → Export

**Integration**: Route/navigation → Context updates → Wiring → End-to-end test

## Anti-Patterns

NEVER do these:

- **Code without tickets**: Leads to scope creep, forgotten pieces, untested paths
- **Giant tickets**: "Rebuild the UI" is not a ticket, it's a project
- **Vague tickets**: "Fix the thing" has no definition of done
- **Skipping verification**: Every commit must pass all checks
- **Batch commits**: One ticket = one focused commit

## Example: Time Explorer

This pattern delivered a complete feature across 9 tickets:

| Ticket | Scope | Time |
|--------|-------|------|
| TIM-129 | Main view skeleton | 30m |
| TIM-130 | Header + job switcher | 20m |
| TIM-131 | Action bar | 25m |
| TIM-132 | Stats + useJobStats hook | 25m |
| TIM-133 | Date navigator | 20m |
| TIM-134 | SlidePanel base | 15m |
| TIM-135 | EditJobPanel | 30m |
| TIM-136 | RestorePanel | 25m |
| TIM-137 | Integration + nav | 15m |

Total: ~3.5 hours, 81 tests passing, zero regressions.

Remember: The goal is sustainable velocity. Small, verified commits compound into robust features. Rushing creates debt; discipline creates quality.
