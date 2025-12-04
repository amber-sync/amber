//! Development-only commands for testing
//!
//! These commands are only available in debug builds and should never
//! be shipped to production.

use crate::error::Result;
use crate::services::dev_seed::{BenchmarkResult, DevSeeder, SeedResult};
use crate::state::AppState;
use std::path::PathBuf;
use tauri::State;

/// Get the mock-data folder path (relative to project root in dev mode)
fn get_mock_data_path() -> Option<PathBuf> {
    // In dev mode, CARGO_MANIFEST_DIR points to src-tauri/
    // So mock-data is at ../mock-data/
    option_env!("CARGO_MANIFEST_DIR")
        .map(|dir| PathBuf::from(dir).parent().unwrap().join("mock-data"))
}

/// Seed the database with realistic mock data for testing
#[tauri::command]
pub async fn dev_seed_data(state: State<'_, AppState>) -> Result<SeedResult> {
    log::info!("Starting dev data seeding...");

    let index_service = state.index_service.clone();
    let store = state.store.clone();
    let app_data_path = state.data_dir.clone();

    let mut seeder = DevSeeder::new(&index_service, &store, app_data_path);

    // Configure mock-data path for source data
    if let Some(mock_path) = get_mock_data_path() {
        log::info!("Using mock-data source at: {:?}", mock_path);
        seeder = seeder.with_mock_data_path(mock_path);
    }

    let result = seeder.seed()?;

    // Validate schema after seeding to catch mismatches early
    if let Err(e) = state.index_service.validate_schema() {
        log::error!("Schema validation failed after seeding: {}", e);
        return Err(e);
    }

    log::info!(
        "Dev seeding complete: {} jobs, {} snapshots, {} files ({} bytes) in {}ms",
        result.jobs_created,
        result.snapshots_created,
        result.files_created,
        result.total_size_bytes,
        result.duration_ms
    );

    Ok(result)
}

/// Run benchmarks on the seeded data
#[tauri::command]
pub async fn dev_run_benchmarks(state: State<'_, AppState>) -> Result<Vec<BenchmarkResult>> {
    log::info!("Running benchmarks...");

    let index_service = state.index_service.clone();
    let store = state.store.clone();
    let app_data_path = state.data_dir.clone();
    let seeder = DevSeeder::new(&index_service, &store, app_data_path);
    let results = seeder.run_benchmarks()?;

    for result in &results {
        log::info!(
            "Benchmark '{}': avg={:.3}ms, min={:.3}ms, max={:.3}ms ({} iterations)",
            result.operation,
            result.avg_ms,
            result.min_ms,
            result.max_ms,
            result.iterations
        );
    }

    Ok(results)
}

/// Clear all dev data
#[tauri::command]
pub async fn dev_clear_data(state: State<'_, AppState>) -> Result<()> {
    log::info!("Clearing dev data...");

    // Delete dev jobs
    let jobs = state.store.load_jobs()?;
    for job in jobs {
        if job.id.starts_with("dev-") {
            state.store.delete_job(&job.id)?;
            state.index_service.delete_job_snapshots(&job.id)?;
        }
    }

    log::info!("Dev data cleared");
    Ok(())
}

/// Get database statistics
#[tauri::command]
pub async fn dev_db_stats(state: State<'_, AppState>) -> Result<DevDbStats> {
    let conn = state.index_service.get_connection_for_stats()?;

    let snapshot_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM snapshots", [], |row| row.get(0))
        .unwrap_or(0);

    let file_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
        .unwrap_or(0);

    let total_size: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_size), 0) FROM snapshots",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let fts_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM files_fts", [], |row| row.get(0))
        .unwrap_or(0);

    // Get page count and page size for db size calculation
    let page_count: i64 = conn
        .query_row("PRAGMA page_count", [], |row| row.get(0))
        .unwrap_or(0);

    let page_size: i64 = conn
        .query_row("PRAGMA page_size", [], |row| row.get(0))
        .unwrap_or(0);

    let db_size_bytes = page_count * page_size;

    Ok(DevDbStats {
        snapshot_count,
        file_count,
        total_size_bytes: total_size as u64,
        fts_index_entries: fts_count,
        db_size_bytes: db_size_bytes as u64,
    })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DevDbStats {
    pub snapshot_count: i64,
    pub file_count: i64,
    pub total_size_bytes: u64,
    pub fts_index_entries: i64,
    pub db_size_bytes: u64,
}
