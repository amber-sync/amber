// Module declarations
pub mod commands;
pub mod error;
pub mod services;
pub mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Job commands
            commands::jobs::get_jobs,
            commands::jobs::save_job,
            commands::jobs::delete_job,
            // Rsync commands
            commands::rsync::run_rsync,
            commands::rsync::kill_rsync,
            // Snapshot commands
            commands::snapshots::list_snapshots,
            commands::snapshots::get_snapshot_tree,
            commands::snapshots::restore_files,
            commands::snapshots::restore_snapshot,
            // Filesystem commands
            commands::filesystem::read_dir,
            commands::filesystem::select_directory,
            commands::filesystem::read_file_preview,
            commands::filesystem::read_file_as_base64,
            commands::filesystem::open_path,
            commands::filesystem::show_item_in_folder,
            commands::filesystem::get_disk_stats,
            // Preferences commands
            commands::preferences::get_preferences,
            commands::preferences::set_preferences,
            commands::preferences::test_notification,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
