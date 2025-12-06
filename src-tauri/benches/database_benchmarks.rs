use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use rusqlite::{params, Connection};
use std::time::Duration;
use tempfile::NamedTempFile;

/// Setup test database with stress test data
fn setup_stress_test_db() -> Connection {
    let temp_file = NamedTempFile::new().unwrap();
    let conn = Connection::open(temp_file.path()).unwrap();

    // Create schema
    conn.execute_batch(
        r#"
        CREATE TABLE snapshots (
            id INTEGER PRIMARY KEY,
            job_id INTEGER NOT NULL,
            timestamp INTEGER NOT NULL,
            manifest_path TEXT NOT NULL,
            state TEXT NOT NULL
        );

        CREATE TABLE files (
            id INTEGER PRIMARY KEY,
            snapshot_id INTEGER NOT NULL,
            path TEXT NOT NULL,
            size INTEGER NOT NULL,
            mtime INTEGER NOT NULL,
            FOREIGN KEY(snapshot_id) REFERENCES snapshots(id)
        );

        CREATE INDEX idx_snapshots_job_timestamp ON snapshots(job_id, timestamp DESC);
        CREATE INDEX idx_files_snapshot ON files(snapshot_id);
        CREATE INDEX idx_files_path ON files(path);

        CREATE VIRTUAL TABLE files_fts USING fts5(
            path,
            content='files',
            content_rowid='id'
        );
    "#,
    )
    .unwrap();

    // Insert stress test data: 40 snapshots, 2000 files each
    for snapshot_idx in 0..40 {
        conn.execute(
            "INSERT INTO snapshots (job_id, timestamp, manifest_path, state) VALUES (?1, ?2, ?3, ?4)",
            params![1, 1700000000 + snapshot_idx * 3600, format!("/manifests/snap_{}.json", snapshot_idx), "completed"]
        ).unwrap();

        let snapshot_id = conn.last_insert_rowid();

        // Batch insert 2000 files per snapshot
        let tx = conn.transaction().unwrap();
        {
            let mut stmt = tx
                .prepare(
                    "INSERT INTO files (snapshot_id, path, size, mtime) VALUES (?1, ?2, ?3, ?4)",
                )
                .unwrap();

            for file_idx in 0..2000 {
                stmt.execute(params![
                    snapshot_id,
                    format!("/data/folder{}/file_{}.txt", file_idx / 100, file_idx),
                    1024 * (file_idx % 1000 + 1),
                    1700000000 + file_idx
                ])
                .unwrap();
            }
        }
        tx.commit().unwrap();

        // Populate FTS index
        conn.execute("INSERT INTO files_fts(files_fts) VALUES('rebuild')", [])
            .unwrap();
    }

    conn
}

/// Benchmark: List all snapshots for a job (40 snapshots)
fn bench_list_snapshots(c: &mut Criterion) {
    let conn = setup_stress_test_db();

    c.bench_function("list_snapshots_40", |b| {
        b.iter(|| {
            let mut stmt = conn
                .prepare(
                    "SELECT id, timestamp, manifest_path, state
                 FROM snapshots
                 WHERE job_id = ?1
                 ORDER BY timestamp DESC",
                )
                .unwrap();

            let snapshots: Vec<_> = stmt
                .query_map([1], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                })
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap();

            black_box(snapshots)
        });
    });
}

/// Benchmark: Paginated file listing (page size 50, 100, 500)
fn bench_file_listing_paginated(c: &mut Criterion) {
    let conn = setup_stress_test_db();
    let snapshot_id = 1; // First snapshot

    let mut group = c.benchmark_group("file_listing_paginated");

    for page_size in [50, 100, 500].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(page_size),
            page_size,
            |b, &size| {
                b.iter(|| {
                    let mut stmt = conn
                        .prepare(
                            "SELECT path, size, mtime
                         FROM files
                         WHERE snapshot_id = ?1
                         ORDER BY path
                         LIMIT ?2 OFFSET ?3",
                        )
                        .unwrap();

                    let files: Vec<_> = stmt
                        .query_map(params![snapshot_id, size, 0], |row| {
                            Ok((
                                row.get::<_, String>(0)?,
                                row.get::<_, i64>(1)?,
                                row.get::<_, i64>(2)?,
                            ))
                        })
                        .unwrap()
                        .collect::<Result<_, _>>()
                        .unwrap();

                    black_box(files)
                });
            },
        );
    }
    group.finish();
}

/// Benchmark: FTS5 search with different query complexities
fn bench_fts5_search(c: &mut Criterion) {
    let conn = setup_stress_test_db();

    let mut group = c.benchmark_group("fts5_search");

    // Simple exact match
    group.bench_function("exact_match", |b| {
        b.iter(|| {
            let mut stmt = conn
                .prepare(
                    "SELECT files.path, files.size
                 FROM files_fts
                 JOIN files ON files_fts.rowid = files.id
                 WHERE files_fts MATCH ?1
                 LIMIT 100",
                )
                .unwrap();

            let results: Vec<_> = stmt
                .query_map(["file_500.txt"], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
                })
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap();

            black_box(results)
        });
    });

    // Prefix search
    group.bench_function("prefix_search", |b| {
        b.iter(|| {
            let mut stmt = conn
                .prepare(
                    "SELECT files.path, files.size
                 FROM files_fts
                 JOIN files ON files_fts.rowid = files.id
                 WHERE files_fts MATCH ?1
                 LIMIT 100",
                )
                .unwrap();

            let results: Vec<_> = stmt
                .query_map(["file_5*"], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
                })
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap();

            black_box(results)
        });
    });

    // Complex search with folder path
    group.bench_function("complex_path_search", |b| {
        b.iter(|| {
            let mut stmt = conn
                .prepare(
                    "SELECT files.path, files.size
                 FROM files_fts
                 JOIN files ON files_fts.rowid = files.id
                 WHERE files_fts MATCH ?1
                 LIMIT 100",
                )
                .unwrap();

            let results: Vec<_> = stmt
                .query_map(["folder10 AND file_1*"], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
                })
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap();

            black_box(results)
        });
    });

    group.finish();
}

/// Benchmark: Snapshot comparison (file diff between snapshots)
fn bench_snapshot_diff(c: &mut Criterion) {
    let conn = setup_stress_test_db();

    c.bench_function("snapshot_diff", |b| {
        b.iter(|| {
            // Find added/modified/deleted files between snapshot 1 and 2
            let mut stmt = conn
                .prepare(
                    r#"
                SELECT
                    COALESCE(a.path, b.path) as path,
                    CASE
                        WHEN a.id IS NULL THEN 'deleted'
                        WHEN b.id IS NULL THEN 'added'
                        WHEN a.size != b.size OR a.mtime != b.mtime THEN 'modified'
                        ELSE 'unchanged'
                    END as status
                FROM files a
                FULL OUTER JOIN files b ON a.path = b.path
                WHERE a.snapshot_id = ?1 OR b.snapshot_id = ?2
            "#,
                )
                .unwrap();

            let diff: Vec<_> = stmt
                .query_map(params![1, 2], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap();

            black_box(diff)
        });
    });
}

criterion_group! {
    name = benches;
    config = Criterion::default()
        .sample_size(100)
        .measurement_time(Duration::from_secs(10));
    targets =
        bench_list_snapshots,
        bench_file_listing_paginated,
        bench_fts5_search,
        bench_snapshot_diff
}
criterion_main!(benches);
