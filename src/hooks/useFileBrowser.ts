/**
 * TIM-188: File browser hook - extracted from FileBrowser.tsx
 * Handles navigation, directory loading, and search state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { logger } from '../utils/logger';
import { isDirectory } from '../types';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

export interface UseFileBrowserOptions {
  initialPath: string;
  jobId?: string;
  snapshotTimestamp?: number;
  destPath?: string;
}

export interface UseFileBrowserReturn {
  // State
  entries: FileEntry[];
  currentPath: string;
  loading: boolean;
  error: string | null;
  isIndexed: boolean;
  searchQuery: string;
  searchResults: FileEntry[] | null;
  isSearching: boolean;

  // Display entries (search results or regular entries)
  displayEntries: FileEntry[];

  // Navigation
  navigateTo: (path: string) => void;
  navigateUp: () => void;
  refresh: () => void;

  // Search
  search: (query: string) => void;
  clearSearch: () => void;

  // Breadcrumbs
  breadcrumbParts: string[];
  relativePath: string;
}

export function useFileBrowser({
  initialPath,
  jobId,
  snapshotTimestamp,
  destPath,
}: UseFileBrowserOptions): UseFileBrowserReturn {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TIM-46: Indexed browsing state
  const [isIndexed, setIsIndexed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Use refs for values needed in loadDirectory to avoid dependency churn
  const isIndexedRef = useRef(isIndexed);
  const destPathRef = useRef(destPath);
  const jobIdRef = useRef(jobId);
  const snapshotTimestampRef = useRef(snapshotTimestamp);
  const initialPathRef = useRef(initialPath);

  // Keep refs in sync
  useEffect(() => {
    isIndexedRef.current = isIndexed;
  }, [isIndexed]);
  useEffect(() => {
    destPathRef.current = destPath;
  }, [destPath]);
  useEffect(() => {
    jobIdRef.current = jobId;
  }, [jobId]);
  useEffect(() => {
    snapshotTimestampRef.current = snapshotTimestamp;
  }, [snapshotTimestamp]);
  useEffect(() => {
    initialPathRef.current = initialPath;
  }, [initialPath]);

  // Check if snapshot is indexed (TIM-127: use destination-based index)
  useEffect(() => {
    if (destPath && jobId && snapshotTimestamp) {
      api
        .isIndexedOnDestination(destPath, jobId, snapshotTimestamp)
        .then(indexed => {
          setIsIndexed(indexed);
          if (indexed) {
            logger.debug('Using destination-based indexed snapshot queries', {
              destPath,
              snapshotTimestamp,
            });
          }
        })
        .catch(() => setIsIndexed(false));
    } else {
      setIsIndexed(false);
    }
  }, [destPath, jobId, snapshotTimestamp]);

  // Load directory - stable function using refs to avoid dependency loop
  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setSearchResults(null);
    setSearchQuery('');

    try {
      let formatted: FileEntry[];
      const useIndex = isIndexedRef.current;
      const dest = destPathRef.current;
      const job = jobIdRef.current;
      const timestamp = snapshotTimestampRef.current;
      const initPath = initialPathRef.current;

      if (useIndex && dest && job && timestamp) {
        // TIM-127: Use fast SQLite query from destination index
        // Convert current absolute path to relative path for SQLite query
        const relativePath = path === initPath ? '' : path.replace(initPath + '/', '');
        const result = await api.getDirectoryFromDestination(dest, job, timestamp, relativePath);

        formatted = result.map((item: any) => ({
          name: item.name,
          // SQLite stores RELATIVE paths (e.g., "Projects/webapp")
          // Convert to absolute path for navigation by prepending initialPath
          path: `${initPath}/${item.path}`,
          // Use centralized isDirectory() from types.ts - matches Rust file_type module
          isDirectory: isDirectory(item.type),
          size: item.size,
          modified: new Date(item.modified),
        }));
      } else {
        // Fallback to filesystem read
        const result = await api.readDir(path);
        formatted = result.map((item: any) => ({
          name: item.name,
          path: item.path,
          isDirectory: item.isDirectory,
          size: item.size,
          modified: new Date(item.modified),
        }));
      }

      // Sort: Folders first, then files
      formatted.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });

      setEntries(formatted);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - uses refs for all external values

  // Load directory when path changes OR when isIndexed status changes
  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory, isIndexed]);

  // Reset to initial path if it changes (e.g. snapshot switch)
  useEffect(() => {
    setCurrentPath(initialPath);
    setSearchQuery('');
    setSearchResults(null);
  }, [initialPath]);

  // TIM-127: Search functionality (destination-based)
  const search = useCallback(
    async (query: string) => {
      setSearchQuery(query);

      if (!query.trim()) {
        setSearchResults(null);
        return;
      }

      if (!isIndexed || !destPath || !jobId || !snapshotTimestamp) {
        // Search not available without index
        return;
      }

      setIsSearching(true);
      try {
        const results = await api.searchFilesOnDestination(
          destPath,
          jobId,
          snapshotTimestamp,
          query,
          100
        );
        const formatted: FileEntry[] = results.map((item: any) => ({
          name: item.name,
          // SQLite stores RELATIVE paths - convert to absolute for navigation
          path: `${initialPath}/${item.path}`,
          // Use centralized isDirectory() from types.ts - matches Rust file_type module
          isDirectory: isDirectory(item.type),
          size: item.size,
          modified: new Date(item.modified),
        }));
        setSearchResults(formatted);
      } catch (err) {
        logger.error('Search failed', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [isIndexed, destPath, jobId, snapshotTimestamp, initialPath]
  );

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults(null);
  }, []);

  const navigateUp = useCallback(() => {
    if (currentPath === initialPath) return;
    const parent = currentPath.split('/').slice(0, -1).join('/');
    setCurrentPath(parent);
  }, [currentPath, initialPath]);

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
    setSearchResults(null);
    setSearchQuery('');
  }, []);

  const refresh = useCallback(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  // Computed values
  const relativePath = currentPath.replace(initialPath, '');
  const breadcrumbParts = relativePath.split('/').filter(Boolean);
  const displayEntries = searchResults !== null ? searchResults : entries;

  return {
    // State
    entries,
    currentPath,
    loading,
    error,
    isIndexed,
    searchQuery,
    searchResults,
    isSearching,
    displayEntries,

    // Navigation
    navigateTo,
    navigateUp,
    refresh,

    // Search
    search,
    clearSearch,

    // Breadcrumbs
    breadcrumbParts,
    relativePath,
  };
}
