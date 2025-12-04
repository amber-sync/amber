//! Integration tests for path validation security
//!
//! These tests verify that path traversal attacks are properly prevented

use app_lib::security::PathValidator;
use std::fs;
use std::path::Path;

#[test]
fn test_prevent_etc_passwd_access() {
    let test_dir = std::env::temp_dir().join("amber_sec_test_1");
    let _ = fs::remove_dir_all(&test_dir);
    fs::create_dir_all(&test_dir).unwrap();

    let mut validator = PathValidator::new();
    validator.add_root(&test_dir).unwrap();

    // Attempt to access /etc/passwd
    let result = validator.validate("/etc/passwd");
    assert!(result.is_err(), "Should block access to /etc/passwd");

    // Attempt using path traversal
    let evil_path = format!("{}/../../../etc/passwd", test_dir.display());
    let result = validator.validate(&evil_path);
    assert!(
        result.is_err(),
        "Should block path traversal to /etc/passwd"
    );

    fs::remove_dir_all(&test_dir).unwrap();
}

#[test]
fn test_prevent_ssh_key_access() {
    let test_dir = std::env::temp_dir().join("amber_sec_test_2");
    let _ = fs::remove_dir_all(&test_dir);
    fs::create_dir_all(&test_dir).unwrap();

    let mut validator = PathValidator::new();
    validator.add_root(&test_dir).unwrap();

    // Attempt to access SSH private key
    if let Some(home) = dirs::home_dir() {
        let ssh_key = home.join(".ssh/id_rsa");
        if ssh_key.exists() {
            // Try direct access (should fail - not in allowed roots)
            let result = validator.validate(ssh_key.to_str().unwrap());
            assert!(result.is_err(), "Should block access to SSH private key");
        }
    }

    fs::remove_dir_all(&test_dir).unwrap();
}

#[test]
fn test_prevent_url_encoded_traversal() {
    let test_dir = std::env::temp_dir().join("amber_sec_test_3");
    let _ = fs::remove_dir_all(&test_dir);
    fs::create_dir_all(&test_dir).unwrap();

    let mut validator = PathValidator::new();
    validator.add_root(&test_dir).unwrap();

    // URL-encoded ".." = %2e%2e
    let evil_path = format!("{}/%2e%2e/%2e%2e/%2e%2e/etc/passwd", test_dir.display());
    let result = validator.validate(&evil_path);
    assert!(result.is_err(), "Should block URL-encoded traversal");

    fs::remove_dir_all(&test_dir).unwrap();
}

#[test]
fn test_prevent_null_byte_injection() {
    let test_dir = std::env::temp_dir().join("amber_sec_test_4");
    let _ = fs::remove_dir_all(&test_dir);
    fs::create_dir_all(&test_dir).unwrap();

    let mut validator = PathValidator::new();
    validator.add_root(&test_dir).unwrap();

    // Null byte injection attempt
    let evil_path = format!("{}/test.txt\0secret", test_dir.display());
    let result = validator.validate(&evil_path);
    assert!(result.is_err(), "Should block null byte injection");

    fs::remove_dir_all(&test_dir).unwrap();
}

#[cfg(unix)]
#[test]
fn test_prevent_symlink_escape() {
    use std::os::unix::fs::symlink;

    let test_dir = std::env::temp_dir().join("amber_sec_test_5");
    let outside_dir = std::env::temp_dir().join("amber_outside_5");

    let _ = fs::remove_dir_all(&test_dir);
    let _ = fs::remove_dir_all(&outside_dir);

    fs::create_dir_all(&test_dir).unwrap();
    fs::create_dir_all(&outside_dir).unwrap();

    // Create secret file outside allowed directory
    let secret_file = outside_dir.join("secret.txt");
    fs::write(&secret_file, "SECRET_DATA").unwrap();

    // Create symlink inside test directory pointing to outside file
    let symlink_path = test_dir.join("innocent_link");
    symlink(&secret_file, &symlink_path).unwrap();

    let mut validator = PathValidator::new();
    validator.add_root(&test_dir).unwrap();

    // Attempt to access via symlink - should fail because target is outside root
    let result = validator.validate(symlink_path.to_str().unwrap());
    assert!(
        result.is_err(),
        "Should block symlink pointing outside allowed root"
    );

    fs::remove_dir_all(&test_dir).unwrap();
    fs::remove_dir_all(&outside_dir).unwrap();
}

#[test]
fn test_allow_valid_paths() {
    let test_dir = std::env::temp_dir().join("amber_sec_test_6");
    let _ = fs::remove_dir_all(&test_dir);
    fs::create_dir_all(&test_dir).unwrap();

    let test_file = test_dir.join("valid.txt");
    fs::write(&test_file, "valid content").unwrap();

    let mut validator = PathValidator::new();
    validator.add_root(&test_dir).unwrap();

    // Should allow access to file within allowed root
    let result = validator.validate(test_file.to_str().unwrap());
    assert!(result.is_ok(), "Should allow valid path within root");

    fs::remove_dir_all(&test_dir).unwrap();
}

#[test]
fn test_multiple_roots() {
    let test_dir1 = std::env::temp_dir().join("amber_sec_test_7a");
    let test_dir2 = std::env::temp_dir().join("amber_sec_test_7b");

    let _ = fs::remove_dir_all(&test_dir1);
    let _ = fs::remove_dir_all(&test_dir2);

    fs::create_dir_all(&test_dir1).unwrap();
    fs::create_dir_all(&test_dir2).unwrap();

    let file1 = test_dir1.join("file1.txt");
    let file2 = test_dir2.join("file2.txt");

    fs::write(&file1, "content1").unwrap();
    fs::write(&file2, "content2").unwrap();

    let mut validator = PathValidator::new();
    validator.add_root(&test_dir1).unwrap();
    validator.add_root(&test_dir2).unwrap();

    // Both files should be accessible
    assert!(validator.validate(file1.to_str().unwrap()).is_ok());
    assert!(validator.validate(file2.to_str().unwrap()).is_ok());

    // But not files outside both roots
    let outside = std::env::temp_dir().join("amber_outside_7.txt");
    fs::write(&outside, "outside").unwrap();
    assert!(validator.validate(outside.to_str().unwrap()).is_err());

    fs::remove_dir_all(&test_dir1).unwrap();
    fs::remove_dir_all(&test_dir2).unwrap();
    let _ = fs::remove_file(&outside);
}

#[test]
fn test_standard_roots_include_home() {
    let test_dir = std::env::temp_dir().join("amber_sec_test_8");
    let _ = fs::remove_dir_all(&test_dir);
    fs::create_dir_all(&test_dir).unwrap();

    let validator = PathValidator::with_standard_roots(&test_dir).unwrap();

    // Should allow access to files in home directory
    if let Some(home) = dirs::home_dir() {
        // Test with a common file that usually exists
        let test_paths = [
            home.join(".bashrc"),
            home.join(".profile"),
            home.join(".zshrc"),
        ];

        let mut found_accessible = false;
        for path in &test_paths {
            if path.exists() {
                let result = validator.validate(path.to_str().unwrap());
                assert!(
                    result.is_ok(),
                    "Should allow access to home directory files"
                );
                found_accessible = true;
                break;
            }
        }

        // If none exist, just verify home directory itself is accessible
        if !found_accessible && home.exists() {
            let result = validator.validate(home.to_str().unwrap());
            assert!(result.is_ok(), "Should allow access to home directory");
        }
    }

    fs::remove_dir_all(&test_dir).unwrap();
}

#[test]
fn test_volumes_are_allowed() {
    let test_dir = std::env::temp_dir().join("amber_sec_test_9");
    let _ = fs::remove_dir_all(&test_dir);
    fs::create_dir_all(&test_dir).unwrap();

    let validator = PathValidator::with_standard_roots(&test_dir).unwrap();

    // /Volumes should be accessible (for external drives)
    let volumes = Path::new("/Volumes");
    if volumes.exists() {
        let result = validator.validate(volumes.to_str().unwrap());
        assert!(result.is_ok(), "Should allow access to /Volumes");
    }

    fs::remove_dir_all(&test_dir).unwrap();
}
