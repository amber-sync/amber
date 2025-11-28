import { app } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';

const execAsync = promisify(exec);

const RCLONE_VERSION = '1.65.0';

/**
 * Auto-installer for Rclone
 * Downloads and installs Rclone if not already present
 */
export class RcloneInstaller {
  
  private getInstallPath(): string {
    const appData = app.getPath('userData');
    return path.join(appData, 'bin');
  }

  private getDownloadUrl(): string {
    const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
    return `https://downloads.rclone.org/v${RCLONE_VERSION}/rclone-v${RCLONE_VERSION}-osx-${arch}.zip`;
  }

  /**
   * Check if Rclone is installed (system-wide or in app directory)
   */
  async isInstalled(): Promise<boolean> {
    try {
      // Check system installation
      await execAsync('which rclone');
      log.info('[RcloneInstaller] System rclone found');
      return true;
    } catch {
      // Check app-local installation
      const localRclone = path.join(this.getInstallPath(), 'rclone');
      if (fs.existsSync(localRclone)) {
        log.info('[RcloneInstaller] App-local rclone found');
        return true;
      }
      return false;
    }
  }

  /**
   * Download Rclone binary
   */
  private async download(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          if (response.headers.location) {
            this.download(response.headers.location, dest).then(resolve).catch(reject);
            return;
          }
        }

        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlinkSync(dest);
        reject(err);
      });
    });
  }

  /**
   * Install Rclone to app directory
   */
  async install(): Promise<{ success: boolean; message: string }> {
    try {
      const installPath = this.getInstallPath();
      log.info(`[RcloneInstaller] Starting Rclone installation to ${installPath}`);

      // Create bin directory if it doesn't exist
      if (!fs.existsSync(installPath)) {
        fs.mkdirSync(installPath, { recursive: true });
      }

      // Download zip
      const zipPath = path.join(app.getPath('temp'), 'rclone.zip');
      const downloadUrl = this.getDownloadUrl();
      log.info(`[RcloneInstaller] Downloading from ${downloadUrl}`);
      
      await this.download(downloadUrl, zipPath);
      
      log.info('[RcloneInstaller] Download complete, extracting...');

      // Extract using unzip command
      const extractDir = path.join(app.getPath('temp'), 'rclone-extract');
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
      fs.mkdirSync(extractDir, { recursive: true });

      await execAsync(`unzip -o "${zipPath}" -d "${extractDir}"`);

      // Find and copy rclone binary
      const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
      const rcloneBinary = path.join(extractDir, `rclone-v${RCLONE_VERSION}-osx-${arch}`, 'rclone');
      const targetPath = path.join(installPath, 'rclone');

      if (!fs.existsSync(rcloneBinary)) {
        // Fallback: try to find it recursively if structure is different
        throw new Error(`Rclone binary not found at expected path: ${rcloneBinary}`);
      }

      fs.copyFileSync(rcloneBinary, targetPath);
      fs.chmodSync(targetPath, '755'); // Make executable

      // Cleanup
      fs.unlinkSync(zipPath);
      fs.rmSync(extractDir, { recursive: true, force: true });
      
      // Add to PATH for this session
      process.env.PATH = `${installPath}:${process.env.PATH}`;

      log.info('[RcloneInstaller] Installation complete');
      
      return {
        success: true,
        message: `Rclone v${RCLONE_VERSION} installed successfully`
      };
    } catch (error: any) {
      log.error('[RcloneInstaller] Installation failed:', error);
      return {
        success: false,
        message: `Installation failed: ${error.message}`
      };
    }
  }

  /**
   * Get the path to the rclone executable
   */
  async getRclonePath(): Promise<string> {
     try {
      // Check system installation first
      await execAsync('which rclone');
      return 'rclone';
    } catch {
      // Use local installation
      return path.join(this.getInstallPath(), 'rclone');
    }
  }

  /**
   * Auto-install if not present
   * Call this on app startup
   */
  async ensureInstalled(): Promise<void> {
    const installed = await this.isInstalled();
    
    if (!installed) {
      log.info('[RcloneInstaller] Rclone not found, auto-installing...');
      const result = await this.install();
      
      if (result.success) {
        log.info('[RcloneInstaller] Auto-installation successful');
      } else {
        log.warn('[RcloneInstaller] Auto-installation failed:', result.message);
      }
    } else {
      log.info('[RcloneInstaller] Rclone already installed');
    }
  }
}

// Singleton
export const rcloneInstaller = new RcloneInstaller();