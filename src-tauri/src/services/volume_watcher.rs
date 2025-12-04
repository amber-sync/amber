use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

use crate::error::{AmberError, Result};

/// Callback type for volume events
pub type VolumeCallback = Box<dyn Fn(VolumeEvent) + Send + Sync>;

#[derive(Debug, Clone)]
pub enum VolumeEvent {
    Mounted(String),
    Unmounted(String),
}

/// Watches /Volumes for mount/unmount events on macOS
pub struct VolumeWatcher {
    watcher: Arc<RwLock<Option<RecommendedWatcher>>>,
    volumes_path: PathBuf,
    event_tx: Arc<RwLock<Option<mpsc::Sender<VolumeEvent>>>>,
}

impl VolumeWatcher {
    pub fn new() -> Self {
        Self {
            watcher: Arc::new(RwLock::new(None)),
            volumes_path: PathBuf::from("/Volumes"),
            event_tx: Arc::new(RwLock::new(None)),
        }
    }

    /// Start watching for volume changes
    /// Returns a receiver for volume events
    pub async fn start(&self) -> Result<mpsc::Receiver<VolumeEvent>> {
        let (tx, rx) = mpsc::channel(100);

        // Store the sender
        {
            let mut event_tx = self.event_tx.write().await;
            *event_tx = Some(tx.clone());
        }

        // Create the watcher with a callback
        let tx_clone = tx.clone();
        let watcher =
            notify::recommended_watcher(move |res: std::result::Result<Event, notify::Error>| {
                match res {
                    Ok(event) => {
                        // We only care about create/delete events in /Volumes
                        match event.kind {
                            EventKind::Create(_) => {
                                for path in event.paths {
                                    if path.file_name().is_some() {
                                        let vol_path = path.to_string_lossy().to_string();
                                        log::info!("Volume mounted: {}", vol_path);
                                        let _ =
                                            tx_clone.blocking_send(VolumeEvent::Mounted(vol_path));
                                    }
                                }
                            }
                            EventKind::Remove(_) => {
                                for path in event.paths {
                                    if path.file_name().is_some() {
                                        let vol_path = path.to_string_lossy().to_string();
                                        log::info!("Volume unmounted: {}", vol_path);
                                        let _ = tx_clone
                                            .blocking_send(VolumeEvent::Unmounted(vol_path));
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                    Err(e) => {
                        log::error!("VolumeWatcher error: {}", e);
                    }
                }
            })
            .map_err(|e| AmberError::Volume(format!("Failed to create watcher: {}", e)))?;

        // Store the watcher
        {
            let mut w = self.watcher.write().await;
            *w = Some(watcher);
        }

        // Start watching
        {
            let mut w = self.watcher.write().await;
            if let Some(ref mut watcher) = *w {
                watcher
                    .watch(&self.volumes_path, RecursiveMode::NonRecursive)
                    .map_err(|e| AmberError::Volume(format!("Failed to watch /Volumes: {}", e)))?;
            }
        }

        log::info!("VolumeWatcher started on {:?}", self.volumes_path);
        Ok(rx)
    }

    /// Stop watching
    pub async fn stop(&self) -> Result<()> {
        let mut w = self.watcher.write().await;
        if let Some(ref mut watcher) = w.take() {
            watcher
                .unwatch(&self.volumes_path)
                .map_err(|e| AmberError::Volume(format!("Failed to unwatch: {}", e)))?;
        }

        // Clear the sender
        let mut tx = self.event_tx.write().await;
        *tx = None;

        log::info!("VolumeWatcher stopped");
        Ok(())
    }

    /// Get list of currently mounted volumes
    pub fn list_volumes(&self) -> Result<Vec<String>> {
        let mut volumes = Vec::new();

        if self.volumes_path.exists() {
            let entries = std::fs::read_dir(&self.volumes_path)
                .map_err(|e| AmberError::Volume(format!("Failed to read /Volumes: {}", e)))?;

            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    volumes.push(entry.path().to_string_lossy().to_string());
                }
            }
        }

        Ok(volumes)
    }

    /// Check if a specific volume is mounted
    pub fn is_volume_mounted(&self, name: &str) -> bool {
        let vol_path = self.volumes_path.join(name);
        vol_path.exists() && vol_path.is_dir()
    }

    /// Get volume info (size, available space, etc.)
    pub fn get_volume_info(&self, path: &str) -> Result<VolumeInfo> {
        use std::process::Command;

        // Use df command to get volume info on macOS
        let output = Command::new("df")
            .args(["-k", path])
            .output()
            .map_err(|e| AmberError::Volume(format!("Failed to run df: {}", e)))?;

        if !output.status.success() {
            return Err(AmberError::Volume("df command failed".into()));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = stdout.lines().collect();

        if lines.len() < 2 {
            return Err(AmberError::Volume("Unexpected df output".into()));
        }

        // Parse the second line (first is header)
        let parts: Vec<&str> = lines[1].split_whitespace().collect();
        if parts.len() < 6 {
            return Err(AmberError::Volume("Unexpected df output format".into()));
        }

        let total_kb: u64 = parts[1].parse().unwrap_or(0);
        let used_kb: u64 = parts[2].parse().unwrap_or(0);
        let available_kb: u64 = parts[3].parse().unwrap_or(0);

        Ok(VolumeInfo {
            path: path.to_string(),
            total_bytes: total_kb * 1024,
            used_bytes: used_kb * 1024,
            available_bytes: available_kb * 1024,
            filesystem: parts[0].to_string(),
        })
    }
}

impl Default for VolumeWatcher {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeInfo {
    pub path: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub filesystem: String,
}
