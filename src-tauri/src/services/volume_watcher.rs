use crate::error::Result;

pub struct VolumeWatcher;

impl VolumeWatcher {
    pub fn new() -> Self {
        Self
    }

    pub async fn start(&self) -> Result<()> {
        // TODO: Implement volume watching
        Ok(())
    }
}
