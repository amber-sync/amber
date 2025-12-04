use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_cron_scheduler::{Job, JobScheduler as TokioScheduler};
use uuid::Uuid;

use crate::error::{AmberError, Result};
use crate::types::job::SyncJob;

/// Job scheduler for cron-based backup scheduling
pub struct JobScheduler {
    scheduler: Arc<RwLock<Option<TokioScheduler>>>,
    /// Maps our job IDs to scheduler UUIDs
    job_mappings: Arc<RwLock<HashMap<String, Uuid>>>,
    /// Registered jobs for volume mount handling
    registered_jobs: Arc<RwLock<Vec<SyncJob>>>,
}

impl JobScheduler {
    pub fn new() -> Self {
        Self {
            scheduler: Arc::new(RwLock::new(None)),
            job_mappings: Arc::new(RwLock::new(HashMap::new())),
            registered_jobs: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Initialize the scheduler
    pub async fn init(&self) -> Result<()> {
        let scheduler = TokioScheduler::new()
            .await
            .map_err(|e| AmberError::Scheduler(format!("Failed to create scheduler: {}", e)))?;

        scheduler
            .start()
            .await
            .map_err(|e| AmberError::Scheduler(format!("Failed to start scheduler: {}", e)))?;

        let mut sched = self.scheduler.write().await;
        *sched = Some(scheduler);

        log::info!("JobScheduler initialized");
        Ok(())
    }

    /// Initialize with a list of jobs
    pub async fn init_with_jobs(&self, jobs: Vec<SyncJob>) -> Result<()> {
        self.init().await?;

        // Store registered jobs
        {
            let mut registered = self.registered_jobs.write().await;
            *registered = jobs.clone();
        }

        // Schedule enabled jobs
        for job in jobs {
            if let Some(ref schedule) = job.schedule {
                if schedule.enabled {
                    if let Err(e) = self.schedule_job(&job).await {
                        log::error!("Failed to schedule job '{}': {}", job.name, e);
                    }
                }
            }
        }

        log::info!("JobScheduler initialized with jobs");
        Ok(())
    }

    /// Update jobs - cancel all and re-schedule
    pub async fn update_jobs(&self, jobs: Vec<SyncJob>) -> Result<()> {
        // Cancel all existing schedules
        self.cancel_all_jobs().await?;

        // Update registered jobs
        {
            let mut registered = self.registered_jobs.write().await;
            *registered = jobs.clone();
        }

        // Re-schedule enabled jobs
        for job in jobs {
            if let Some(ref schedule) = job.schedule {
                if schedule.enabled {
                    if let Err(e) = self.schedule_job(&job).await {
                        log::error!("Failed to schedule job '{}': {}", job.name, e);
                    }
                }
            }
        }

        Ok(())
    }

    /// Schedule a single job
    pub async fn schedule_job(&self, job: &SyncJob) -> Result<()> {
        let schedule = job
            .schedule
            .as_ref()
            .ok_or_else(|| AmberError::Scheduler("Job has no schedule".into()))?;

        if !schedule.enabled {
            return Ok(());
        }

        let cron_expr = schedule
            .cron
            .as_ref()
            .ok_or_else(|| AmberError::Scheduler("Job has no cron expression".into()))?;

        let sched_guard = self.scheduler.read().await;
        let scheduler = sched_guard
            .as_ref()
            .ok_or_else(|| AmberError::Scheduler("Scheduler not initialized".into()))?;

        let job_id = job.id.clone();
        let job_name = job.name.clone();

        // Create the cron job
        let cron_job = Job::new_async(cron_expr.as_str(), move |_uuid, _lock| {
            let job_id = job_id.clone();
            let job_name = job_name.clone();
            Box::pin(async move {
                log::info!("Executing scheduled job: {} ({})", job_name, job_id);
                // The actual backup execution will be triggered via Tauri events
                // This allows the frontend to handle progress updates
            })
        })
        .map_err(|e| {
            AmberError::Scheduler(format!("Invalid cron expression '{}': {}", cron_expr, e))
        })?;

        let uuid = scheduler
            .add(cron_job)
            .await
            .map_err(|e| AmberError::Scheduler(format!("Failed to add job to scheduler: {}", e)))?;

        // Store the mapping
        {
            let mut mappings = self.job_mappings.write().await;
            mappings.insert(job.id.clone(), uuid);
        }

        log::info!("Scheduled job '{}' with cron: {}", job.name, cron_expr);
        Ok(())
    }

    /// Cancel a specific job's schedule
    pub async fn cancel_job(&self, job_id: &str) -> Result<()> {
        let uuid = {
            let mut mappings = self.job_mappings.write().await;
            mappings.remove(job_id)
        };

        if let Some(uuid) = uuid {
            let sched_guard = self.scheduler.read().await;
            if let Some(scheduler) = sched_guard.as_ref() {
                scheduler
                    .remove(&uuid)
                    .await
                    .map_err(|e| AmberError::Scheduler(format!("Failed to remove job: {}", e)))?;
                log::info!("Cancelled schedule for job {}", job_id);
            }
        }

        Ok(())
    }

    /// Cancel all scheduled jobs
    pub async fn cancel_all_jobs(&self) -> Result<()> {
        let uuids: Vec<Uuid> = {
            let mut mappings = self.job_mappings.write().await;
            let uuids: Vec<_> = mappings.values().cloned().collect();
            mappings.clear();
            uuids
        };

        let sched_guard = self.scheduler.read().await;
        if let Some(scheduler) = sched_guard.as_ref() {
            for uuid in uuids {
                if let Err(e) = scheduler.remove(&uuid).await {
                    log::warn!("Failed to remove job {}: {}", uuid, e);
                }
            }
        }

        log::info!("Cancelled all scheduled jobs");
        Ok(())
    }

    /// Handle volume mount - check if any jobs should run
    pub async fn handle_volume_mount(&self, mount_path: &str) -> Vec<SyncJob> {
        let registered = self.registered_jobs.read().await;
        let mut jobs_to_run = Vec::new();

        for job in registered.iter() {
            // Check if job destination starts with the mount path
            if job.dest_path.starts_with(mount_path) {
                // Verify destination is accessible
                if std::path::Path::new(&job.dest_path).exists() {
                    log::info!("Destination reachable for job '{}'", job.name);

                    if self.is_job_due(job) {
                        log::info!("Job '{}' is due. Adding to run queue...", job.name);
                        jobs_to_run.push(job.clone());
                    }
                } else {
                    log::info!(
                        "Job '{}' matched mount path but destination not accessible: {}",
                        job.name,
                        job.dest_path
                    );
                }
            }
        }

        jobs_to_run
    }

    /// Check if a job is due to run (missed schedule while volume was unmounted)
    fn is_job_due(&self, job: &SyncJob) -> bool {
        // Simple logic: If it has a schedule and is enabled, consider it due
        // A more sophisticated check would compare lastRun against expected schedule
        if let Some(ref schedule) = job.schedule {
            if schedule.enabled {
                return true;
            }
        }
        false
    }

    /// Get the next scheduled run time for a job
    pub async fn get_next_run(&self, job_id: &str) -> Option<chrono::DateTime<chrono::Utc>> {
        let mappings = self.job_mappings.read().await;
        if let Some(_uuid) = mappings.get(job_id) {
            // tokio-cron-scheduler doesn't expose next run time easily
            // Would need to parse cron expression manually
            None
        } else {
            None
        }
    }

    /// Shutdown the scheduler
    pub async fn shutdown(&self) -> Result<()> {
        self.cancel_all_jobs().await?;

        let mut sched_guard = self.scheduler.write().await;
        if let Some(mut scheduler) = sched_guard.take() {
            scheduler.shutdown().await.map_err(|e| {
                AmberError::Scheduler(format!("Failed to shutdown scheduler: {}", e))
            })?;
        }

        log::info!("JobScheduler shutdown complete");
        Ok(())
    }
}

impl Default for JobScheduler {
    fn default() -> Self {
        Self::new()
    }
}
