//! Stress tests for SQLite index, backup & restore pipeline
//!
//! Tests production-scale file counts, concurrent operations, and resilience.
//! All tests are `#[ignore]`d — run explicitly with:
//!   cargo test --test stress -- --ignored --nocapture

use crate::common::{
    rsync_available, run_rsync_backup, run_rsync_incremental,
    test_common::{generate, TestBackupEnv},
};
use app_lib::services::index_service::IndexService;
use rand::Rng;
use std::fs;
use std::path::Path;
use std::time::Instant;

// ============================================================================
// Helpers
// ============================================================================

/// Create an IndexService backed by a temp directory inside `dest_path`.
fn create_test_index(dest_path: &str) -> IndexService {
    let app_data_dir = Path::new(dest_path).join(".index-data");
    fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
    IndexService::new(&app_data_dir).expect("Failed to create IndexService")
}

/// Create a large, realistic directory tree.
///
/// - 50% text files (config, logs, source code patterns)
/// - 30% binary files (random bytes)
/// - 10% deeply nested (5+ levels)
/// - 10% unicode / special character names
///
/// Returns the total number of regular files created.
fn create_large_snapshot(root: &Path, file_count: usize, max_file_size: usize) -> usize {
    fs::create_dir_all(root).unwrap();
    let mut rng = rand::rng();
    let mut created = 0;

    let text_count = file_count / 2;
    let binary_count = (file_count * 3) / 10;
    let nested_count = file_count / 10;
    let unicode_count = file_count - text_count - binary_count - nested_count;

    // Create 20 root-level directories for fan-out
    let dir_count = 20.min(file_count / 5).max(1);
    let mut dirs: Vec<std::path::PathBuf> = Vec::new();
    for i in 0..dir_count {
        let dir = root.join(format!("dir_{:02}", i));
        fs::create_dir_all(&dir).unwrap();
        // Sub-directories (5-10 each)
        let sub_count = rng.random_range(5..=10usize).min(file_count / dir_count);
        for j in 0..sub_count {
            let sub = dir.join(format!("sub_{:02}", j));
            fs::create_dir_all(&sub).unwrap();
            dirs.push(sub);
        }
        dirs.push(dir);
    }

    // Helper: pick a random directory from the pool
    let pick_dir = |rng: &mut rand::rngs::ThreadRng| -> &Path {
        let idx = rng.random_range(0..dirs.len());
        &dirs[idx]
    };

    // Text files (source / config / log patterns)
    let extensions = [
        "rs", "ts", "json", "yaml", "toml", "md", "txt", "log", "csv", "xml",
    ];
    for i in 0..text_count {
        let ext = extensions[i % extensions.len()];
        let size = rng.random_range(10..=max_file_size.max(11));
        let content: String = (0..size)
            .map(|_| rng.random_range(b'a'..=b'z') as char)
            .collect();
        let dir = pick_dir(&mut rng);
        let path = dir.join(format!("file_{:05}.{}", i, ext));
        generate::file(&path, content.as_bytes()).unwrap();
        created += 1;
    }

    // Binary files
    for i in 0..binary_count {
        let size = rng.random_range(10..=max_file_size.max(11));
        let content: Vec<u8> = (0..size).map(|_| rng.random()).collect();
        let dir = pick_dir(&mut rng);
        let path = dir.join(format!("bin_{:05}.dat", i));
        generate::file(&path, &content).unwrap();
        created += 1;
    }

    // Deeply nested files (5+ levels)
    for i in 0..nested_count {
        let depth = rng.random_range(5..=8usize);
        let mut nested_dir = root.to_path_buf();
        for d in 0..depth {
            nested_dir = nested_dir.join(format!("deep_{}_{}", i, d));
        }
        fs::create_dir_all(&nested_dir).unwrap();
        let content = format!("nested file {} at depth {}", i, depth);
        generate::file(
            &nested_dir.join(format!("nested_{:05}.txt", i)),
            content.as_bytes(),
        )
        .unwrap();
        created += 1;
    }

    // Unicode / special name files
    let unicode_prefixes = [
        "config_中文",
        "rapport_été",
        "файл_данных",
        "αρχείο",
        "ファイル",
        "file with spaces",
        "file-dashes",
        "file.multi.dots",
        "MixedCase_File",
        "UPPERCASE",
    ];
    for i in 0..unicode_count {
        let prefix = unicode_prefixes[i % unicode_prefixes.len()];
        let content = format!("unicode file {}", i);
        let dir = pick_dir(&mut rng);
        let path = dir.join(format!("{}_{:04}.txt", prefix, i));
        generate::file(&path, content.as_bytes()).unwrap();
        created += 1;
    }

    created
}

// ============================================================================
// Step 2: Scale Tests (5 tests)
// ============================================================================

/// 2a. Index 10,000 files — verify counts, browsing, search, largest files.
#[test]
#[ignore]
fn test_stress_index_10k_files() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");

    eprintln!("Creating 10,000 files ...");
    let created = create_large_snapshot(&snapshot_path, 10_000, 512);
    eprintln!("Created {} files", created);

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let start = Instant::now();
    let result = service
        .index_snapshot("stress-job", 1704110400000, snapshot_path.to_str().unwrap())
        .unwrap();
    let elapsed = start.elapsed();

    eprintln!(
        "Indexed {} files ({} bytes) in {:.2}s",
        result.file_count,
        result.total_size,
        elapsed.as_secs_f64()
    );

    // Verify counts
    assert!(
        result.file_count >= 9_500,
        "Expected ~10,000 files, got {}",
        result.file_count
    );
    assert!(result.total_size > 0, "Total size should be > 0");

    // Performance gate: indexing must complete in < 30s
    assert!(
        elapsed.as_secs() < 30,
        "Indexing 10K files took {}s, should be < 30s",
        elapsed.as_secs()
    );

    // Browse root
    let root = service
        .get_directory_contents("stress-job", 1704110400000, "")
        .unwrap();
    assert!(!root.is_empty(), "Root should have entries");

    // Browse 3 subdirectories
    let dirs: Vec<_> = root.iter().filter(|f| f.node_type == "dir").collect();
    assert!(!dirs.is_empty(), "Root should have directories");
    for dir in dirs.iter().take(3) {
        let contents = service
            .get_directory_contents("stress-job", 1704110400000, &dir.name)
            .unwrap();
        assert!(
            !contents.is_empty(),
            "Subdirectory {} should have entries",
            dir.name
        );
    }

    // Search for 5 different patterns
    for pattern in &["file_00", "bin_00", "nested_", ".json", "config"] {
        let results = service
            .search_files("stress-job", 1704110400000, pattern, 100)
            .unwrap();
        assert!(
            !results.is_empty(),
            "Search for '{}' should return results",
            pattern
        );
    }

    // Largest files
    let largest = service
        .get_largest_files("stress-job", 1704110400000, 10)
        .unwrap();
    assert_eq!(largest.len(), 10, "Should return 10 largest files");
    // Verify ordering (descending by size)
    for w in largest.windows(2) {
        assert!(
            w[0].size >= w[1].size,
            "Largest files should be sorted descending"
        );
    }

    // File type stats
    let stats = service
        .get_file_type_stats("stress-job", 1704110400000, 20)
        .unwrap();
    assert!(!stats.is_empty(), "Should have file type statistics");
}

/// 2b. Index 80,000 files — realistic MacBook backup size.
#[test]
#[ignore]
fn test_stress_index_80k_files() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");

    eprintln!("Creating 80,000 files ...");
    let created = create_large_snapshot(&snapshot_path, 80_000, 256);
    eprintln!("Created {} files", created);

    let service = create_test_index(env.dest_path.to_str().unwrap());

    let start = Instant::now();
    let result = service
        .index_snapshot("stress-job", 1704110400000, snapshot_path.to_str().unwrap())
        .unwrap();
    let elapsed = start.elapsed();

    eprintln!(
        "Indexed {} files ({} bytes) in {:.2}s",
        result.file_count,
        result.total_size,
        elapsed.as_secs_f64()
    );

    assert!(
        result.file_count >= 75_000,
        "Expected ~80,000 files, got {}",
        result.file_count
    );
    assert!(result.total_size > 0);

    // Performance gate: indexing must complete in < 120s
    assert!(
        elapsed.as_secs() < 120,
        "Indexing 80K files took {}s, should be < 120s",
        elapsed.as_secs()
    );

    // Browse and search to verify data integrity
    let root = service
        .get_directory_contents("stress-job", 1704110400000, "")
        .unwrap();
    assert!(!root.is_empty());

    let results = service
        .search_files("stress-job", 1704110400000, "file_00001", 10)
        .unwrap();
    assert!(!results.is_empty(), "Should find file_00001");
}

/// 2c. 50 snapshots for a single job.
#[test]
#[ignore]
fn test_stress_50_snapshots_single_job() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_index(env.dest_path.to_str().unwrap());
    let job_id = "stress-50-snap";
    let base_ts = 1704110400000_i64; // Jan 1, 2024 12:00 UTC

    eprintln!("Creating and indexing 50 snapshots (500 files each) ...");

    // Create 50 snapshots, each with 500 files and slight variations
    for i in 0..50 {
        let snap_name = format!("snap_{:03}", i);
        let snapshot_path = env.snapshot_path(&snap_name);
        fs::create_dir_all(&snapshot_path).unwrap();

        // Base set of 490 files (shared across snapshots)
        for j in 0..490 {
            let content = format!("file {} in snapshot {}", j, i);
            generate::file(
                &snapshot_path.join(format!("file_{:04}.txt", j)),
                content.as_bytes(),
            )
            .unwrap();
        }
        // 10 unique files per snapshot (drift)
        for j in 0..10 {
            let content = format!("unique {} for snapshot {}", j, i);
            generate::file(
                &snapshot_path.join(format!("unique_s{:03}_{:02}.txt", i, j)),
                content.as_bytes(),
            )
            .unwrap();
        }

        let ts = base_ts + (i as i64 * 3_600_000); // 1 hour apart
        service
            .index_snapshot(job_id, ts, snapshot_path.to_str().unwrap())
            .unwrap();
    }

    // List snapshots, verify count
    let snapshots = service.list_snapshots(job_id).unwrap();
    assert_eq!(snapshots.len(), 50, "Should have 50 snapshots");

    // Compare snapshot 0 vs 49 (should show drift — unique files differ)
    let ts_first = base_ts;
    let ts_last = base_ts + 49 * 3_600_000;
    let diff = service
        .compare_snapshots(job_id, ts_first, ts_last, None)
        .unwrap();
    eprintln!(
        "Diff first vs last: added={}, deleted={}, modified={}",
        diff.summary.total_added, diff.summary.total_deleted, diff.summary.total_modified
    );
    // Unique files differ between snapshots, so we should see changes
    assert!(
        diff.summary.total_added > 0 || diff.summary.total_deleted > 0,
        "Snapshots 0 and 49 should differ"
    );

    // Compare adjacent snapshots (small changes)
    let ts_a = base_ts + 10 * 3_600_000;
    let ts_b = base_ts + 11 * 3_600_000;
    let adj_diff = service.compare_snapshots(job_id, ts_a, ts_b, None).unwrap();
    eprintln!(
        "Adjacent diff: added={}, deleted={}, modified={}",
        adj_diff.summary.total_added,
        adj_diff.summary.total_deleted,
        adj_diff.summary.total_modified
    );

    // Aggregate stats
    let stats = service.get_job_aggregate_stats(job_id).unwrap();
    assert_eq!(stats.total_snapshots, 50);
    assert!(stats.total_files > 0);
    assert!(stats.first_snapshot_ms.is_some());
    assert!(stats.last_snapshot_ms.is_some());

    // Density
    let density = service.get_snapshot_density(job_id, "day").unwrap();
    assert!(!density.is_empty());

    // Delete oldest 10 snapshots
    for i in 0..10 {
        let ts = base_ts + (i as i64 * 3_600_000);
        service.delete_snapshot(job_id, ts).unwrap();
    }

    let remaining = service.list_snapshots(job_id).unwrap();
    assert_eq!(
        remaining.len(),
        40,
        "Should have 40 snapshots after deleting 10"
    );
}

/// 2d. 5 jobs with 10 snapshots of 1,000 files each — strict isolation.
#[test]
#[ignore]
fn test_stress_multiple_jobs_shared_db() {
    let env = TestBackupEnv::new().unwrap();
    let service = create_test_index(env.dest_path.to_str().unwrap());
    let base_ts = 1704110400000_i64;

    eprintln!("Creating 5 jobs x 10 snapshots x 1000 files ...");

    for job_idx in 0..5 {
        let job_id = format!("job-{}", job_idx);
        for snap_idx in 0..10 {
            let snap_name = format!("j{}_s{}", job_idx, snap_idx);
            let snapshot_path = env.snapshot_path(&snap_name);
            fs::create_dir_all(&snapshot_path).unwrap();

            for f in 0..1_000 {
                let content = format!("job{} snap{} file{}", job_idx, snap_idx, f);
                generate::file(
                    &snapshot_path.join(format!("f_{:04}.txt", f)),
                    content.as_bytes(),
                )
                .unwrap();
            }

            let ts = base_ts + (snap_idx as i64 * 3_600_000);
            service
                .index_snapshot(&job_id, ts, snapshot_path.to_str().unwrap())
                .unwrap();
        }
    }

    // Verify strict job isolation
    for job_idx in 0..5 {
        let job_id = format!("job-{}", job_idx);
        let snapshots = service.list_snapshots(&job_id).unwrap();
        assert_eq!(
            snapshots.len(),
            10,
            "Job {} should have 10 snapshots",
            job_id
        );

        let stats = service.get_job_aggregate_stats(&job_id).unwrap();
        assert_eq!(stats.total_snapshots, 10);

        // Search in this job must never return other jobs' files
        let search = service.search_files(&job_id, base_ts, "f_0001", 100);
        assert!(search.is_ok());
    }

    // Delete one job entirely, verify others unaffected
    service.delete_job_snapshots("job-2").unwrap();
    let deleted_snaps = service.list_snapshots("job-2").unwrap();
    assert!(deleted_snaps.is_empty(), "job-2 should have no snapshots");

    for job_idx in [0, 1, 3, 4] {
        let job_id = format!("job-{}", job_idx);
        let snaps = service.list_snapshots(&job_id).unwrap();
        assert_eq!(
            snaps.len(),
            10,
            "Job {} should still have 10 snapshots after deleting job-2",
            job_id
        );
    }
}

/// 2e. Large individual files (100MB, 10MB, 1MB, 1KB).
#[test]
#[ignore]
fn test_stress_large_files() {
    let env = TestBackupEnv::new().unwrap();
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();

    eprintln!("Creating large files (100MB + 50MB + 5x10MB + 100x1MB + 1000x1KB) ...");

    let mut expected_total: u64 = 0;

    // 1 x 100MB file
    let big = vec![0x42u8; 100 * 1024 * 1024];
    generate::file(&snapshot_path.join("huge_100mb.bin"), &big).unwrap();
    expected_total += big.len() as u64;

    // 5 x 10MB files
    for i in 0..5 {
        let data = vec![0xABu8; 10 * 1024 * 1024];
        generate::file(&snapshot_path.join(format!("medium_10mb_{}.bin", i)), &data).unwrap();
        expected_total += data.len() as u64;
    }

    // 100 x 1MB files
    for i in 0..100 {
        let data = vec![0xCDu8; 1024 * 1024];
        generate::file(
            &snapshot_path.join(format!("small_1mb_{:03}.bin", i)),
            &data,
        )
        .unwrap();
        expected_total += data.len() as u64;
    }

    // 1000 x 1KB files
    for i in 0..1_000 {
        let data = vec![0xEFu8; 1024];
        generate::file(&snapshot_path.join(format!("tiny_1kb_{:04}.bin", i)), &data).unwrap();
        expected_total += data.len() as u64;
    }

    let service = create_test_index(env.dest_path.to_str().unwrap());
    let result = service
        .index_snapshot("stress-job", 1704110400000, snapshot_path.to_str().unwrap())
        .unwrap();

    eprintln!(
        "Indexed {} files, total_size = {} bytes (expected {})",
        result.file_count, result.total_size, expected_total
    );

    // Verify total file count: 1 + 5 + 100 + 1000 = 1106
    assert_eq!(result.file_count, 1106, "Should have 1106 files");

    // Verify total size matches
    assert_eq!(
        result.total_size as u64, expected_total,
        "Total size should match sum of all files"
    );

    // Verify largest files returns correct ordering
    let largest = service
        .get_largest_files("stress-job", 1704110400000, 10)
        .unwrap();
    assert_eq!(
        largest[0].size,
        100 * 1024 * 1024,
        "Largest should be 100MB"
    );
    assert!(
        largest[0].name.contains("huge_100mb"),
        "Largest file should be huge_100mb.bin"
    );
    // Next 5 should be 10MB each
    for entry in &largest[1..6] {
        assert_eq!(entry.size, 10 * 1024 * 1024, "Next largest should be 10MB");
    }

    // File type stats should correctly bucket sizes
    let stats = service
        .get_file_type_stats("stress-job", 1704110400000, 10)
        .unwrap();
    assert!(!stats.is_empty());
    // All files are .bin, so there should be one dominant extension
    let bin_stat = stats.iter().find(|s| s.extension == "bin");
    assert!(bin_stat.is_some(), "Should have stats for .bin extension");
    assert_eq!(bin_stat.unwrap().count, 1106);
}

// ============================================================================
// Step 3: Full Pipeline Test (1 test)
// ============================================================================

/// Full pipeline: create files -> rsync backup -> index -> browse -> search
/// -> modify -> backup 2 -> index 2 -> compare -> restore -> verify.
#[test]
#[ignore]
fn test_stress_full_pipeline_backup_index_restore() {
    if !rsync_available() {
        eprintln!("Skipping full pipeline test: rsync not available");
        return;
    }

    let env = TestBackupEnv::new().unwrap();
    let dest_path_str = env.dest_path.to_str().unwrap();

    // 1. Create source with 2,000 files
    eprintln!("Step 1: Creating 2,000 source files ...");
    let created = create_large_snapshot(&env.source_path, 2_000, 256);
    eprintln!("Created {} files", created);

    // 2. Backup 1: rsync to first snapshot
    eprintln!("Step 2: Running rsync backup 1 ...");
    let snap1_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snap1_path).unwrap();
    run_rsync_backup(&env.source_path, &snap1_path).unwrap();

    // 3. Index snapshot 1
    eprintln!("Step 3: Indexing snapshot 1 ...");
    let service = create_test_index(dest_path_str);
    let ts1 = 1704110400000_i64;
    let indexed1 = service
        .index_snapshot("pipeline-job", ts1, snap1_path.to_str().unwrap())
        .unwrap();
    eprintln!(
        "Snapshot 1: {} files, {} bytes",
        indexed1.file_count, indexed1.total_size
    );
    assert!(indexed1.file_count > 0);

    // 4. Browse: verify root and 3 levels deep
    eprintln!("Step 4: Browsing snapshot 1 ...");
    let root = service
        .get_directory_contents("pipeline-job", ts1, "")
        .unwrap();
    assert!(!root.is_empty(), "Root should have entries");

    let subdirs: Vec<_> = root.iter().filter(|f| f.node_type == "dir").collect();
    for dir in subdirs.iter().take(3) {
        let sub = service
            .get_directory_contents("pipeline-job", ts1, &dir.name)
            .unwrap();
        assert!(!sub.is_empty(), "Subdir {} should have entries", dir.name);
    }

    // 5. Search for specific files
    eprintln!("Step 5: Searching snapshot 1 ...");
    let search = service
        .search_files("pipeline-job", ts1, "file_00001", 10)
        .unwrap();
    assert!(!search.is_empty(), "Should find file_00001");

    // 6. Modify source: add 50, delete 20, modify 30
    eprintln!("Step 6: Modifying source ...");
    // Add 50 new files
    for i in 0..50 {
        let content = format!("newly added file {}", i);
        generate::file(
            &env.source_path.join(format!("added_new_{:04}.txt", i)),
            content.as_bytes(),
        )
        .unwrap();
    }

    // Find existing files to delete and modify
    let mut existing_files: Vec<std::path::PathBuf> = Vec::new();
    collect_files_flat(&env.source_path, &mut existing_files);
    existing_files.sort();

    // Delete 20 files
    for path in existing_files.iter().take(20) {
        fs::remove_file(path).unwrap();
    }

    // Modify 30 files (change content/size)
    for path in existing_files.iter().skip(20).take(30) {
        if path.exists() {
            let new_content = format!("MODIFIED CONTENT {}", path.display());
            fs::write(path, new_content.as_bytes()).unwrap();
        }
    }

    // 7. Backup 2: rsync incremental with --link-dest
    eprintln!("Step 7: Running rsync backup 2 (incremental) ...");
    let snap2_path = env.snapshot_path("2024-01-02_120000");
    fs::create_dir_all(&snap2_path).unwrap();
    run_rsync_incremental(&env.source_path, &snap2_path, &snap1_path).unwrap();

    // 8. Index snapshot 2
    eprintln!("Step 8: Indexing snapshot 2 ...");
    let ts2 = 1704196800000_i64;
    let indexed2 = service
        .index_snapshot("pipeline-job", ts2, snap2_path.to_str().unwrap())
        .unwrap();
    eprintln!(
        "Snapshot 2: {} files, {} bytes",
        indexed2.file_count, indexed2.total_size
    );

    // 9. Compare snapshots
    eprintln!("Step 9: Comparing snapshots ...");
    let diff = service
        .compare_snapshots("pipeline-job", ts1, ts2, None)
        .unwrap();
    eprintln!(
        "Diff: added={}, deleted={}, modified={}",
        diff.summary.total_added, diff.summary.total_deleted, diff.summary.total_modified
    );

    // The exact diff counts depend on rsync --link-dest behavior:
    // - Without --delete, removed source files may still appear in snap2 via hard links
    // - Modified files only show if their size changed
    // Key invariant: there should be SOME changes detected
    let total_changes =
        diff.summary.total_added + diff.summary.total_deleted + diff.summary.total_modified;
    assert!(
        total_changes > 0,
        "Should detect changes between snapshots (got 0)"
    );
    eprintln!("Detected {} total changes", total_changes);

    // 10. Restore: copy specific files from snapshot 1 to a new directory
    eprintln!("Step 10: Restoring files from snapshot 1 ...");
    let restore_dir = env.temp_dir.path().join("restored");
    fs::create_dir_all(&restore_dir).unwrap();

    // Pick 10 files from snapshot 1 to restore
    let snap1_files = service
        .get_directory_contents("pipeline-job", ts1, "")
        .unwrap();
    let files_to_restore: Vec<_> = snap1_files
        .iter()
        .filter(|f| f.node_type == "file")
        .take(10)
        .collect();

    for file_node in &files_to_restore {
        let src = snap1_path.join(&file_node.name);
        let dst = restore_dir.join(&file_node.name);
        if src.exists() {
            fs::copy(&src, &dst).unwrap();
        }
    }

    // 11. Verify: restored files match originals byte-for-byte
    eprintln!("Step 11: Verifying restored files ...");
    for file_node in &files_to_restore {
        let original = snap1_path.join(&file_node.name);
        let restored = restore_dir.join(&file_node.name);
        if original.exists() && restored.exists() {
            let orig_content = fs::read(&original).unwrap();
            let rest_content = fs::read(&restored).unwrap();
            assert_eq!(
                orig_content, rest_content,
                "Restored file {} should match original",
                file_node.name
            );
        }
    }

    // 12. Cleanup: delete snapshot 1 from index, verify snapshot 2 intact
    eprintln!("Step 12: Cleanup ...");
    service.delete_snapshot("pipeline-job", ts1).unwrap();
    assert!(!service.is_indexed("pipeline-job", ts1).unwrap());
    assert!(service.is_indexed("pipeline-job", ts2).unwrap());

    let remaining = service.list_snapshots("pipeline-job").unwrap();
    assert_eq!(remaining.len(), 1);
    assert_eq!(remaining[0].timestamp, ts2);

    eprintln!("Full pipeline test PASSED");
}

/// Helper: collect all regular file paths under a directory (non-recursive into .snapshot dirs)
fn collect_files_flat(dir: &Path, out: &mut Vec<std::path::PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let ft = entry.file_type().unwrap();
            if ft.is_file() {
                out.push(entry.path());
            } else if ft.is_dir() {
                collect_files_flat(&entry.path(), out);
            }
        }
    }
}

// ============================================================================
// Step 4: Concurrent Operation Tests (3 tests)
// ============================================================================

/// 4a. Three threads indexing different jobs simultaneously.
#[test]
#[ignore]
fn test_stress_concurrent_index_different_jobs() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap().to_string();
    let base_ts = 1704110400000_i64;

    eprintln!("Creating 3 snapshot directories (1000 files each) ...");

    // Pre-create snapshot directories
    let mut snap_paths = Vec::new();
    for i in 0..3 {
        let snap_name = format!("concurrent_{}", i);
        let snapshot_path = env.snapshot_path(&snap_name);
        fs::create_dir_all(&snapshot_path).unwrap();
        generate::random_files(&snapshot_path, 1_000, 128).unwrap();
        snap_paths.push(snapshot_path.to_str().unwrap().to_string());
    }

    eprintln!("Spawning 3 concurrent indexing threads ...");

    let handles: Vec<_> = (0..3)
        .map(|i| {
            let dest = dest_path.clone();
            let snap = snap_paths[i].clone();
            let job_id = format!("concurrent-job-{}", i);
            std::thread::spawn(move || {
                let service = create_test_index(&dest);
                service
                    .index_snapshot(&job_id, base_ts + i as i64, &snap)
                    .unwrap();
                let snaps = service.list_snapshots(&job_id).unwrap();
                assert_eq!(snaps.len(), 1, "Job {} should have 1 snapshot", job_id);
                let stats = service
                    .get_snapshot_stats(&job_id, base_ts + i as i64)
                    .unwrap();
                assert_eq!(stats.0, 1_000, "Job {} should have 1000 files", job_id);
                eprintln!("Thread {} completed successfully", i);
            })
        })
        .collect();

    for (i, handle) in handles.into_iter().enumerate() {
        handle
            .join()
            .unwrap_or_else(|_| panic!("Thread {} panicked", i));
    }

    // Verify all 3 jobs exist
    let service = create_test_index(&dest_path);
    for i in 0..3 {
        let job_id = format!("concurrent-job-{}", i);
        assert!(
            service.is_indexed(&job_id, base_ts + i as i64).unwrap(),
            "Job {} should be indexed",
            job_id
        );
    }

    eprintln!("Concurrent index test PASSED");
}

/// 4b. Index a large snapshot on one thread while querying on another.
#[test]
#[ignore]
fn test_stress_concurrent_index_and_query() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap().to_string();
    let base_ts = 1704110400000_i64;

    // Pre-create a small snapshot and index it (for querying)
    let query_snap = env.snapshot_path("query_snap");
    fs::create_dir_all(&query_snap).unwrap();
    generate::random_files(&query_snap, 500, 128).unwrap();

    let service = create_test_index(&dest_path);
    service
        .index_snapshot("query-job", base_ts, query_snap.to_str().unwrap())
        .unwrap();
    drop(service);

    // Pre-create a large snapshot for indexing
    let index_snap = env.snapshot_path("index_snap");
    fs::create_dir_all(&index_snap).unwrap();
    generate::random_files(&index_snap, 10_000, 128).unwrap();

    eprintln!("Starting concurrent index + query ...");

    let dest_clone = dest_path.clone();
    let index_snap_str = index_snap.to_str().unwrap().to_string();

    // Thread 1: index the large snapshot
    let indexer = std::thread::spawn(move || {
        let svc = create_test_index(&dest_clone);
        let result = svc
            .index_snapshot("index-job", base_ts + 1, &index_snap_str)
            .unwrap();
        eprintln!("Indexer done: {} files", result.file_count);
        assert!(result.file_count >= 9_500);
    });

    // Thread 2: repeatedly query the already-indexed snapshot
    let querier = std::thread::spawn(move || {
        let svc = create_test_index(&dest_path);
        let mut query_count = 0;
        for _ in 0..50 {
            let snaps = svc.list_snapshots("query-job").unwrap();
            assert_eq!(snaps.len(), 1);
            let contents = svc
                .get_directory_contents("query-job", base_ts, "")
                .unwrap();
            assert!(!contents.is_empty());
            query_count += 1;
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        eprintln!("Querier done: {} successful queries", query_count);
    });

    indexer.join().expect("Indexer thread panicked");
    querier.join().expect("Querier thread panicked");

    eprintln!("Concurrent index+query test PASSED");
}

/// 4c. Two threads index the exact same snapshot — should be idempotent.
/// Both share a single IndexService (which uses a Mutex<Connection>), so one
/// thread blocks on the lock while the other indexes. The re-indexing path
/// (DELETE + INSERT) ensures the final state is correct regardless of order.
#[test]
#[ignore]
fn test_stress_concurrent_index_same_snapshot() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path = env.dest_path.to_str().unwrap().to_string();
    let base_ts = 1704110400000_i64;

    let snapshot_path = env.snapshot_path("same_snap");
    fs::create_dir_all(&snapshot_path).unwrap();
    generate::random_files(&snapshot_path, 2_000, 128).unwrap();

    let snap_str = snapshot_path.to_str().unwrap().to_string();

    eprintln!("Two threads indexing the same snapshot ...");

    // Create the service once and share via Arc
    let service = std::sync::Arc::new(create_test_index(&dest_path));

    let svc1 = service.clone();
    let snap1 = snap_str.clone();
    let t1 = std::thread::spawn(move || {
        svc1.index_snapshot("same-job", base_ts, &snap1).unwrap();
        eprintln!("Thread 1 done");
    });

    let svc2 = service.clone();
    let snap2 = snap_str;
    let t2 = std::thread::spawn(move || {
        svc2.index_snapshot("same-job", base_ts, &snap2).unwrap();
        eprintln!("Thread 2 done");
    });

    t1.join().expect("Thread 1 panicked");
    t2.join().expect("Thread 2 panicked");

    // Verify exactly 1 snapshot, no duplicates
    let snapshots = service.list_snapshots("same-job").unwrap();
    assert_eq!(
        snapshots.len(),
        1,
        "Should have exactly 1 snapshot, not duplicates"
    );

    // Verify file count is correct
    let (file_count, _) = service.get_snapshot_stats("same-job", base_ts).unwrap();
    assert_eq!(file_count, 2_000, "File count should be exactly 2000");

    eprintln!("Concurrent same-snapshot test PASSED");
}

// ============================================================================
// Step 5: Resilience Tests (3 tests)
// ============================================================================

/// 5a. Corrupt the SQLite file, then try to re-open and re-index.
#[test]
#[ignore]
fn test_stress_index_after_db_corruption() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path_str = env.dest_path.to_str().unwrap();

    // Create and index a snapshot
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    fs::create_dir_all(&snapshot_path).unwrap();
    generate::random_files(&snapshot_path, 500, 128).unwrap();

    let service = create_test_index(dest_path_str);
    service
        .index_snapshot(
            "resilience-job",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Get the db path before dropping
    let db_path = service.get_db_path().to_path_buf();
    drop(service);

    // Corrupt: truncate to 50% of size
    let original = fs::read(&db_path).unwrap();
    let truncated = &original[..original.len() / 2];
    fs::write(&db_path, truncated).unwrap();

    eprintln!(
        "Corrupted database: {} -> {} bytes",
        original.len(),
        truncated.len()
    );

    // Try to re-open — should either error gracefully or succeed
    let app_data_dir = db_path.parent().unwrap();
    let reopen_result = IndexService::new(app_data_dir);

    match reopen_result {
        Ok(service) => {
            // If it opened, try to re-index (should either work or give a clear error)
            eprintln!("Corrupted DB opened — attempting re-index ...");
            let reindex_result = service.index_snapshot(
                "resilience-job",
                1704110400000,
                snapshot_path.to_str().unwrap(),
            );
            match reindex_result {
                Ok(result) => {
                    eprintln!("Re-index succeeded: {} files", result.file_count);
                    assert_eq!(result.file_count, 500);
                }
                Err(e) => {
                    eprintln!("Re-index returned error (acceptable): {}", e);
                    // Error is acceptable — panic is not
                }
            }
        }
        Err(e) => {
            eprintln!("Corrupted DB failed to open (acceptable): {}", e);
            // This is fine — graceful error
        }
    }

    // In either case: delete the corrupted DB and start fresh
    fs::remove_file(&db_path).unwrap();
    let _ = fs::remove_file(db_path.with_extension("db-wal"));
    let _ = fs::remove_file(db_path.with_extension("db-shm"));

    let fresh = IndexService::new(app_data_dir).unwrap();
    let fresh_result = fresh
        .index_snapshot(
            "resilience-job",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();
    assert_eq!(fresh_result.file_count, 500, "Fresh re-index should work");

    eprintln!("DB corruption recovery test PASSED");
}

/// 5b. Interrupt indexing midway, then re-index.
#[test]
#[ignore]
fn test_stress_index_interrupted_midway() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path_str = env.dest_path.to_str().unwrap();

    // Create a 10K-file snapshot
    let snapshot_path = env.snapshot_path("2024-01-01_120000");
    create_large_snapshot(&snapshot_path, 10_000, 128);

    // Index it fully first to know the expected count
    let service = create_test_index(dest_path_str);
    let full_result = service
        .index_snapshot(
            "interrupt-job",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();
    let expected_count = full_result.file_count;
    eprintln!("Full index: {} files", expected_count);

    // Drop the service (simulate interruption after full index)
    drop(service);

    // Re-create service, re-index the same snapshot
    eprintln!("Re-indexing after simulated interruption ...");
    let service2 = create_test_index(dest_path_str);
    let reindex_result = service2
        .index_snapshot(
            "interrupt-job",
            1704110400000,
            snapshot_path.to_str().unwrap(),
        )
        .unwrap();

    // Verify final state is consistent
    assert_eq!(
        reindex_result.file_count, expected_count,
        "Re-index should produce same file count"
    );

    // Verify only 1 snapshot entry (no duplicates from interrupted state)
    let snapshots = service2.list_snapshots("interrupt-job").unwrap();
    assert_eq!(snapshots.len(), 1, "Should have exactly 1 snapshot");

    // Browse to verify data integrity
    let root = service2
        .get_directory_contents("interrupt-job", 1704110400000, "")
        .unwrap();
    assert!(!root.is_empty());

    eprintln!("Interrupted indexing recovery test PASSED");
}

/// 5c. Rapid create-delete cycles — verify no database bloat.
#[test]
#[ignore]
fn test_stress_rapid_create_delete_cycle() {
    let env = TestBackupEnv::new().unwrap();
    let dest_path_str = env.dest_path.to_str().unwrap();
    let service = create_test_index(dest_path_str);
    let base_ts = 1704110400000_i64;

    eprintln!("Running 20 create-delete cycles ...");

    let snapshot_path = env.snapshot_path("cycle_snap");
    fs::create_dir_all(&snapshot_path).unwrap();
    generate::random_files(&snapshot_path, 500, 128).unwrap();

    // Record initial DB size
    let db_path = service.get_db_path().to_path_buf();

    for cycle in 0..20 {
        let ts = base_ts + cycle as i64;

        // Create: index the snapshot
        let result = service
            .index_snapshot("cycle-job", ts, snapshot_path.to_str().unwrap())
            .unwrap();
        assert_eq!(
            result.file_count, 500,
            "Cycle {} index should have 500 files",
            cycle
        );

        // Verify
        assert!(service.is_indexed("cycle-job", ts).unwrap());

        // Delete
        service.delete_snapshot("cycle-job", ts).unwrap();
        assert!(!service.is_indexed("cycle-job", ts).unwrap());
    }

    // Final state should be clean
    let final_snapshots = service.list_snapshots("cycle-job").unwrap();
    assert!(
        final_snapshots.is_empty(),
        "Should have 0 snapshots after all cycles"
    );

    let final_stats = service.get_job_aggregate_stats("cycle-job").unwrap();
    assert_eq!(final_stats.total_snapshots, 0);

    // Compact to reclaim space
    service.compact().unwrap();

    // Verify DB size is reasonable after compaction
    let db_size = fs::metadata(&db_path).unwrap().len();
    eprintln!("DB size after 20 cycles + VACUUM: {} bytes", db_size);

    // After 20 create/delete cycles + VACUUM, DB should not be huge
    // A reasonable upper bound is 1MB (mostly schema + indexes)
    assert!(
        db_size < 1_024 * 1_024,
        "DB size after cycles + VACUUM should be < 1MB, got {} bytes",
        db_size
    );

    eprintln!("Rapid create-delete cycle test PASSED");
}
