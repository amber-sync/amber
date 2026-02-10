use crate::commands::rsync::get_rsync_service;
use crate::state::AppState;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager};

/// Menu ID prefix for job start/stop items.
/// Format: `job::<job_id>` — the handler toggles start/stop based on running state.
const JOB_PREFIX: &str = "job::";

/// Manages the system tray icon and dynamic menu.
///
/// The menu is rebuilt whenever a job starts, stops, or completes.
/// Job state is read fresh from `AppState.store` and `RsyncService`
/// on every rebuild — no stale tracking needed.
pub struct TrayManager {
    app_handle: AppHandle,
}

impl TrayManager {
    /// Create the tray icon with the initial menu and register event handlers.
    pub fn new(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let manager = Self {
            app_handle: app.clone(),
        };

        let menu = manager.build_menu()?;

        let tray_icon = Image::from_bytes(include_bytes!("../../icons/tray-icon.png"))?;

        TrayIconBuilder::with_id("main")
            .icon(tray_icon)
            .icon_as_template(true)
            .tooltip("Amber")
            .menu(&menu)
            .show_menu_on_left_click(true)
            .on_menu_event(move |app, event| {
                handle_menu_event(app, event.id().as_ref());
            })
            .build(app)?;

        Ok(manager)
    }

    /// Rebuild the tray menu from current job state.
    /// Call this after any job starts, stops, or completes.
    pub fn rebuild_menu(&self) {
        if let Err(e) = self.do_rebuild() {
            log::warn!("Failed to rebuild tray menu: {}", e);
        }
    }

    fn do_rebuild(&self) -> Result<(), Box<dyn std::error::Error>> {
        let menu = self.build_menu()?;
        if let Some(tray) = self.app_handle.tray_by_id("main") {
            tray.set_menu(Some(menu))?;

            // Update tray icon based on whether any job is running
            let rsync = get_rsync_service();
            let jobs = self.load_jobs();
            let running_job = jobs.iter().find(|(id, _)| rsync.is_job_running(id));

            if let Some((_id, name)) = running_job {
                let active_icon =
                    Image::from_bytes(include_bytes!("../../icons/tray-icon-active.png"))?;
                tray.set_icon(Some(active_icon))?;
                tray.set_icon_as_template(true)?;
                tray.set_tooltip(Some(&format!("Amber — Backing up: {}", name)))?;
            } else {
                let idle_icon = Image::from_bytes(include_bytes!("../../icons/tray-icon.png"))?;
                tray.set_icon(Some(idle_icon))?;
                tray.set_icon_as_template(true)?;
                tray.set_tooltip(Some("Amber"))?;
            }
        }
        Ok(())
    }

    /// Build the full menu, reading jobs from the store and checking running state.
    fn build_menu(&self) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
        let app = &self.app_handle;
        let rsync = get_rsync_service();

        let menu = Menu::new(app)?;

        // Open Amber
        menu.append(&MenuItem::with_id(
            app,
            "show",
            "Open Amber",
            true,
            None::<&str>,
        )?)?;
        menu.append(&PredefinedMenuItem::separator(app)?)?;

        // Dynamic job list
        let jobs = self.load_jobs();
        if jobs.is_empty() {
            menu.append(&MenuItem::with_id(
                app,
                "no_jobs",
                "No backup jobs configured",
                false,
                None::<&str>,
            )?)?;
        } else {
            for (id, name) in &jobs {
                let running = rsync.is_job_running(id);
                let label = if running {
                    format!("\u{25A0} {} (running)", name)
                } else {
                    format!("\u{25B6} {}", name)
                };
                let menu_id = format!("{}{}", JOB_PREFIX, id);
                menu.append(&MenuItem::with_id(
                    app,
                    &menu_id,
                    &label,
                    true,
                    None::<&str>,
                )?)?;
            }
        }

        menu.append(&PredefinedMenuItem::separator(app)?)?;

        // Navigation
        menu.append(&MenuItem::with_id(
            app,
            "nav_dashboard",
            "Dashboard",
            true,
            None::<&str>,
        )?)?;
        menu.append(&MenuItem::with_id(
            app,
            "nav_timemachine",
            "Time Machine",
            true,
            None::<&str>,
        )?)?;
        menu.append(&MenuItem::with_id(
            app,
            "nav_settings",
            "Settings",
            true,
            None::<&str>,
        )?)?;
        menu.append(&PredefinedMenuItem::separator(app)?)?;

        // Quit
        menu.append(&MenuItem::with_id(
            app,
            "quit",
            "Quit Amber",
            true,
            None::<&str>,
        )?)?;

        Ok(menu)
    }

    /// Load job (id, name) pairs from the store.
    fn load_jobs(&self) -> Vec<(String, String)> {
        self.app_handle
            .try_state::<AppState>()
            .and_then(|state| {
                state
                    .store
                    .load_jobs()
                    .ok()
                    .map(|jobs| jobs.into_iter().map(|j| (j.id, j.name)).collect())
            })
            .unwrap_or_default()
    }
}

/// Show and focus the main window.
fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Handle a menu event by its string ID.
fn handle_menu_event(app: &AppHandle, id: &str) {
    // Check for job action first (dynamic IDs)
    if let Some(job_id) = id.strip_prefix(JOB_PREFIX) {
        handle_job_action(app, job_id);
        return;
    }

    match id {
        "show" => show_window(app),
        "nav_dashboard" => {
            show_window(app);
            let _ = app.emit("navigate-view", "DASHBOARD");
        }
        "nav_timemachine" => {
            show_window(app);
            let _ = app.emit("navigate-view", "TIME_MACHINE");
        }
        "nav_settings" => {
            show_window(app);
            let _ = app.emit("navigate-view", "APP_SETTINGS");
        }
        "quit" => app.exit(0),
        _ => {}
    }
}

/// Toggle a job: stop it if running, start it if idle.
fn handle_job_action(app: &AppHandle, job_id: &str) {
    let rsync = get_rsync_service();
    let running = rsync.is_job_running(job_id);

    if running {
        // Stop the running backup
        let job_id = job_id.to_string();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = crate::commands::rsync::kill_rsync(job_id).await {
                log::error!("Tray: failed to stop backup: {}", e);
            }
        });
    } else {
        // Start the backup — load full job from store
        let app_state = app.try_state::<AppState>();
        if let Some(state) = app_state {
            if let Ok(Some(job)) = state.store.get_job(job_id) {
                let app_clone = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = crate::commands::rsync::run_rsync(app_clone, job).await {
                        log::error!("Tray: failed to start backup: {}", e);
                    }
                });
            }
        }
    }
}
