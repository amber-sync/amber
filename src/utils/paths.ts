/**
 * Centralized path handling for consistent conventions across the codebase.
 *
 * ## Path Conventions
 *
 * - **ABSOLUTE**: Full filesystem path (e.g., `/Volumes/Backup/snap-2024-01-01/Users/john`)
 * - **RELATIVE**: Path relative to snapshot root (e.g., `Users/john`)
 * - **SSH_REMOTE**: user@host:/path format
 *
 * ## Storage Conventions
 *
 * - SQLite `files.path`: ABSOLUTE paths
 * - SQLite `files.parent_path`: RELATIVE paths (from snapshot root)
 * - SQLite `files.mtime`: Unix SECONDS (converted at API boundary)
 * - SQLite `snapshots.timestamp`: Unix MILLISECONDS
 * - Manifest timestamps: Unix MILLISECONDS
 *
 * @module utils/paths
 */

/**
 * Check if a path is an SSH remote (user@host:/path format)
 *
 * @example
 * isSshRemote('user@host:/var/www') // true
 * isSshRemote('/local/path') // false
 */
export function isSshRemote(path: string): boolean {
  return !path.startsWith('/') && path.includes('@') && path.includes(':');
}

/**
 * Extract the local path part from an SSH remote path
 *
 * @returns The local path, or null if not an SSH remote
 *
 * @example
 * sshLocalPart('user@host:/var/www') // '/var/www'
 * sshLocalPart('/local/path') // null
 */
export function sshLocalPart(path: string): string | null {
  if (!isSshRemote(path)) return null;
  const colonIndex = path.indexOf(':');
  return colonIndex >= 0 ? path.slice(colonIndex + 1) : null;
}

/**
 * Make a path relative to a root directory
 *
 * @example
 * makeRelative('/a/b/c', '/a/b') // 'c'
 * makeRelative('/a/b', '/a/b') // ''
 */
export function makeRelative(path: string, root: string): string {
  const normalizedRoot = root.endsWith('/') ? root : root + '/';

  if (path === root) {
    return '';
  }

  if (path.startsWith(normalizedRoot)) {
    return path.slice(normalizedRoot.length);
  }

  // Path doesn't start with root, return original
  return path;
}

/**
 * Reconstruct an absolute path from a relative path and root
 *
 * @example
 * makeAbsolute('Users/john', '/Volumes/Backup') // '/Volumes/Backup/Users/john'
 * makeAbsolute('', '/Volumes/Backup') // '/Volumes/Backup'
 */
export function makeAbsolute(relative: string, root: string): string {
  if (!relative) return root;
  return `${root.replace(/\/$/, '')}/${relative}`;
}

/**
 * Join path segments, handling trailing slashes correctly
 *
 * @example
 * joinPaths('/a/b', 'c') // '/a/b/c'
 * joinPaths('/a/b/', 'c') // '/a/b/c'
 * joinPaths('/a/b', '') // '/a/b'
 */
export function joinPaths(base: string, segment: string): string {
  if (!segment) return base;
  if (base.endsWith('/')) {
    return `${base}${segment}`;
  }
  return `${base}/${segment}`;
}

/**
 * Get the parent path of a given path
 *
 * @example
 * getParentPath('/a/b/c') // '/a/b'
 * getParentPath('/a') // '/'
 * getParentPath('/') // '/'
 */
export function getParentPath(path: string): string {
  const normalized = path.replace(/\/$/, '');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) return '/';
  return normalized.slice(0, lastSlash);
}

/**
 * Get the filename (last segment) from a path
 *
 * @example
 * getFileName('/a/b/file.txt') // 'file.txt'
 * getFileName('/a/b/') // 'b'
 */
export function getFileName(path: string): string {
  const normalized = path.replace(/\/$/, '');
  const lastSlash = normalized.lastIndexOf('/');
  return normalized.slice(lastSlash + 1);
}
