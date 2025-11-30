use crate::error::Result;

pub struct FileService;

impl FileService {
    pub fn new() -> Self {
        Self
    }

    pub async fn scan_directory(&self, path: &str) -> Result<()> {
        // TODO: Implement directory scanning
        Ok(())
    }
}
