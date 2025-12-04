use serde::{Deserialize, Serialize};

fn default_false() -> bool {
    false
}

fn default_true() -> bool {
    true
}

fn default_theme() -> String {
    "system".to_string()
}

fn default_accent() -> String {
    "blue".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPreferences {
    #[serde(default = "default_false")]
    pub run_in_background: bool,
    #[serde(default = "default_false")]
    pub start_on_boot: bool,
    #[serde(default = "default_true")]
    pub notifications: bool,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_accent")]
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
