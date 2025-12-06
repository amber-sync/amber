use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Mock Tauri IPC command structures
#[derive(Debug, Serialize, Deserialize)]
struct SnapshotListRequest {
    job_id: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct SnapshotListResponse {
    snapshots: Vec<SnapshotInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SnapshotInfo {
    id: i64,
    timestamp: i64,
    manifest_path: String,
    state: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct FileListRequest {
    snapshot_id: i64,
    page: usize,
    page_size: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct FileListResponse {
    files: Vec<FileInfo>,
    total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileInfo {
    path: String,
    size: i64,
    mtime: i64,
}

/// Benchmark: Serialization/Deserialization overhead
fn bench_payload_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("ipc_serialization");

    // Small payload (10 snapshots)
    let small_payload = SnapshotListResponse {
        snapshots: (0..10)
            .map(|i| SnapshotInfo {
                id: i,
                timestamp: 1700000000 + i * 3600,
                manifest_path: format!("/manifests/snap_{}.json", i),
                state: "completed".to_string(),
            })
            .collect(),
    };

    group.bench_function("small_payload_10_snapshots", |b| {
        b.iter(|| {
            let serialized = serde_json::to_string(&small_payload).unwrap();
            let deserialized: SnapshotListResponse = serde_json::from_str(&serialized).unwrap();
            black_box(deserialized)
        });
    });

    // Medium payload (100 files)
    let medium_payload = FileListResponse {
        files: (0..100)
            .map(|i| FileInfo {
                path: format!("/data/folder{}/file_{}.txt", i / 10, i),
                size: 1024 * (i + 1),
                mtime: 1700000000 + i,
            })
            .collect(),
        total: 2000,
    };

    group.bench_function("medium_payload_100_files", |b| {
        b.iter(|| {
            let serialized = serde_json::to_string(&medium_payload).unwrap();
            let deserialized: FileListResponse = serde_json::from_str(&serialized).unwrap();
            black_box(deserialized)
        });
    });

    // Large payload (2000 files - full snapshot)
    let large_payload = FileListResponse {
        files: (0..2000)
            .map(|i| FileInfo {
                path: format!("/data/folder{}/file_{}.txt", i / 100, i),
                size: 1024 * (i % 1000 + 1),
                mtime: 1700000000 + i,
            })
            .collect(),
        total: 2000,
    };

    group.bench_function("large_payload_2000_files", |b| {
        b.iter(|| {
            let serialized = serde_json::to_string(&large_payload).unwrap();
            let deserialized: FileListResponse = serde_json::from_str(&serialized).unwrap();
            black_box(deserialized)
        });
    });

    group.finish();
}

/// Benchmark: Batch vs Individual IPC calls
fn bench_batch_vs_individual(c: &mut Criterion) {
    let mut group = c.benchmark_group("ipc_batch_vs_individual");

    // Individual calls: 100 separate requests
    group.bench_function("individual_100_calls", |b| {
        b.iter(|| {
            let mut results = Vec::new();
            for i in 0..100 {
                let request = FileListRequest {
                    snapshot_id: 1,
                    page: i,
                    page_size: 10,
                };

                // Simulate serialization + command processing + deserialization
                let serialized = serde_json::to_string(&request).unwrap();
                let _parsed: FileListRequest = serde_json::from_str(&serialized).unwrap();

                // Mock response
                let response = FileListResponse {
                    files: vec![FileInfo {
                        path: format!("/data/file_{}.txt", i),
                        size: 1024,
                        mtime: 1700000000,
                    }],
                    total: 2000,
                };

                results.push(response);
            }
            black_box(results)
        });
    });

    // Batch call: Single request with 1000 items
    group.bench_function("batch_1_call_1000_items", |b| {
        b.iter(|| {
            let request = FileListRequest {
                snapshot_id: 1,
                page: 0,
                page_size: 1000,
            };

            let serialized = serde_json::to_string(&request).unwrap();
            let _parsed: FileListRequest = serde_json::from_str(&serialized).unwrap();

            let response = FileListResponse {
                files: (0..1000)
                    .map(|i| FileInfo {
                        path: format!("/data/file_{}.txt", i),
                        size: 1024,
                        mtime: 1700000000,
                    })
                    .collect(),
                total: 2000,
            };

            black_box(response)
        });
    });

    group.finish();
}

/// Benchmark: Error handling overhead
fn bench_error_handling(c: &mut Criterion) {
    c.bench_function("error_handling_overhead", |b| {
        b.iter(|| {
            // Simulate error response serialization
            #[derive(Serialize)]
            struct ErrorResponse {
                error: String,
                code: u32,
            }

            let error = ErrorResponse {
                error: "Snapshot not found".to_string(),
                code: 404,
            };

            let serialized = serde_json::to_string(&error).unwrap();
            black_box(serialized)
        });
    });
}

/// Benchmark: Streaming large file lists (chunked responses)
fn bench_streaming_file_list(c: &mut Criterion) {
    let mut group = c.benchmark_group("ipc_streaming");

    for chunk_size in [100, 500, 1000].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(chunk_size),
            chunk_size,
            |b, &size| {
                b.iter(|| {
                    let total_files = 2000;
                    let chunks = (total_files / size) + 1;

                    let mut all_files = Vec::new();
                    for chunk_idx in 0..chunks {
                        let files: Vec<FileInfo> = (0..size)
                            .map(|i| FileInfo {
                                path: format!("/data/file_{}.txt", chunk_idx * size + i),
                                size: 1024,
                                mtime: 1700000000,
                            })
                            .collect();

                        let response = FileListResponse {
                            files,
                            total: total_files,
                        };

                        let serialized = serde_json::to_string(&response).unwrap();
                        let deserialized: FileListResponse =
                            serde_json::from_str(&serialized).unwrap();
                        all_files.extend(deserialized.files);
                    }

                    black_box(all_files)
                });
            },
        );
    }

    group.finish();
}

/// Benchmark: Command round-trip time simulation
fn bench_command_round_trip(c: &mut Criterion) {
    c.bench_function("command_round_trip_simple", |b| {
        b.iter(|| {
            // Simulate full round-trip:
            // 1. Frontend serializes request
            let request = SnapshotListRequest { job_id: 1 };
            let request_json = serde_json::to_string(&request).unwrap();

            // 2. Backend deserializes request
            let _parsed: SnapshotListRequest = serde_json::from_str(&request_json).unwrap();

            // 3. Backend processes (mocked as simple data creation)
            let response = SnapshotListResponse {
                snapshots: vec![SnapshotInfo {
                    id: 1,
                    timestamp: 1700000000,
                    manifest_path: "/manifests/snap_1.json".to_string(),
                    state: "completed".to_string(),
                }],
            };

            // 4. Backend serializes response
            let response_json = serde_json::to_string(&response).unwrap();

            // 5. Frontend deserializes response
            let _result: SnapshotListResponse = serde_json::from_str(&response_json).unwrap();

            black_box(response)
        });
    });
}

criterion_group! {
    name = benches;
    config = Criterion::default()
        .sample_size(100)
        .measurement_time(Duration::from_secs(5));
    targets =
        bench_payload_serialization,
        bench_batch_vs_individual,
        bench_error_handling,
        bench_streaming_file_list,
        bench_command_round_trip
}
criterion_main!(benches);
