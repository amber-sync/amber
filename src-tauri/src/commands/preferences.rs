use crate::error::Result;
use crate::types::preferences::AppPreferences;

#[tauri::command]
pub async fn get_preferences() -> Result<AppPreferences> {
    // TODO: Implement preferences retrieval
    Ok(AppPreferences::default())
}

#[tauri::command]
pub async fn set_preferences(_preferences: AppPreferences) -> Result<AppPreferences> {
    // TODO: Implement preferences saving
    Ok(AppPreferences::default())
}

#[tauri::command]
pub async fn test_notification() -> Result<()> {
    // TODO: Implement test notification
    Ok(())
}
