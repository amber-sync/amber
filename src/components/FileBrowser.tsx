import React, { useState, useEffect } from 'react';
import { Icons } from './IconComponents';
import { formatBytes } from '../utils/formatters';
import { FilePreview } from './FilePreview';

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
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<FileEntry | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  // Reset to initial path if it changes (e.g. snapshot switch)
  useEffect(() => {
    setCurrentPath(initialPath);
    setSelectedFileForPreview(null);
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
    if (currentPath === initialPath) return; // Don't go above snapshot root
    const parent = currentPath.split('/').slice(0, -1).join('/');
    setCurrentPath(parent);
  };

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
      setSelectedFileForPreview(null); // Clear preview when navigating
    } else {
      // Show preview for files
      setSelectedFileForPreview(entry);
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
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* File Browser Panel */}
      <div className={`flex flex-col ${ showPreview && selectedFileForPreview ? 'w-1/2' : 'w-full'} transition-all duration-200`}>
        {/* Toolbar / Breadcrumbs */}
        <div className="flex items-center gap-2 p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <button 
            onClick={handleNavigateUp}
            disabled={currentPath === initialPath}
            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Icons.ArrowRight className="rotate-180 w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 overflow-hidden flex-1">
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

          {/* Preview Toggle */}
          {selectedFileForPreview && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={showPreview ? 'Hide Preview' : 'Show Preview'}
            >
              <Icons.File size={16} className={showPreview ? 'text-blue-500' : 'text-gray-400'} />
            </button>
          )}
        </div>

        {/* File List Header */}
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <div className="w-5"></div> {/* Checkbox column */}
          <div>Name</div>
          <div className="text-right">Size</div>
          <div className="text-right">Modified</div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-500">Error: {error}</div>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Icons.Search size={48} className="mb-2 opacity-20" />
              <div>Empty directory</div>
            </div>
          ) : (
            entries.map((entry) => {
              const isSelected = selectedFiles.has(entry.path);
              const isPreviewSelected = selectedFileForPreview?.path === entry.path;
              
              return (
                <div
                  key={entry.path}
                  onClick={() => handleEntryClick(entry)}
                  className={`grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-50 dark:border-gray-800/50 transition-colors ${
                    isPreviewSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <div className="flex items-center">
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelection(e as any, entry.path)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                      />
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    {entry.isDirectory ? (
                      <Icons.Folder size={16} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
                    ) : (
                      <Icons.File size={16} className="text-gray-400 flex-shrink-0" />
                    )}
                    <span className="truncate text-gray-700 dark:text-gray-300">{entry.name}</span>
                  </div>

                  {/* Size */}
                  <div className="text-right text-gray-500 dark:text-gray-400 tabular-nums text-sm">
                    {!entry.isDirectory && formatBytes(entry.size)}
                  </div>

                  {/* Modified */}
                  <div className="text-right text-gray-500 dark:text-gray-400 tabular-nums text-xs">
                    {entry.modified.toLocaleDateString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Preview Panel */}
      {showPreview && selectedFileForPreview && (
        <div className=" w-1/2 border-l border-gray-200 dark:border-gray-700">
          <FilePreview
            filePath={selectedFileForPreview.path}
            fileName={selectedFileForPreview.name}
            fileSize={selectedFileForPreview.size}
          />
        </div>
      )}
    </div>
  );
};
