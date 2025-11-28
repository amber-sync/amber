import React, { useState } from 'react';

export const SidecarBenchmark: React.FC = () => {
  const [path, setPath] = useState('.');
  const [count, setCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState('Idle');

  const runScan = async () => {
    setCount(0);
    setDuration(0);
    setStatus('Scanning...');
    const start = performance.now();
    
    try {
        await window.electronAPI.scanDirectory(path, (entry) => {
            setCount(prev => prev + 1);
        });
        const end = performance.now();
        setDuration(end - start);
        setStatus('Complete');
    } catch (e: any) {
        setStatus('Error: ' + e.message);
    }
  };

  const runSearch = async () => {
    setCount(0);
    setDuration(0);
    setStatus('Searching (Recursive)...');
    const start = performance.now();
    
    try {
        // Search for everything "e" to trigger massive hits
        await window.electronAPI.searchDirectory(path, "e", (entry) => {
            setCount(prev => prev + 1);
        });
        const end = performance.now();
        setDuration(end - start);
        setStatus('Complete');
    } catch (e: any) {
        setStatus('Error: ' + e.message);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Rust Sidecar Benchmark</h2>
        <div className="flex gap-4 mb-4">
            <input 
                className="flex-1 border border-gray-300 dark:border-gray-600 p-2 rounded bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white" 
                value={path} 
                onChange={e => setPath(e.target.value)} 
                placeholder="Path to scan..."
            />
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-medium" onClick={runScan}>Scan (Lazy)</button>
            <button className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded font-medium" onClick={runSearch}>Search (Recursive)</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Files Found</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{count.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Duration</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{duration.toFixed(0)}ms</div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Speed</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{duration > 0 ? (count / (duration/1000)).toFixed(0) : 0} /s</div>
            </div>
        </div>
        <div className="mt-4 text-sm text-gray-500 font-mono">{status}</div>
    </div>
  );
};
