import React, { useEffect, useState } from 'react';
import { Icons } from './IconComponents';
import { formatBytes } from '../utils/formatters';

interface FileEntry {
  path: string;
  name: string;
  is_dir: boolean;
  size: number;
  modified: number;
}

export const FileBrowser: React.FC<{ initialPath: string }> = ({ initialPath }) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDir = async (path: string) => {
    setIsLoading(true);
    setFiles([]);
    setError(null);
    
    try {
        await window.electronAPI.scanDirectory(path, (entry) => {
            setFiles(prev => {
                const newFiles = [...prev, entry];
                // Sorting usually handled by sidecar or here. 
                // Simple sort: Folders first, then files
                return newFiles.sort((a, b) => {
                    if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
                    return a.is_dir ? -1 : 1;
                });
            });
        });
    } catch (e: any) {
        setError(e.message);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentPath) loadDir(currentPath);
  }, [currentPath]);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const handleUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    setCurrentPath(parent);
  };

  if (!currentPath) return <div className="p-4 text-gray-500">No path selected</div>;

  return (
    <div className="h-[500px] flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50">
            <button onClick={handleUp} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <Icons.ArrowUp size={16} />
            </button>
            <div className="flex-1 font-mono text-sm text-gray-600 dark:text-gray-300 truncate select-all">
                {currentPath}
            </div>
            <button onClick={() => loadDir(currentPath)} className={`p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors ${isLoading ? 'animate-spin' : ''}`}>
                <Icons.RefreshCw size={16} />
            </button>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-auto p-2 scrollbar-thin">
            {error && (
                <div className="p-4 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg m-2 border border-red-100 dark:border-red-900/30">
                    Error: {error}
                </div>
            )}
            
            <div className="grid grid-cols-1 gap-1">
                {files.map(file => (
                    <div 
                        key={file.path}
                        onClick={() => file.is_dir && handleNavigate(file.path)}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer group transition-colors ${file.is_dir ? 'hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                    >
                        <div className={`p-2 rounded-lg shrink-0 ${file.is_dir ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                            {file.is_dir ? <Icons.Folder size={16} /> : <Icons.FileText size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">{file.name}</div>
                            <div className="text-[10px] text-gray-500">{new Date(file.modified).toLocaleString()}</div>
                        </div>
                        <div className="text-xs font-mono text-gray-400 shrink-0">
                            {file.is_dir ? '--' : formatBytes(file.size)}
                        </div>
                    </div>
                ))}
                
                {!isLoading && files.length === 0 && !error && (
                    <div className="text-center py-20 text-gray-400 text-sm flex flex-col items-center gap-2">
                        <Icons.FolderOpen size={32} className="opacity-20" />
                        Empty directory
                    </div>
                )}
            </div>
        </div>
        
        {/* Footer Status */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-500 flex justify-between">
            <span>{files.length} items</span>
            <span>{isLoading ? 'Scanning...' : 'Ready'}</span>
        </div>
    </div>
  );
};
