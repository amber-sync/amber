use crate::error::Result;
use crate::services::migration_service::{self, MigrationReport};
use crate::state::AppState;
use tauri::State;

/// Check if migration is needed (any jobs have embedded snapshots)
#[tauri::command]
pub async fn needs_migration(state: State<'_, AppState>) -> Result<bool> {
    Ok(migration_service::needs_migration(&state.store))
}

/// Run the migration from embedded snapshots to manifest-based architecture
/// Returns a report of what was migrated
#[tauri::command]
pub async fn run_migration(state: State<'_, AppState>) -> Result<MigrationReport> {
    migration_service::run_migration(&state.store)
        .await
        .map_err(|e| crate::error::AmberError::Migration(e.to_string()))
}
