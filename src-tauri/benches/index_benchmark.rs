//! Benchmarks for IndexService performance
//!
//! Run with: cargo bench --bench index_benchmark

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use std::fs;
use tempfile::TempDir;

// Import the library
use app_lib::services::index_service::IndexService;

/// Create a test directory structure with the specified number of files
fn create_test_structure(dir: &TempDir, file_count: usize) {
    let base = dir.path();

    // Create nested directories: 10 dirs at root, 10 subdirs each
    let dirs_per_level = 10;
    let files_per_dir = file_count / (dirs_per_level * dirs_per_level);

    for i in 0..dirs_per_level {
        let level1 = base.join(format!("dir_{:02}", i));
        fs::create_dir_all(&level1).unwrap();

        for j in 0..dirs_per_level {
            let level2 = level1.join(format!("subdir_{:02}", j));
            fs::create_dir_all(&level2).unwrap();

            for k in 0..files_per_dir {
                let file_path = level2.join(format!("file_{:04}.txt", k));
                fs::write(&file_path, format!("Content for file {}", k)).unwrap();
            }
        }
    }
}

fn bench_index_snapshot(c: &mut Criterion) {
    let mut group = c.benchmark_group("index_snapshot");

    // Test with different file counts
    for file_count in [100, 1000, 10000].iter() {
        // Setup: Create temp directory structure
        let temp_dir = TempDir::new().unwrap();
        let db_dir = TempDir::new().unwrap();
        create_test_structure(&temp_dir, *file_count);

        // Create IndexService
        let index_service = IndexService::new(db_dir.path()).unwrap();

        group.throughput(Throughput::Elements(*file_count as u64));
        group.bench_with_input(
            BenchmarkId::new("files", file_count),
            file_count,
            |b, &_count| {
                b.iter(|| {
                    // Clean up previous index
                    let _ = index_service.delete_snapshot("bench-job", 12345);

                    // Index the snapshot
                    index_service
                        .index_snapshot(
                            black_box("bench-job"),
                            black_box(12345),
                            black_box(temp_dir.path().to_str().unwrap()),
                        )
                        .unwrap()
                });
            },
        );
    }

    group.finish();
}

fn bench_query_directory(c: &mut Criterion) {
    let mut group = c.benchmark_group("query_directory");

    // Setup: Create and index a 1000-file structure
    let temp_dir = TempDir::new().unwrap();
    let db_dir = TempDir::new().unwrap();
    create_test_structure(&temp_dir, 1000);

    let index_service = IndexService::new(db_dir.path()).unwrap();
    index_service
        .index_snapshot("bench-job", 12345, temp_dir.path().to_str().unwrap())
        .unwrap();

    // Benchmark directory queries
    group.bench_function("get_directory_contents", |b| {
        b.iter(|| {
            index_service
                .get_directory_contents("bench-job", 12345, black_box("/"))
                .unwrap()
        });
    });

    group.finish();
}

fn bench_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("search_files");

    // Setup: Create and index a 1000-file structure
    let temp_dir = TempDir::new().unwrap();
    let db_dir = TempDir::new().unwrap();
    create_test_structure(&temp_dir, 1000);

    let index_service = IndexService::new(db_dir.path()).unwrap();
    index_service
        .index_snapshot("bench-job", 12345, temp_dir.path().to_str().unwrap())
        .unwrap();

    // Benchmark file search
    group.bench_function("search_pattern", |b| {
        b.iter(|| {
            index_service
                .search_files("bench-job", 12345, black_box("file_00"), 50)
                .unwrap()
        });
    });

    group.finish();
}

criterion_group!(benches, bench_index_snapshot, bench_query_directory, bench_search);
criterion_main!(benches);
