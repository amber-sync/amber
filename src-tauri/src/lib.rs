#![allow(unexpected_cfgs)]

// Module declarations
pub mod commands;
pub mod error;
pub mod security;
pub mod services;
pub mod state;
pub mod types;
mod utils;

pub use state::AppState;
use tauri::Manager;

/// TIM-192: Macro to register all Tauri commands with DRY principle.
/// Core commands are listed once, dev commands are conditionally included only in debug builds.
macro_rules! register_commands {
    (
        core: [$($core:path),* $(,)?],
        dev: [$($dev:path),* $(,)?]
    ) => {
        {
            #[cfg(debug_assertions)]
            {
                tauri::generate_handler![$($core,)* $($dev,)*]
            }
            #[cfg(not(debug_assertions))]
            {
                tauri::generate_handler![$($core,)*]
            }
        }
    };
}

fn should_hide_on_close(run_in_background: Option<bool>) -> bool {
    run_in_background.unwrap_or(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize application state with all services
            match AppState::new() {
                Ok(app_state) => {
                    let scheduler = app_state.scheduler.clone();
                    let scheduled_jobs = match app_state.store.load_jobs() {
                        Ok(jobs) => jobs,
                        Err(e) => {
                            log::warn!(
                                "Failed to load jobs before scheduler initialization: {}",
                                e
                            );
                            Vec::new()
                        }
                    };
                    let app_handle_for_scheduler = app.handle().clone();
                    app.manage(app_state);

                    tauri::async_runtime::spawn(async move {
                        scheduler.set_app_handle(app_handle_for_scheduler).await;
                        if let Err(e) = scheduler.init_with_jobs(scheduled_jobs).await {
                            log::error!("Failed to initialize job scheduler: {}", e);
                        }
                    });

                    if cfg!(debug_assertions) {
                        app.handle().plugin(
                            tauri_plugin_log::Builder::default()
                                .level(log::LevelFilter::Info)
                                .build(),
                        )?;
                    }

                    // Initialize MCP plugin for Claude Code integration (dev only)
                    #[allow(unexpected_cfgs)]
                    #[cfg(feature = "mcp")]
                    {
                        app.handle().plugin(tauri_plugin_mcp::init_with_config(
                            tauri_plugin_mcp::PluginConfig::new("Amber".to_string())
                                .start_socket_server(true)
                                .socket_path("/tmp/tauri-mcp.sock".into()),
                        ))?;
                    }

                    // System tray setup via TrayManager
                    // Non-fatal: app works without a tray (e.g. Linux without appindicator)
                    #[cfg(desktop)]
                    {
                        match services::tray_manager::TrayManager::new(app.handle()) {
                            Ok(tray_manager) => {
                                app.manage(tray_manager);
                            }
                            Err(e) => {
                                log::warn!("System tray unavailable: {}", e);
                            }
                        }
                    }

                    Ok(())
                }
                Err(e) => {
                    // Log the error for debugging
                    eprintln!("Failed to initialize application: {}", e);

                    // Show native error dialog to user
                    show_startup_error(&e);

                    // Return error to prevent app from starting
                    Err(Box::new(std::io::Error::other(format!(
                        "Application initialization failed: {}",
                        e
                    )))
                    .into())
                }
            }
        });

    // Hide window on close instead of quitting (app stays in system tray)
    #[cfg(desktop)]
    let builder = builder.on_window_event(|window, event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            let run_in_background = window
                .app_handle()
                .try_state::<AppState>()
                .and_then(|state| state.store.load_preferences().ok())
                .map(|prefs| prefs.run_in_background);

            if should_hide_on_close(run_in_background) {
                let _ = window.hide();
                api.prevent_close();
            }
        }
    });

    // TIM-192: Single source of truth for command registration
    let builder = builder.invoke_handler(register_commands!(
        core: [
            // Job commands
            commands::jobs::get_jobs,
            commands::jobs::get_jobs_with_status,
            commands::jobs::save_job,
            commands::jobs::delete_job,
            commands::jobs::delete_job_data,
            // Rsync commands
            commands::rsync::run_rsync,
            commands::rsync::kill_rsync,
            // Rclone commands
            commands::rclone::check_rclone,
            commands::rclone::list_rclone_remotes,
            commands::rclone::run_rclone,
            commands::rclone::kill_rclone,
            // Snapshot commands
            commands::snapshots::list_snapshots,
            commands::snapshots::list_snapshots_in_range,
            commands::snapshots::get_snapshot_tree,
            commands::snapshots::get_indexed_directory,
            commands::snapshots::get_indexed_directory_paginated,
            commands::snapshots::index_snapshot,
            commands::snapshots::is_snapshot_indexed,
            commands::snapshots::search_snapshot_files,
            commands::snapshots::search_files_global,
            commands::snapshots::get_snapshot_stats,
            commands::snapshots::get_file_type_stats,
            commands::snapshots::get_largest_files,
            commands::snapshots::delete_snapshot_index,
            commands::snapshots::delete_job_index,
            commands::snapshots::restore_files,
            commands::snapshots::restore_snapshot,
            commands::snapshots::get_destination_index_path,
            commands::snapshots::destination_has_index,
            commands::snapshots::export_index_to_destination,
            // TIM-127: Destination-based index commands
            commands::snapshots::index_snapshot_on_destination,
            commands::snapshots::get_directory_from_destination,
            commands::snapshots::is_indexed_on_destination,
            commands::snapshots::search_files_on_destination,
            commands::snapshots::get_file_type_stats_on_destination,
            commands::snapshots::get_largest_files_on_destination,
            commands::snapshots::delete_snapshot_from_destination,
            commands::snapshots::list_snapshots_in_range_on_destination,
            commands::snapshots::get_job_aggregate_stats,
            commands::snapshots::get_job_aggregate_stats_on_destination,
            commands::snapshots::get_snapshot_density,
            commands::snapshots::get_snapshot_density_on_destination,
            // TIM-221: Snapshot comparison
            commands::snapshots::compare_snapshots,
            // Snapshot pruning (delete from manifest + index + disk)
            commands::snapshots::prune_snapshot,
            // Filesystem commands
            commands::filesystem::read_dir,
            commands::filesystem::read_file_preview,
            commands::filesystem::read_file_as_base64,
            commands::filesystem::open_path,
            commands::filesystem::show_item_in_folder,
            commands::filesystem::get_disk_stats,
            commands::filesystem::get_volume_info,
            commands::filesystem::list_volumes,
            commands::filesystem::search_volume,
            commands::filesystem::is_path_mounted,
            commands::filesystem::check_destinations,
            commands::filesystem::scan_for_backups,
            commands::filesystem::find_orphan_backups,
            commands::filesystem::import_backup_as_job,
            // Preferences commands
            commands::preferences::get_preferences,
            commands::preferences::set_preferences,
            commands::preferences::test_notification,
            // Manifest commands
            commands::manifest::get_manifest,
            commands::manifest::get_or_create_manifest,
            commands::manifest::manifest_exists,
            commands::manifest::add_manifest_snapshot,
            commands::manifest::remove_manifest_snapshot,
            commands::manifest::get_amber_meta_path,
            // Migration commands
            commands::migration::needs_migration,
            commands::migration::run_migration,
        ],
        dev: [
            // Dev commands (debug only)
            commands::dev::dev_seed_data,
            commands::dev::dev_run_benchmarks,
            commands::dev::dev_churn_data,
            commands::dev::dev_clear_data,
            commands::dev::dev_db_stats,
        ]
    ));

    if let Err(e) = builder.run(tauri::generate_context!()) {
        eprintln!("Application error: {}", e);
        std::process::exit(1);
    }
}

/// Show a native error dialog to the user
fn show_startup_error(error_message: &str) {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let message = format!(
            "Amber failed to start:\\n\\n{}\\n\\nPlease check the logs for more information.",
            error_message
        );
        let _ = Command::new("osascript")
            .args([
                "-e",
                &format!(
                    "display dialog \"{}\" buttons {{\"OK\"}} with icon stop with title \"Amber Startup Error\"",
                    message.replace('"', "\\\"")
                ),
            ])
            .status();
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let message = format!(
            "Amber failed to start:\n\n{}\n\nPlease check the logs for more information.",
            error_message
        );
        let _ = Command::new("msg").args(["*", &message]).status();
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let message = format!(
            "Amber failed to start:\n\n{}\n\nPlease check the logs for more information.",
            error_message
        );
        // Try zenity first (more common)
        let result = Command::new("zenity")
            .args([
                "--error",
                "--title=Amber Startup Error",
                &format!("--text={}", message),
            ])
            .status();

        // Fall back to notify-send if zenity not available
        if result.is_err() {
            let _ = Command::new("notify-send")
                .args(["-u", "critical", "Amber Startup Error", &message])
                .status();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn close_behavior_hides_when_run_in_background_enabled() {
        assert!(should_hide_on_close(Some(true)));
    }

    #[test]
    fn close_behavior_closes_when_run_in_background_disabled() {
        assert!(!should_hide_on_close(Some(false)));
    }
}
