//! Development-only commands for testing
//!
//! These commands are only available in debug builds and should never
//! be shipped to production.

use crate::error::Result;
use crate::services::dev_seed::{BenchmarkResult, ChurnResult, DevSeeder, SeedResult};
use crate::state::AppState;
use tauri::State;

/// Seed the database with realistic mock data for testing
#[tauri::command]
pub async fn dev_seed_data(state: State<'_, AppState>) -> Result<SeedResult> {
    log::info!("Starting dev data seeding...");

    let index_service = state.index_service.clone();
    let store = state.store.clone();
    let app_data_path = state.data_dir.clone();

    let mut seeder = DevSeeder::new(&index_service, &store, app_data_path);
    let result = seeder.seed()?;

    // Update path validator to include new dev job paths
    if result.jobs_created > 0 {
        if let Err(e) = state.update_job_roots() {
            log::warn!("Failed to update path validator after seeding: {}", e);
        }
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

/// Apply churn (add/modify/delete files) to dev job source directories
#[tauri::command]
pub async fn dev_churn_data(state: State<'_, AppState>) -> Result<ChurnResult> {
    log::info!("Applying churn to dev sources...");

    let index_service = state.index_service.clone();
    let store = state.store.clone();
    let app_data_path = state.data_dir.clone();
    let seeder = DevSeeder::new(&index_service, &store, app_data_path);
    let result = seeder.churn()?;

    log::info!(
        "Churn complete: +{} added, ~{} modified, -{} deleted",
        result.added,
        result.modified,
        result.deleted
    );

    Ok(result)
}

/// Clear all dev data (jobs from store + playground directory)
#[tauri::command]
pub async fn dev_clear_data(state: State<'_, AppState>) -> Result<()> {
    log::info!("Clearing dev data...");

    let index_service = state.index_service.clone();
    let store = state.store.clone();
    let app_data_path = state.data_dir.clone();
    let seeder = DevSeeder::new(&index_service, &store, app_data_path);
    seeder.clear()?;

    // Update path validator after removing dev jobs
    if let Err(e) = state.update_job_roots() {
        log::warn!("Failed to update path validator after clearing: {}", e);
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
