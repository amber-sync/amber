use crate::error::Result;

pub struct RsyncService;

impl RsyncService {
    pub fn new() -> Self {
        Self
    }

    pub async fn run_backup(&self) -> Result<()> {
        // TODO: Implement rsync backup
        Ok(())
    }
}
