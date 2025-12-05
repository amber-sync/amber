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
        assert_eq!(
            err.to_string(),
            "Filesystem error: /path/to/file: Permission denied"
        );
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
        assert_eq!(
            err.to_string(),
            "Permission denied: /protected/resource"
        );
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
}
