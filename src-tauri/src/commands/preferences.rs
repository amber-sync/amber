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
    // TODO: Implement native macOS notification using Notification Center
    // Options:
    // 1. Use tauri-plugin-notification (preferred for cross-platform)
    // 2. Use `osascript` to trigger native notifications
    // 3. Use `notify-rust` crate
    // Related: TIM-XXX (create ticket for native notification support)
    log::warn!("Native notifications not yet implemented");
    Ok(())
}
