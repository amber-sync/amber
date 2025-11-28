import keytar from 'keytar';
import log from 'electron-log';

const SERVICE_NAME = 'Amber Backup';

/**
 * Secure password storage using macOS Keychain
 * All encryption passwords are stored here, never in plain text
 */
export class KeychainService {
  /**
   * Store encryption password securely in keychain
   * @param jobId - Unique job identifier
   * @param password - Encryption password to store
   */
  async setPassword(jobId: string, password: string): Promise<void> {
    try {
      const account = `cloud-encrypt-${jobId}`;
      await keytar.setPassword(SERVICE_NAME, account, password);
      log.info(`[Keychain] Stored password for job ${jobId}`);
    } catch (error: any) {
      log.error(`[Keychain] Failed to store password:`, error);
      throw new Error(`Failed to store password securely: ${error.message}`);
    }
  }

  /**
   * Retrieve encryption password from keychain
   * @param jobId - Unique job identifier
   * @returns Password or null if not found
   */
  async getPassword(jobId: string): Promise<string | null> {
    try {
      const account = `cloud-encrypt-${jobId}`;
      const password = await keytar.getPassword(SERVICE_NAME, account);
      if (password) {
        log.info(`[Keychain] Retrieved password for job ${jobId}`);
      } else {
        log.warn(`[Keychain] No password found for job ${jobId}`);
      }
      return password;
    } catch (error: any) {
      log.error(`[Keychain] Failed to retrieve password:`, error);
      return null;
    }
  }

  /**
   * Delete encryption password from keychain
   * @param jobId - Unique job identifier
   */
  async deletePassword(jobId: string): Promise<boolean> {
    try {
      const account = `cloud-encrypt-${jobId}`;
      const deleted = await keytar.deletePassword(SERVICE_NAME, account);
      if (deleted) {
        log.info(`[Keychain] Deleted password for job ${jobId}`);
      }
      return deleted;
    } catch (error: any) {
      log.error(`[Keychain] Failed to delete password:`, error);
      return false;
    }
  }

  /**
   * Update encryption password
   * @param jobId - Unique job identifier
   * @param newPassword - New password to store
   */
  async updatePassword(jobId: string, newPassword: string): Promise<void> {
    await this.setPassword(jobId, newPassword);
  }

  /**
   * Check if password exists for job
   * @param jobId - Unique job identifier
   */
  async hasPassword(jobId: string): Promise<boolean> {
    const password = await this.getPassword(jobId);
    return password !== null;
  }
}

// Singleton instance
export const keychainService = new KeychainService();
