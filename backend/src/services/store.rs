use crate::error::Result;
use crate::types::job::SyncJob;
use crate::types::preferences::AppPreferences;
use std::path::{Path, PathBuf};

const JOBS_FILENAME: &str = "jobs.json";
const PREFS_FILENAME: &str = "preferences.json";

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
            Ok(data) => {
                let jobs: Vec<SyncJob> = serde_json::from_str(&data)
                    .unwrap_or_else(|_| Vec::new());
                Ok(jobs)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
            Err(e) => Err(crate::error::AmberError::Io(e)),
        }
    }

    pub fn save_jobs(&self, jobs: &[SyncJob]) -> Result<()> {
        let path = self.jobs_path();
        let json = serde_json::to_string_pretty(jobs)
            .map_err(|e| crate::error::AmberError::Store(e.to_string()))?;
        std::fs::write(&path, json)?;
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
            Ok(data) => {
                let prefs: AppPreferences = serde_json::from_str(&data)
                    .unwrap_or_default();
                Ok(prefs)
            }
            Err(_) => Ok(AppPreferences::default()),
        }
    }

    pub fn save_preferences(&self, prefs: &AppPreferences) -> Result<()> {
        let path = self.prefs_path();
        let json = serde_json::to_string_pretty(prefs)
            .map_err(|e| crate::error::AmberError::Store(e.to_string()))?;
        std::fs::write(&path, json)?;
        Ok(())
    }
}
