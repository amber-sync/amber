use crate::error::Result;
use crate::services::manifest_service;
use crate::types::job::SyncJob;
use crate::types::preferences::AppPreferences;
use serde::de::DeserializeOwned;
use std::io::Write;
use std::path::{Path, PathBuf};

const JOBS_FILENAME: &str = "jobs.json";
const PREFS_FILENAME: &str = "preferences.json";
/// Job config filename on destination drive (TIM-128)
const JOB_CONFIG_FILENAME: &str = "job.json";

pub struct Store {
    data_dir: PathBuf,
}

impl Store {
    pub fn new(app_data_dir: &Path) -> Self {
        let _ = std::fs::create_dir_all(app_data_dir);
        Self {
            data_dir: app_data_dir.to_path_buf(),
        }
    }

    fn jobs_path(&self) -> PathBuf {
        self.data_dir.join(JOBS_FILENAME)
    }

    fn prefs_path(&self) -> PathBuf {
        self.data_dir.join(PREFS_FILENAME)
    }

    // ===== Jobs =====

    pub fn load_jobs(&self) -> Result<Vec<SyncJob>> {
        let path = self.jobs_path();

        match std::fs::read_to_string(&path) {
            Ok(data) => self.read_json(&path, &data),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
            Err(e) => Err(crate::error::AmberError::Io(e)),
        }
    }

    pub fn save_jobs(&self, jobs: &[SyncJob]) -> Result<()> {
        let path = self.jobs_path();
        let json = serde_json::to_string_pretty(jobs)
            .map_err(|e| crate::error::AmberError::Store(e.to_string()))?;
        self.write_atomic(&path, json.as_bytes())?;
        Ok(())
    }

    pub fn get_job(&self, job_id: &str) -> Result<Option<SyncJob>> {
        let jobs = self.load_jobs()?;
        Ok(jobs.into_iter().find(|j| j.id == job_id))
    }

    pub fn save_job(&self, job: SyncJob) -> Result<()> {
        let mut jobs = self.load_jobs()?;

        if let Some(idx) = jobs.iter().position(|j| j.id == job.id) {
            jobs[idx] = job;
        } else {
            jobs.push(job);
        }

        self.save_jobs(&jobs)
    }

    pub fn delete_job(&self, job_id: &str) -> Result<()> {
        let mut jobs = self.load_jobs()?;
        jobs.retain(|j| j.id != job_id);
        self.save_jobs(&jobs)
    }

    // ===== Preferences =====

    pub fn load_preferences(&self) -> Result<AppPreferences> {
        let path = self.prefs_path();

        match std::fs::read_to_string(&path) {
            Ok(data) => self.read_json(&path, &data),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(AppPreferences::default()),
            Err(e) => Err(crate::error::AmberError::Io(e)),
        }
    }

    pub fn save_preferences(&self, prefs: &AppPreferences) -> Result<()> {
        let path = self.prefs_path();
        let json = serde_json::to_string_pretty(prefs)
            .map_err(|e| crate::error::AmberError::Store(e.to_string()))?;
        self.write_atomic(&path, json.as_bytes())?;
        Ok(())
    }

    // ===== TIM-128: Destination-based job config =====

    /// Write job config to destination's .amber-meta/job.json
    /// This enables backup drive portability - job config travels with the drive
    pub fn write_job_to_destination(&self, job: &SyncJob) -> Result<()> {
        let meta_dir = manifest_service::get_meta_dir(&job.dest_path);
        let job_path = meta_dir.join(JOB_CONFIG_FILENAME);
        let dest_root = Path::new(&job.dest_path);

        if !dest_root.exists() || !dest_root.is_dir() {
            return Err(crate::error::AmberError::InvalidPath(format!(
                "Destination path is not accessible: {}",
                job.dest_path
            )));
        }

        // Ensure .amber-meta directory exists
        std::fs::create_dir_all(&meta_dir)?;

        let json = serde_json::to_string_pretty(job)
            .map_err(|e| crate::error::AmberError::Store(e.to_string()))?;
        std::fs::write(&job_path, json)?;

        log::info!("Wrote job config to {:?}", job_path);
        Ok(())
    }

    /// Read job config from destination's .amber-meta/job.json
    pub fn read_job_from_destination(dest_path: &str) -> Result<Option<SyncJob>> {
        let meta_dir = manifest_service::get_meta_dir(dest_path);
        let job_path = meta_dir.join(JOB_CONFIG_FILENAME);

        match std::fs::read_to_string(&job_path) {
            Ok(data) => {
                let job: SyncJob = serde_json::from_str(&data)
                    .map_err(|e| crate::error::AmberError::Store(e.to_string()))?;
                Ok(Some(job))
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(crate::error::AmberError::Io(e)),
        }
    }

    /// Check if a job config exists on the destination
    pub fn destination_has_job_config(dest_path: &str) -> bool {
        let meta_dir = manifest_service::get_meta_dir(dest_path);
        let job_path = meta_dir.join(JOB_CONFIG_FILENAME);
        job_path.exists()
    }

    fn read_json<T: DeserializeOwned>(&self, path: &Path, data: &str) -> Result<T> {
        match serde_json::from_str::<T>(data) {
            Ok(parsed) => Ok(parsed),
            Err(e) => {
                let backup_path = self.backup_corrupt_file(path)?;
                Err(crate::error::AmberError::Store(format!(
                    "Failed to parse {}. Moved corrupt file to {}: {}",
                    path.display(),
                    backup_path.display(),
                    e
                )))
            }
        }
    }

    fn backup_corrupt_file(&self, path: &Path) -> Result<PathBuf> {
        let timestamp = chrono::Utc::now().timestamp_millis();
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("data");
        let backup_name = format!("{}.corrupt-{}", file_name, timestamp);
        let backup_path = path.with_file_name(backup_name);
        std::fs::rename(path, &backup_path)?;
        Ok(backup_path)
    }

    /// Write file atomically: write to temp file, then rename
    fn write_atomic(&self, path: &Path, contents: &[u8]) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("data");
        let unique = format!(
            "{}.{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let temp_path = path.with_file_name(format!("{}.{}.tmp", file_name, unique));

        let mut file = std::fs::File::create(&temp_path)?;
        file.write_all(contents)?;
        file.sync_all()?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = std::fs::Permissions::from_mode(0o600);
            std::fs::set_permissions(&temp_path, perms)?;
        }

        if let Err(e) = std::fs::rename(&temp_path, path) {
            if path.exists() {
                std::fs::remove_file(path)?;
                std::fs::rename(&temp_path, path)?;
            } else {
                return Err(crate::error::AmberError::Io(e));
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::job::{SyncJob, SyncMode};
    use tempfile::TempDir;

    fn test_store() -> (Store, TempDir) {
        let dir = TempDir::new().unwrap();
        let store = Store::new(dir.path());
        (store, dir)
    }

    fn test_job(id: &str) -> SyncJob {
        SyncJob {
            id: id.to_string(),
            name: format!("Job {}", id),
            source_path: "/tmp/src".to_string(),
            dest_path: "/tmp/dst".to_string(),
            ..SyncJob::default()
        }
    }

    #[test]
    fn test_load_jobs_empty() {
        let (store, _dir) = test_store();
        let jobs = store.load_jobs().unwrap();
        assert!(jobs.is_empty());
    }

    #[test]
    fn test_save_and_load_job() {
        let (store, _dir) = test_store();
        let job = test_job("j1");
        store.save_job(job.clone()).unwrap();

        let jobs = store.load_jobs().unwrap();
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].id, "j1");
        assert_eq!(jobs[0].name, "Job j1");
    }

    #[test]
    fn test_save_job_updates_existing() {
        let (store, _dir) = test_store();
        store.save_job(test_job("j1")).unwrap();

        let mut updated = test_job("j1");
        updated.name = "Updated".to_string();
        updated.mode = SyncMode::TimeMachine;
        store.save_job(updated).unwrap();

        let jobs = store.load_jobs().unwrap();
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].name, "Updated");
    }

    #[test]
    fn test_delete_job() {
        let (store, _dir) = test_store();
        store.save_job(test_job("j1")).unwrap();
        store.save_job(test_job("j2")).unwrap();
        assert_eq!(store.load_jobs().unwrap().len(), 2);

        store.delete_job("j1").unwrap();
        let jobs = store.load_jobs().unwrap();
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].id, "j2");
    }

    #[test]
    fn test_get_job() {
        let (store, _dir) = test_store();
        store.save_job(test_job("j1")).unwrap();

        assert!(store.get_job("j1").unwrap().is_some());
        assert!(store.get_job("nonexistent").unwrap().is_none());
    }

    #[test]
    fn test_preferences_default() {
        let (store, _dir) = test_store();
        let prefs = store.load_preferences().unwrap();
        assert_eq!(prefs.theme, "system");
        assert!(!prefs.run_in_background);
        assert!(prefs.notifications);
    }

    #[test]
    fn test_save_and_load_preferences() {
        let (store, _dir) = test_store();
        let prefs = AppPreferences {
            theme: "dark".to_string(),
            run_in_background: true,
            ..AppPreferences::default()
        };
        store.save_preferences(&prefs).unwrap();

        let loaded = store.load_preferences().unwrap();
        assert_eq!(loaded.theme, "dark");
        assert!(loaded.run_in_background);
    }

    #[test]
    fn test_corrupt_file_handling() {
        let (store, _dir) = test_store();
        // Write corrupt JSON
        std::fs::write(store.jobs_path(), "not valid json{{{").unwrap();

        let result = store.load_jobs();
        assert!(result.is_err());

        // Corrupt file should have been backed up
        let entries: Vec<_> = std::fs::read_dir(&store.data_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .contains("jobs.json.corrupt-")
            })
            .collect();
        assert_eq!(entries.len(), 1);
    }

    #[test]
    fn test_atomic_write_creates_file() {
        let (store, _dir) = test_store();
        let path = store.data_dir.join("test.json");
        store.write_atomic(&path, b"hello").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "hello");
    }
}
