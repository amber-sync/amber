import React, { useState, useEffect } from 'react';
import { Icons } from './IconComponents';
import { formatBytes } from '../utils/formatters';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

interface FileBrowserProps {
  initialPath: string;
  selectable?: boolean;
  selectedFiles?: Set<string>;
  onSelectionChange?: (path: string, selected: boolean) => void;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ 
  initialPath, 
  selectable = false,
  selectedFiles = new Set(),
  onSelectionChange 
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  // Reset to initial path if it changes (e.g. snapshot switch)
  useEffect(() => {
    setCurrentPath(initialPath);
  }, [initialPath]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.readDir(path);
      const formatted: FileEntry[] = result.map((item: any) => ({
        name: item.name,
        path: item.path,
        isDirectory: item.isDirectory,
        size: item.size,
        modified: new Date(item.modified)
      }));
      
      // Sort: Folders first, then files
      formatted.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });

      setEntries(formatted);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateUp = () => {
    // Simple parent directory logic
    // Note: This might need to be smarter to stop at snapshot root
    if (currentPath === initialPath) return; // Don't go above snapshot root
    const parent = currentPath.split('/').slice(0, -1).join('/');
    setCurrentPath(parent);
  };

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
    } else {
      // Toggle selection if clicking file row? 
      // Or maybe just preview? For now, let's just toggle selection if selectable
      if (selectable && onSelectionChange) {
        onSelectionChange(entry.path, !selectedFiles.has(entry.path));
      }
    }
  };

  const toggleSelection = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    if (onSelectionChange) {
      onSelectionChange(path, !selectedFiles.has(path));
    }
  };

  // Breadcrumbs
  const relativePath = currentPath.replace(initialPath, '');
  const parts = relativePath.split('/').filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-sm">
      {/* Toolbar / Breadcrumbs */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
        <button 
          onClick={handleNavigateUp}
          disabled={currentPath === initialPath}
          className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <Icons.ArrowRight className="rotate-180 w-4 h-4" />
        </button>
        
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 overflow-hidden">
          <span 
            className="cursor-pointer hover:text-blue-500 transition-colors flex items-center gap-1"
            onClick={() => setCurrentPath(initialPath)}
          >
            <Icons.HardDrive size={14} />
            Root
          </span>
          {parts.map((part, i) => {
             const pathSoFar = initialPath + '/' + parts.slice(0, i + 1).join('/');
             return (
               <React.Fragment key={pathSoFar}>
                 <span className="text-gray-300 dark:text-gray-600">/</span>
                 <span 
                   className="cursor-pointer hover:text-blue-500 transition-colors truncate max-w-[150px]"
                   onClick={() => setCurrentPath(pathSoFar)}
                 >
                   {part}
                 </span>
               </React.Fragment>
             );
          })}
        </div>
      </div>

      {/* File List Header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        <div className="w-5"></div> {/* Checkbox column */}
        <div>Name</div>
        <div className="w-24 text-right">Size</div>
        <div className="w-32 text-right">Modified</div>
      </div>

      {/* File List Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <Icons.RefreshCw className="animate-spin mr-2" /> Loading...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 bg-red-50 dark:bg-red-900/10 m-4 rounded-lg">
            <p className="font-medium">Error loading directory</p>
            <p className="text-xs opacity-80 mt-1">{error}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Icons.Folder className="w-12 h-12 mb-2 opacity-20" />
            <p>Folder is empty</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {entries.map((entry) => {
              const isSelected = selectedFiles.has(entry.path);
              return (
                <div
                  key={entry.path}
                  onClick={() => handleEntryClick(entry)}
                  className={`group grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2.5 items-center cursor-pointer transition-all duration-75
                    ${isSelected 
                      ? 'bg-blue-50 dark:bg-blue-900/20' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  {/* Checkbox */}
                  <div className="w-5 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    {selectable && !entry.isDirectory && (
                      <div 
                        onClick={(e) => toggleSelection(e, entry.path)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 group-hover:border-blue-400'
                        }`}
                      >
                        {isSelected && <Icons.Check size={10} strokeWidth={4} />}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-lg ${
                      entry.isDirectory 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}>
                      {entry.isDirectory ? <Icons.Folder size={16} /> : <Icons.File size={16} />}
                    </div>
                    <span className={`truncate font-medium ${
                      isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'
                    }`}>
                      {entry.name}
                    </span>
                  </div>

                  {/* Size */}
                  <div className="w-24 text-right text-gray-500 dark:text-gray-400 font-mono text-xs">
                    {entry.isDirectory ? '--' : formatBytes(entry.size)}
                  </div>

                  {/* Date */}
                  <div className="w-32 text-right text-gray-400 dark:text-gray-500 text-xs tabular-nums">
                    {entry.modified.toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
