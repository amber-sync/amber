import { spawn, ChildProcess } from 'child_process';

export interface CloudConfig {
  remoteName: string;
  remotePath?: string;
  encrypt: boolean;
  encryptPassword?: string;
  bandwidth?: string;
}

export interface RcloneInstallInfo {
  installed: boolean;
  version?: string;
  path?: string;
}

export interface RcloneRemote {
  name: string;
  type: string; // e.g., 's3', 'drive', 'dropbox'
}

export class RcloneService {
  private rclonePath: string = 'rclone'; // Assume in PATH

  /**
   * Check if Rclone is installed and get version
   */
  async checkInstalled(): Promise<RcloneInstallInfo> {
    return new Promise((resolve) => {
      const proc = spawn(this.rclonePath, ['version'], { shell: true });
      let output = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          // Parse version from output like "rclone v1.65.0"
          const versionMatch = output.match(/rclone v([\d.]+)/);
          resolve({
            installed: true,
            version: versionMatch ? versionMatch[1] : 'unknown',
            path: this.rclonePath,
          });
        } else {
          resolve({ installed: false });
        }
      });

      proc.on('error', () => {
        resolve({ installed: false });
      });
    });
  }

  /**
   * List all configured Rclone remotes
   */
  async listRemotes(): Promise<RcloneRemote[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.rclonePath, ['listremotes', '--long'], { shell: true });
      let output = '';
      let errorOutput = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to list remotes: ${errorOutput}`));
          return;
        }

        // Parse output like:
        // myS3: s3
        // gdrive: drive
        const remotes: RcloneRemote[] = [];
        output.trim().split('\n').forEach((line) => {
          const [fullName, type] = line.split(/\s+/);
          if (fullName) {
            const name = fullName.replace(':', ''); // Remove trailing colon
            remotes.push({ name, type: type || 'unknown' });
          }
        });

        resolve(remotes);
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Sync files to cloud remote
   * @param sourcePath - Local source directory
   * @param cloudConfig - Cloud configuration
   * @returns ChildProcess for progress monitoring
   */
  syncToCloud(sourcePath: string, cloudConfig: CloudConfig): ChildProcess {
    const args: string[] = ['sync', sourcePath];

    // Build remote destination
    let destination = cloudConfig.remoteName;
    if (!destination.endsWith(':')) {
      destination += ':';
    }
    if (cloudConfig.remotePath) {
      destination += cloudConfig.remotePath;
    }
    args.push(destination);

    // Add progress and stats flags
    args.push('--progress');
    args.push('--stats', '1s'); // Update stats every second
    args.push('--stats-one-line'); // Single line for easier parsing

    // Add bandwidth limit if specified
    if (cloudConfig.bandwidth) {
      args.push('--bwlimit', cloudConfig.bandwidth);
    }

    // Add encryption if enabled
    // Note: This assumes the user has set up a crypt remote
    // The actual encryption setup is done via `rclone config`
    if (cloudConfig.encrypt && cloudConfig.encryptPassword) {
      // For now, we'll document that users should set up crypt remotes manually
      // A future enhancement could be auto-configuring crypt remotes
      console.log('Encryption note: Ensure your remote is configured as a crypt remote');
    }

    // Add verbose mode for detailed logging
    args.push('-v');

    console.log('[RcloneService] Command:', this.rclonePath, args.join(' '));

    return spawn(this.rclonePath, args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  /**
   * Open Rclone config in terminal
   * This allows users to set up new remotes
   */
  async launchConfig(): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      // On macOS, open a new Terminal window with rclone config
      // Note: This is macOS-specific. Cross-platform support would need adjustments
      const script = `osascript -e 'tell application "Terminal" to do script "rclone config; exit"'`;
      
      const proc = spawn(script, [], { shell: true });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, message: 'Opened Rclone config in Terminal' });
        } else {
          resolve({ success: false, message: 'Failed to open Terminal' });
        }
      });

      proc.on('error', (err) => {
        resolve({ success: false, message: err.message });
      });
    });
  }
}

// Singleton instance
export const rcloneService = new RcloneService();
