//! Benchmarks for FileService performance
//!
//! Run with: cargo bench --bench file_service_benchmark

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use std::fs;
use std::hint::black_box;
use tempfile::TempDir;

// Import the library
use app_lib::services::file_service::FileService;

/// Create a flat directory with the specified number of files
fn create_flat_structure(dir: &TempDir, file_count: usize) {
    let base = dir.path();

    for i in 0..file_count {
        let file_path = base.join(format!("file_{:05}.txt", i));
        fs::write(&file_path, format!("Content for file {}", i)).unwrap();
    }

    // Also create some directories
    for i in 0..10 {
        let dir_path = base.join(format!("dir_{:02}", i));
        fs::create_dir_all(&dir_path).unwrap();
    }
}

/// Create a deep directory structure
fn create_nested_structure(dir: &TempDir, depth: usize, files_per_level: usize) {
    let mut current = dir.path().to_path_buf();

    for level in 0..depth {
        current = current.join(format!("level_{}", level));
        fs::create_dir_all(&current).unwrap();

        for i in 0..files_per_level {
            let file_path = current.join(format!("file_{:03}.txt", i));
            fs::write(&file_path, format!("Level {} file {}", level, i)).unwrap();
        }
    }
}

fn bench_scan_directory(c: &mut Criterion) {
    let mut group = c.benchmark_group("scan_directory");

    // Test with different file counts
    for file_count in [100, 500, 1000].iter() {
        let temp_dir = TempDir::new().unwrap();
        create_flat_structure(&temp_dir, *file_count);

        let file_service = FileService::new();

        group.throughput(Throughput::Elements(*file_count as u64));
        group.bench_with_input(
            BenchmarkId::new("flat", file_count),
            file_count,
            |b, &_count| {
                b.iter(|| {
                    file_service
                        .scan_directory(black_box(temp_dir.path().to_str().unwrap()))
                        .unwrap()
                });
            },
        );
    }

    group.finish();
}

fn bench_scan_recursive(c: &mut Criterion) {
    let mut group = c.benchmark_group("scan_recursive");

    // Test with different depths
    for depth in [3, 5, 10].iter() {
        let temp_dir = TempDir::new().unwrap();
        create_nested_structure(&temp_dir, *depth, 10);

        let file_service = FileService::new();

        group.bench_with_input(BenchmarkId::new("depth", depth), depth, |b, &depth| {
            b.iter(|| {
                file_service
                    .scan_recursive(black_box(temp_dir.path().to_str().unwrap()), depth)
                    .unwrap()
            });
        });
    }

    group.finish();
}

criterion_group!(benches, bench_scan_directory, bench_scan_recursive);
criterion_main!(benches);
