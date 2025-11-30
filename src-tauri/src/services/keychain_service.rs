use keyring::Entry;

use crate::error::{AmberError, Result};

const SERVICE_NAME: &str = "Amber Backup";

/// Secure credential storage using macOS Keychain
/// All encryption passwords are stored here, never in plain text
pub struct KeychainService;

impl KeychainService {
    pub fn new() -> Self {
        Self
    }

    /// Store encryption password securely in keychain
    pub fn set_password(&self, job_id: &str, password: &str) -> Result<()> {
        let account = format!("cloud-encrypt-{}", job_id);
        let entry = Entry::new(SERVICE_NAME, &account)
            .map_err(|e| AmberError::Keychain(format!("Failed to create keychain entry: {}", e)))?;

        entry.set_password(password)
            .map_err(|e| AmberError::Keychain(format!("Failed to store password: {}", e)))?;

        log::info!("[Keychain] Stored password for job {}", job_id);
        Ok(())
    }

    /// Retrieve encryption password from keychain
    pub fn get_password(&self, job_id: &str) -> Result<Option<String>> {
        let account = format!("cloud-encrypt-{}", job_id);
        let entry = Entry::new(SERVICE_NAME, &account)
            .map_err(|e| AmberError::Keychain(format!("Failed to create keychain entry: {}", e)))?;

        match entry.get_password() {
            Ok(password) => {
                log::info!("[Keychain] Retrieved password for job {}", job_id);
                Ok(Some(password))
            }
            Err(keyring::Error::NoEntry) => {
                log::warn!("[Keychain] No password found for job {}", job_id);
                Ok(None)
            }
            Err(e) => {
                log::error!("[Keychain] Failed to retrieve password: {}", e);
                Err(AmberError::Keychain(format!("Failed to retrieve password: {}", e)))
            }
        }
    }

    /// Delete encryption password from keychain
    pub fn delete_password(&self, job_id: &str) -> Result<bool> {
        let account = format!("cloud-encrypt-{}", job_id);
        let entry = Entry::new(SERVICE_NAME, &account)
            .map_err(|e| AmberError::Keychain(format!("Failed to create keychain entry: {}", e)))?;

        match entry.delete_credential() {
            Ok(()) => {
                log::info!("[Keychain] Deleted password for job {}", job_id);
                Ok(true)
            }
            Err(keyring::Error::NoEntry) => {
                log::warn!("[Keychain] No password to delete for job {}", job_id);
                Ok(false)
            }
            Err(e) => {
                log::error!("[Keychain] Failed to delete password: {}", e);
                Err(AmberError::Keychain(format!("Failed to delete password: {}", e)))
            }
        }
    }

    /// Update encryption password (just re-sets it)
    pub fn update_password(&self, job_id: &str, new_password: &str) -> Result<()> {
        self.set_password(job_id, new_password)
    }

    /// Check if password exists for job
    pub fn has_password(&self, job_id: &str) -> Result<bool> {
        Ok(self.get_password(job_id)?.is_some())
    }

    /// Store SSH key passphrase
    pub fn set_ssh_passphrase(&self, key_path: &str, passphrase: &str) -> Result<()> {
        let account = format!("ssh-key-{}", key_path.replace('/', "-"));
        let entry = Entry::new(SERVICE_NAME, &account)
            .map_err(|e| AmberError::Keychain(format!("Failed to create keychain entry: {}", e)))?;

        entry.set_password(passphrase)
            .map_err(|e| AmberError::Keychain(format!("Failed to store SSH passphrase: {}", e)))?;

        log::info!("[Keychain] Stored SSH passphrase for key {}", key_path);
        Ok(())
    }

    /// Retrieve SSH key passphrase
    pub fn get_ssh_passphrase(&self, key_path: &str) -> Result<Option<String>> {
        let account = format!("ssh-key-{}", key_path.replace('/', "-"));
        let entry = Entry::new(SERVICE_NAME, &account)
            .map_err(|e| AmberError::Keychain(format!("Failed to create keychain entry: {}", e)))?;

        match entry.get_password() {
            Ok(password) => {
                log::info!("[Keychain] Retrieved SSH passphrase for key {}", key_path);
                Ok(Some(password))
            }
            Err(keyring::Error::NoEntry) => {
                Ok(None)
            }
            Err(e) => {
                log::error!("[Keychain] Failed to retrieve SSH passphrase: {}", e);
                Err(AmberError::Keychain(format!("Failed to retrieve SSH passphrase: {}", e)))
            }
        }
    }

    /// Store generic credential (for cloud providers, etc.)
    pub fn set_credential(&self, service: &str, account: &str, secret: &str) -> Result<()> {
        let full_service = format!("{}-{}", SERVICE_NAME, service);
        let entry = Entry::new(&full_service, account)
            .map_err(|e| AmberError::Keychain(format!("Failed to create keychain entry: {}", e)))?;

        entry.set_password(secret)
            .map_err(|e| AmberError::Keychain(format!("Failed to store credential: {}", e)))?;

        log::info!("[Keychain] Stored credential for {}/{}", service, account);
        Ok(())
    }

    /// Retrieve generic credential
    pub fn get_credential(&self, service: &str, account: &str) -> Result<Option<String>> {
        let full_service = format!("{}-{}", SERVICE_NAME, service);
        let entry = Entry::new(&full_service, account)
            .map_err(|e| AmberError::Keychain(format!("Failed to create keychain entry: {}", e)))?;

        match entry.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(AmberError::Keychain(format!("Failed to retrieve credential: {}", e)))
        }
    }

    /// Delete generic credential
    pub fn delete_credential(&self, service: &str, account: &str) -> Result<bool> {
        let full_service = format!("{}-{}", SERVICE_NAME, service);
        let entry = Entry::new(&full_service, account)
            .map_err(|e| AmberError::Keychain(format!("Failed to create keychain entry: {}", e)))?;

        match entry.delete_credential() {
            Ok(()) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(e) => Err(AmberError::Keychain(format!("Failed to delete credential: {}", e)))
        }
    }
}

impl Default for KeychainService {
    fn default() -> Self {
        Self::new()
    }
}
