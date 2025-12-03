use crate::error::Result;
use crate::state::AppState;
use crate::types::preferences::AppPreferences;
use tauri::State;

#[tauri::command]
pub async fn get_preferences(state: State<'_, AppState>) -> Result<AppPreferences> {
    state.store.load_preferences()
}

#[tauri::command]
pub async fn set_preferences(
    state: State<'_, AppState>,
    preferences: AppPreferences,
) -> Result<AppPreferences> {
    state.store.save_preferences(&preferences)?;
    Ok(preferences)
}

#[tauri::command]
pub async fn test_notification() -> Result<()> {
    // TODO: Implement native notification
    Ok(())
}
