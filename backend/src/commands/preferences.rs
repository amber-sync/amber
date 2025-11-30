use crate::error::Result;
use crate::services::store::Store;
use crate::types::preferences::AppPreferences;
use std::path::PathBuf;

fn get_store() -> Store {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("amber-backup");
    Store::new(&data_dir)
}

#[tauri::command]
pub async fn get_preferences() -> Result<AppPreferences> {
    let store = get_store();
    store.load_preferences()
}

#[tauri::command]
pub async fn set_preferences(preferences: AppPreferences) -> Result<AppPreferences> {
    let store = get_store();
    store.save_preferences(&preferences)?;
    Ok(preferences)
}

#[tauri::command]
pub async fn test_notification() -> Result<()> {
    // TODO: Implement native notification
    Ok(())
}
