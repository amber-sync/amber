import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Path to the binary
const SIDECAR_NAME = 'amber-sidecar';
const SIDECAR_PATH = IS_DEV
  ? path.join(__dirname, '../../amber-sidecar/target/release', SIDECAR_NAME)
  : path.join(process.resourcesPath, SIDECAR_NAME);

export interface FileEntry {
  path: string;
  name: string;
  is_dir: boolean;
  size: number;
  modified: number;
}

export class FileService {
  /**
   * Scans a directory using the Rust sidecar.
   * Emits 'entry' events for each file found.
   */
  scan(dirPath: string, onEntry: (entry: FileEntry) => void, onError: (err: string) => void): Promise<void> {
    return this.runSidecar(['scan', dirPath], onEntry, onError);
  }

  /**
   * Searches a directory recursively.
   */
  search(dirPath: string, query: string, onEntry: (entry: FileEntry) => void, onError: (err: string) => void): Promise<void> {
    return this.runSidecar(['search', dirPath, query], onEntry, onError);
  }

  /**
   * Generates a sandbox environment with dummy files using the sidecar.
   */
  generateSandbox(path: string, count: number, onData: (data: string) => void, onError: (err: string) => void): Promise<void> {
    return this.runSidecar(['generate', path, '--count', count.toString()], (entry) => {
      // Generate command might output text, not JSON entries.
      // We need to handle this.
      // But runSidecar expects JSON parsing.
      // I should modify runSidecar or create a separate method for raw output.
      // For now, let's assume generate outputs text and we might get parse errors if we use runSidecar.
      // Let's create a specialized method or modify runSidecar to handle non-JSON.
    }, onError);
  }

  /**
   * Runs the sidecar command.
   * Supports both JSON stream (for scan/search) and raw text (for generate).
   */
  private runSidecar(args: string[], onEntry: (entry: any) => void, onError: (err: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      log.info(`Spawning sidecar: ${SIDECAR_PATH} ${args.join(' ')}`);
      
      const child = spawn(SIDECAR_PATH, args);
      let buffer = '';

      child.stdout.on('data', (chunk) => {
        const str = chunk.toString();
        // If generating, we might just want to log or callback with raw string
        if (args[0] === 'generate') {
           // For generate, we just pass the raw output if needed, or ignore.
           // The sidecar prints "." for progress and "Done." at the end.
           return;
        }

        buffer += str;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const entry = JSON.parse(line);
            onEntry(entry);
          } catch (e) {
            log.error(`Failed to parse sidecar output: ${line}`, e);
          }
        }
      });

      child.stderr.on('data', (chunk) => {
        const msg = chunk.toString();
        log.error(`Sidecar stderr: ${msg}`);
        onError(msg);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const msg = `Sidecar exited with code ${code}`;
          log.error(msg);
          reject(new Error(msg));
        }
      });

      child.on('error', (err) => {
        log.error(`Failed to start sidecar: ${err.message}`);
        reject(err);
      });
    });
  }
}
