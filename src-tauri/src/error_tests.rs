#[cfg(test)]
mod tests {
    use crate::error::{AmberError, Result};
    use std::io;

    #[test]
    fn test_job_not_found_error() {
        let err = AmberError::job_not_found("test-job-123");
        assert!(matches!(err, AmberError::JobNotFound(_)));
        assert_eq!(err.to_string(), "Job not found: test-job-123");
    }

    #[test]
    fn test_filesystem_error_with_context() {
        let err = AmberError::fs_error("/path/to/file", "Permission denied");
        assert!(matches!(err, AmberError::Filesystem(_)));
        assert_eq!(err.to_string(), "Filesystem error: /path/to/file: Permission denied");
    }

    #[test]
    fn test_database_error() {
        let err = AmberError::database("Connection failed");
        assert!(matches!(err, AmberError::Database(_)));
        assert_eq!(err.to_string(), "Database error: Connection failed");
    }

    #[test]
    fn test_invalid_path_error() {
        let err = AmberError::invalid_path("/invalid/../path");
        assert!(matches!(err, AmberError::InvalidPath(_)));
        assert_eq!(err.to_string(), "Invalid path: /invalid/../path");
    }

    #[test]
    fn test_permission_denied_error() {
        let err = AmberError::permission_denied("/protected/resource");
        assert!(matches!(err, AmberError::PermissionDenied(_)));
        assert_eq!(err.to_string(), "Permission denied: /protected/resource");
    }

    #[test]
    fn test_scheduler_error_with_context() {
        let err = AmberError::scheduler_for_job("job-123", "Failed to schedule");
        assert!(matches!(err, AmberError::Scheduler(_)));
        assert_eq!(err.to_string(), "Scheduler error: job 'job-123': Failed to schedule");
    }

    #[test]
    fn test_snapshot_error_with_context() {
        let err = AmberError::snapshot_for_job("job-456", "Snapshot creation failed");
        assert!(matches!(err, AmberError::Snapshot(_)));
        assert_eq!(err.to_string(), "Snapshot error: job 'job-456': Snapshot creation failed");
    }

    #[test]
    fn test_io_error_conversion() {
        let io_err = io::Error::new(io::ErrorKind::NotFound, "File not found");
        let amber_err: AmberError = io_err.into();
        assert!(matches!(amber_err, AmberError::Io(_)));
    }

    #[test]
    fn test_cancelled_error() {
        let err = AmberError::Cancelled;
        assert_eq!(err.to_string(), "Operation cancelled");
    }

    #[test]
    fn test_validation_error() {
        let err = AmberError::ValidationError("Invalid input".to_string());
        assert!(matches!(err, AmberError::ValidationError(_)));
        assert_eq!(err.to_string(), "Validation error: Invalid input");
    }

    #[test]
    fn test_migration_error() {
        let err = AmberError::Migration("Schema migration failed".to_string());
        assert!(matches!(err, AmberError::Migration(_)));
    }

    #[test]
    fn test_index_error_with_context() {
        let err = AmberError::index_error("rebuild", "Index corrupted");
        assert!(matches!(err, AmberError::Index(_)));
        assert_eq!(err.to_string(), "Index error: rebuild: Index corrupted");
    }

    #[test]
    fn test_error_serialization() {
        let err = AmberError::job_not_found("test-job");
        let serialized = serde_json::to_string(&err).unwrap();
        assert!(serialized.contains("Job not found"));
    }

    #[test]
    fn test_result_type_ok() {
        let result: Result<i32> = Ok(42);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[test]
    fn test_result_type_err() {
        let result: Result<i32> = Err(AmberError::Cancelled);
        assert!(result.is_err());
    }

    #[test]
    fn test_rsync_error() {
        let err = AmberError::Rsync("Process failed with exit code 1".to_string());
        assert!(matches!(err, AmberError::Rsync(_)));
        assert_eq!(err.to_string(), "Rsync failed: Process failed with exit code 1");
    }

    #[test]
    fn test_keychain_error() {
        let err = AmberError::Keychain("Failed to access keychain".to_string());
        assert!(matches!(err, AmberError::Keychain(_)));
    }

    #[test]
    fn test_volume_error() {
        let err = AmberError::Volume("Volume not mounted".to_string());
        assert!(matches!(err, AmberError::Volume(_)));
    }

    #[test]
    fn test_rclone_error() {
        let err = AmberError::Rclone("Upload failed".to_string());
        assert!(matches!(err, AmberError::Rclone(_)));
    }

    #[test]
    fn test_config_error() {
        let err = AmberError::Config("Invalid configuration".to_string());
        assert!(matches!(err, AmberError::Config(_)));
    }

    #[test]
    fn test_not_found_error() {
        let err = AmberError::NotFound("Resource missing".to_string());
        assert!(matches!(err, AmberError::NotFound(_)));
    }

    // Integration tests for error handling scenarios
    #[test]
    fn test_error_chain_propagation() {
        fn inner_operation() -> Result<()> {
            Err(AmberError::invalid_path("/bad/path"))
        }

        fn outer_operation() -> Result<()> {
            inner_operation()?;
            Ok(())
        }

        let result = outer_operation();
        assert!(result.is_err());
        match result.unwrap_err() {
            AmberError::InvalidPath(path) => assert_eq!(path, "/bad/path"),
            _ => panic!("Expected InvalidPath error"),
        }
    }

    #[test]
    fn test_multiple_error_types() {
        let errors = vec![
            AmberError::job_not_found("job1"),
            AmberError::permission_denied("resource"),
            AmberError::Cancelled,
            AmberError::database("connection lost"),
        ];

        assert_eq!(errors.len(), 4);
        for err in errors {
            // All should be convertible to string
            let _ = err.to_string();
        }
    }

    #[test]
    fn test_error_debug_format() {
        let err = AmberError::job_not_found("test-job");
        let debug_str = format!("{:?}", err);
        assert!(debug_str.contains("JobNotFound"));
    }
}
