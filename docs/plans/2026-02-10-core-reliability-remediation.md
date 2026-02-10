# Core Reliability Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the highest-impact reliability gaps found in review: broken cloud backup execution, non-functional scheduling, misleading notification flow, un-enforced runtime preferences, and benchmark/build health issues.

**Architecture:** Keep the existing Tauri + React structure, but enforce a single source of truth for execution routing and job shape. Route by job destination type at the edge (frontend trigger + tray trigger) and keep backend commands strict. For scheduling and notifications, wire existing service modules into app startup and command handlers instead of adding new subsystems.

**Tech Stack:** React 19 + TypeScript + Vitest, Rust (Tauri v2), cargo test/clippy/bench, GitHub Actions.

## Scope and Order

1. Cloud path correctness (save + execute)  
2. Notifications correctness (API contract + backend behavior)  
3. Scheduler runtime wiring and execution behavior  
4. Runtime preference enforcement  
5. Build and CI hygiene fixes (bench + Linux compile + clippy alignment)

---

### Task 1: Persist cloud jobs correctly from Job Editor

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/hooks/useJobForm.ts`
- Test: `src/context/__tests__/AppContext.test.tsx`
- Create (if needed): `src/__tests__/job-save-cloud.test.tsx`

**Step 1: Write failing test for cloud save shape**
- Add a test that saves a cloud job and asserts:
- `destinationType === CLOUD`
- `cloudConfig` is present with `remoteName`, `remotePath`, `encrypt`, `bandwidth`
- `destPath` is not required for cloud mode

**Step 2: Run test to verify it fails**
- Run: `npm test -- --run src/context/__tests__/AppContext.test.tsx`
- Expected: FAIL on missing `cloudConfig` or wrong `destinationType`

**Step 3: Implement minimal save-path fix**
- In `handleSaveJob` update both create and edit paths to carry:
- `destinationType` from `jobForm.destinationType`
- `cloudConfig` from cloud form fields when destination is cloud
- Adjust save guards so cloud mode does not depend on local `destPath`

**Step 4: Run tests to verify pass**
- Run: `npm test -- --run src/context/__tests__/AppContext.test.tsx`
- Expected: PASS

**Step 5: Commit**
```bash
git add src/App.tsx src/hooks/useJobForm.ts src/context/__tests__/AppContext.test.tsx src/__tests__/job-save-cloud.test.tsx
git commit -m "fix: persist cloud job destination and config from editor"
```

---

### Task 2: Route execution engine by destination type in UI paths

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/jobs/context/JobsContext.tsx`
- Test: `src/context/__tests__/AppContext.test.tsx`
- Create: `src/features/jobs/context/__tests__/JobsContext.cloud-run.test.tsx`

**Step 1: Write failing tests for execution routing**
- Add tests asserting cloud jobs call `api.runRclone` and local jobs call `api.runRsync` in both:
- `App.tsx` run path
- `JobsContext.runSync`

**Step 2: Run tests to verify failure**
- Run: `npm test -- --run src/context/__tests__/AppContext.test.tsx src/features/jobs/context/__tests__/JobsContext.cloud-run.test.tsx`
- Expected: FAIL (cloud currently calls rsync)

**Step 3: Implement routing**
- Add a small helper in each file:
- if `destinationType === CLOUD` -> `api.runRclone(job)`
- else -> `api.runRsync(job)`
- Preserve status updates and error paths.

**Step 4: Run tests to verify pass**
- Run: `npm test -- --run src/context/__tests__/AppContext.test.tsx src/features/jobs/context/__tests__/JobsContext.cloud-run.test.tsx`
- Expected: PASS

**Step 5: Commit**
```bash
git add src/App.tsx src/features/jobs/context/JobsContext.tsx src/context/__tests__/AppContext.test.tsx src/features/jobs/context/__tests__/JobsContext.cloud-run.test.tsx
git commit -m "fix: route backup execution to rsync or rclone by destination type"
```

---

### Task 3: Route tray-initiated jobs by destination type

**Files:**
- Modify: `src-tauri/src/services/tray_manager.rs`
- Modify: `src-tauri/src/commands/rclone.rs` (if non-blocking behavior needed)
- Create: `src-tauri/tests/integration/tray_routing_tests.rs`

**Step 1: Write failing integration test**
- Add test for tray job action routing logic:
- local job invokes `run_rsync`
- cloud job invokes `run_rclone`

**Step 2: Run test to verify fail**
- Run: `cd src-tauri && cargo test tray_routing -- --nocapture`
- Expected: FAIL (currently always rsync)

**Step 3: Implement minimal routing**
- In tray handler, inspect loaded job `destination_type` and call command accordingly.
- Ensure cloud command execution is async-friendly and does not block tray responsiveness.

**Step 4: Run tests to verify pass**
- Run: `cd src-tauri && cargo test tray_routing -- --nocapture`
- Expected: PASS

**Step 5: Commit**
```bash
git add src-tauri/src/services/tray_manager.rs src-tauri/src/commands/rclone.rs src-tauri/tests/integration/tray_routing_tests.rs
git commit -m "fix: route tray backup start to rclone for cloud jobs"
```

---

### Task 4: Make cloud encryption setting truthful

**Files:**
- Modify: `src-tauri/src/services/rclone_service.rs`
- Modify: `src/features/job-editor/JobEditor.tsx`
- Test: `src-tauri/src/services/rclone_service.rs` (unit tests section)

**Step 1: Write failing test for encrypt behavior**
- Test command-building behavior when `encrypt=true`.
- Decide one of two valid product choices:
- A. Implement actual crypt-remote handling.
- B. Remove/disable UI toggle until implemented.

**Step 2: Run test to verify fail**
- Run: `cd src-tauri && cargo test rclone_service -- --nocapture`
- Expected: FAIL for selected product choice

**Step 3: Implement minimal truthful behavior**
- Prefer B for low-risk release: disable toggle in UI with explicit “not yet supported” copy.
- If choosing A, implement crypt wrapper safely and validate config presence.

**Step 4: Run tests to verify pass**
- Run: `cd src-tauri && cargo test rclone_service -- --nocapture`
- Expected: PASS

**Step 5: Commit**
```bash
git add src-tauri/src/services/rclone_service.rs src/features/job-editor/JobEditor.tsx
git commit -m "fix: align cloud encryption UX with actual rclone capabilities"
```

---

### Task 5: Fix notification API contract and fallback behavior

**Files:**
- Modify: `src-tauri/src/commands/preferences.rs`
- Modify: `src/api/system.ts`
- Modify: `src/features/settings/SettingsPage.tsx`
- Create: `src/features/settings/__tests__/SettingsPage.notifications.test.tsx`

**Step 1: Write failing UI test for backend failure fallback**
- Assert UI fallback notification path is used when backend returns false/error.

**Step 2: Run test to verify fail**
- Run: `npm test -- --run src/features/settings/__tests__/SettingsPage.notifications.test.tsx`
- Expected: FAIL (contract currently always true)

**Step 3: Implement contract fix**
- Change `test_notification` command to return structured result (e.g. `{ ok: boolean, reason?: string }`) or explicit error.
- Update `api.testNotification` to pass through real backend outcome.
- Keep UI fallback path reachable and logged.

**Step 4: Run tests to verify pass**
- Run: `npm test -- --run src/features/settings/__tests__/SettingsPage.notifications.test.tsx`
- Expected: PASS

**Step 5: Commit**
```bash
git add src-tauri/src/commands/preferences.rs src/api/system.ts src/features/settings/SettingsPage.tsx src/features/settings/__tests__/SettingsPage.notifications.test.tsx
git commit -m "fix: make notification test API truthful and enable UI fallback"
```

---

### Task 6: Wire scheduler service into app lifecycle

**Files:**
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands/jobs.rs`
- Create: `src-tauri/tests/integration/scheduler_init_tests.rs`

**Step 1: Write failing integration test for scheduler initialization**
- Assert scheduler is initialized at app startup and updated when jobs change.

**Step 2: Run test to verify fail**
- Run: `cd src-tauri && cargo test scheduler_init -- --nocapture`
- Expected: FAIL (currently not wired)

**Step 3: Implement lifecycle wiring**
- Add scheduler to `AppState`.
- Initialize scheduler in app setup with existing jobs.
- On `save_job` and `delete_job`, trigger scheduler update.

**Step 4: Run tests to verify pass**
- Run: `cd src-tauri && cargo test scheduler_init -- --nocapture`
- Expected: PASS

**Step 5: Commit**
```bash
git add src-tauri/src/state.rs src-tauri/src/lib.rs src-tauri/src/commands/jobs.rs src-tauri/tests/integration/scheduler_init_tests.rs
git commit -m "feat: initialize and update job scheduler during app lifecycle"
```

---

### Task 7: Make scheduled callbacks actually execute backups

**Files:**
- Modify: `src-tauri/src/services/job_scheduler.rs`
- Modify: `src-tauri/src/commands/rsync.rs`
- Create: `src-tauri/tests/integration/scheduler_execution_tests.rs`

**Step 1: Write failing test for scheduled execution callback**
- Assert scheduled callback triggers execution path for enabled jobs.

**Step 2: Run test to verify fail**
- Run: `cd src-tauri && cargo test scheduler_execution -- --nocapture`
- Expected: FAIL (callback currently logs only)

**Step 3: Implement minimal execution trigger**
- In scheduler callback, call a safe dispatch function (same routing rules as manual run).
- Add guard to avoid double-run when job already active.

**Step 4: Run tests to verify pass**
- Run: `cd src-tauri && cargo test scheduler_execution -- --nocapture`
- Expected: PASS

**Step 5: Commit**
```bash
git add src-tauri/src/services/job_scheduler.rs src-tauri/src/commands/rsync.rs src-tauri/tests/integration/scheduler_execution_tests.rs
git commit -m "feat: execute backups from scheduler callbacks"
```

---

### Task 8: Enforce runtime behavior for preferences

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands/preferences.rs`
- Modify: `src/context/SettingsContext.tsx`
- Create: `src-tauri/tests/integration/preferences_runtime_tests.rs`

**Step 1: Write failing test for close behavior preference**
- Assert close event respects `runInBackground` preference.

**Step 2: Run test to verify fail**
- Run: `cd src-tauri && cargo test preferences_runtime -- --nocapture`
- Expected: FAIL (currently always hides)

**Step 3: Implement runtime enforcement**
- In close handler, read preferences and:
- if `run_in_background=true`: hide + prevent close
- else: allow close
- Add explicit TODO or implementation path for `start_on_boot` via platform integration.

**Step 4: Run tests to verify pass**
- Run: `cd src-tauri && cargo test preferences_runtime -- --nocapture`
- Expected: PASS

**Step 5: Commit**
```bash
git add src-tauri/src/lib.rs src-tauri/src/commands/preferences.rs src/context/SettingsContext.tsx src-tauri/tests/integration/preferences_runtime_tests.rs
git commit -m "fix: enforce runtime behavior for background and startup preferences"
```

---

### Task 9: Restore benchmark build health

**Files:**
- Modify: `src-tauri/benches/database_benchmarks.rs`
- Modify: `src-tauri/benches/file_service_benchmark.rs`
- Modify: `src-tauri/benches/index_benchmark.rs`
- Modify: `src-tauri/benches/ipc_benchmarks.rs`

**Step 1: Write/adjust compile gate check**
- Add a local check step to CI docs or script notes to run bench compile.

**Step 2: Reproduce failure**
- Run: `cd src-tauri && cargo bench --no-run`
- Expected: FAIL on mutable `conn` and deprecation warnings

**Step 3: Implement fixes**
- Make `conn` mutable where transactions are created.
- Replace `criterion::black_box` with `std::hint::black_box`.

**Step 4: Verify pass**
- Run: `cd src-tauri && cargo bench --no-run`
- Expected: PASS

**Step 5: Commit**
```bash
git add src-tauri/benches/database_benchmarks.rs src-tauri/benches/file_service_benchmark.rs src-tauri/benches/index_benchmark.rs src-tauri/benches/ipc_benchmarks.rs
git commit -m "fix: make benchmark targets compile and remove deprecated black_box"
```

---

### Task 10: Fix Linux compile defect in platform utility

**Files:**
- Modify: `src-tauri/src/utils/platform.rs`
- Create: `src-tauri/tests/integration/platform_linux_compile_tests.rs` (optional)

**Step 1: Add failing compile check (targeted)**
- Use Linux target check in CI/local script if available.

**Step 2: Reproduce defect**
- Run: `cd src-tauri && cargo check --target x86_64-unknown-linux-gnu`
- Expected: fail in linux path branch due missing `Path` import (if target installed)

**Step 3: Implement minimal fix**
- Add `use std::path::Path;` in `platform.rs` and keep function signatures unchanged.

**Step 4: Verify pass**
- Run: `cd src-tauri && cargo check --target x86_64-unknown-linux-gnu`
- Expected: PASS (target/toolchain permitting)

**Step 5: Commit**
```bash
git add src-tauri/src/utils/platform.rs src-tauri/tests/integration/platform_linux_compile_tests.rs
git commit -m "fix: resolve linux compile path in platform mount utilities"
```

---

### Task 11: Align CI quality gates with real risk surface

**Files:**
- Modify: `.github/workflows/lint.yml`
- Modify: `.github/workflows/test.yml`
- Modify: `docs/guides/TESTING_STRATEGY.md`

**Step 1: Add failing local mirror command list**
- Document exact commands to mirror CI.

**Step 2: Reproduce current mismatch**
- Run: `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings`
- Expected: FAIL (currently not in CI gate)

**Step 3: Implement CI updates**
- Update backend lint job to include all targets/features, or explicitly add separate strict job.
- Keep runtime acceptable by excluding heavy jobs only with documented rationale.

**Step 4: Verify workflow syntax and local commands**
- Run: `npm run lint && npm run typecheck && npm test -- --run && npm run test:rust`
- Run: `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings`

**Step 5: Commit**
```bash
git add .github/workflows/lint.yml .github/workflows/test.yml docs/guides/TESTING_STRATEGY.md
git commit -m "ci: align rust quality gates with all targets and features"
```

---

## Final Verification Checklist

Run in order after Task 11:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run test:rust
cd src-tauri && cargo bench --no-run
cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings
```

Expected:
- Frontend lint/type/tests pass.
- Rust tests pass.
- Bench compile succeeds.
- Clippy strict gate succeeds.
- Manual sanity checks confirm:
- cloud job save + run uses rclone
- local job save + run uses rsync
- scheduled job executes at cron trigger
- notification test reflects true backend status
- run-in-background preference changes close behavior
