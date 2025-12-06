/**
 * File-related type definitions
 */
import { FILE_TYPE, type FileType } from '../config/constants';

// Re-export for convenience
export { FILE_TYPE, type FileType };
export { isDirectory, isFile } from '../config/constants';

export interface FileNode {
  id: string;
  name: string;
  type: FileType;
  size: number;
  modified: number;
  children?: FileNode[];
}

/** Directory entry from filesystem commands */
export interface DirEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  modified: number;
}

/** Directory entry from SQLite destination index */
export interface IndexedDirEntry {
  name: string;
  path: string;
  type: FileType;
  size: number;
  modified: number;
}

/** Directory entry from readDir API (camelCase from JS) */
export interface ReadDirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: number;
}

/** TIM-101: File type stats from SQLite index */
export interface FileTypeStats {
  extension: string;
  count: number;
  totalSize: number;
}

/** TIM-101: Largest file info from SQLite index */
export interface LargestFile {
  name: string;
  size: number;
  path: string;
}

/** TIM-101: Global FTS5 search result */
export interface GlobalSearchResult {
  file: {
    id: string;
    name: string;
    type: FileType;
    size: number;
    modified: number;
    path: string;
    children?: unknown[];
  };
  job_id: string;
  job_name?: string;
  snapshot_timestamp: number;
  rank: number;
}
