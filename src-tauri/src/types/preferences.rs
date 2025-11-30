use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPreferences {
    pub run_in_background: bool,
    pub start_on_boot: bool,
    pub notifications: bool,
    pub theme: String,
    pub accent_color: String,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            run_in_background: false,
            start_on_boot: false,
            notifications: true,
            theme: "system".to_string(),
            accent_color: "blue".to_string(),
        }
    }
}
