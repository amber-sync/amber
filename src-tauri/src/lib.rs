// Module declarations
pub mod commands;
pub mod error;
pub mod services;
pub mod state;
pub mod types;
pub mod utils;

pub use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize application state with all services
            let app_state = AppState::new()
                .expect("Failed to initialize application state");
            app.manage(app_state);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        });

    // Register handlers - dev commands only in debug builds
    #[cfg(debug_assertions)]
    let builder = builder.invoke_handler(tauri::generate_handler![
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
        commands::snapshots::get_snapshot_tree,
        commands::snapshots::get_indexed_directory,
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
        // Dev commands (debug only)
        commands::dev::dev_seed_data,
        commands::dev::dev_run_benchmarks,
        commands::dev::dev_clear_data,
        commands::dev::dev_db_stats,
    ]);

    #[cfg(not(debug_assertions))]
    let builder = builder.invoke_handler(tauri::generate_handler![
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
        commands::snapshots::get_snapshot_tree,
        commands::snapshots::get_indexed_directory,
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
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
