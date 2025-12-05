/**
 * TIM-185: Centralized constants for Amber Backup.
 * These match the Rust backend types in src-tauri/src/types/
 */

/**
 * File type constants matching Rust file_type module.
 * Use these everywhere instead of string literals.
 * @see src-tauri/src/types/snapshot.rs
 */
export const FILE_TYPE = {
  DIR: 'dir',
  FILE: 'file',
} as const;

export type FileType = (typeof FILE_TYPE)[keyof typeof FILE_TYPE];

/**
 * Check if a type string represents a directory.
 * @param type - The file type string to check
 * @returns true if the type is 'dir'
 */
export function isDirectory(type: string): boolean {
  return type === FILE_TYPE.DIR;
}

/**
 * Check if a type string represents a file.
 * @param type - The file type string to check
 * @returns true if the type is 'file'
 */
export function isFile(type: string): boolean {
  return type === FILE_TYPE.FILE;
}
