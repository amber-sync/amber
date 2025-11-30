import React, { useState, useEffect } from 'react';
import { formatBytes } from '../utils/formatters';

interface FilePreviewProps {
  filePath: string;
  fileName: string;
  fileSize: number;
}

const MAX_TEXT_SIZE = 1024 * 1024; // 1MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const PREVIEW_LINES = 500; // Max lines for text preview

export const FilePreview: React.FC<FilePreviewProps> = ({ filePath, fileName, fileSize }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'text' | 'code' | 'json' | 'unsupported'>('unsupported');

  useEffect(() => {
    loadPreview();
  }, [filePath]);

  const getFileExtension = (name: string): string => {
    const parts = name.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  const determinePreviewType = (ext: string): typeof previewType => {
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const codeExts = ['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'css', 'scss', 'html'];
    const textExts = ['txt', 'md', 'log', 'csv', 'xml', 'yml', 'yaml', 'ini', 'conf'];
    const jsonExts = ['json'];

    if (imageExts.includes(ext)) return 'image';
    if (codeExts.includes(ext)) return 'code';
    if (jsonExts.includes(ext)) return 'json';
    if (textExts.includes(ext)) return 'text';
    return 'unsupported';
  };

  const loadPreview = async () => {
    const ext = getFileExtension(fileName);
    const type = determinePreviewType(ext);
    setPreviewType(type);

    if (type === 'unsupported') {
      setContent(null);
      return;
    }

    if (type === 'image') {
      if (fileSize > MAX_IMAGE_SIZE) {
        setError('Image too large to preview (>10MB)');
        return;
      }
      // For images, we'll use file:// protocol directly
      setContent(`file://${filePath}`);
      return;
    }

    // For text-based files
    if (fileSize > MAX_TEXT_SIZE) {
      setError('File too large to preview (>1MB)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fileContent = await window.electronAPI.readFilePreview(filePath, PREVIEW_LINES);
      setContent(fileContent);
    } catch (err: any) {
      setError(err.message || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading preview...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-red-500 mb-2">⚠️ {error}</div>
          <div className="text-sm text-gray-400">File: {fileName}</div>
          <div className="text-sm text-gray-400">Size: {formatBytes(fileSize)}</div>
        </div>
      );
    }

    switch (previewType) {
      case 'image':
        return (
          <div className="flex items-center justify-center h-full p-4 bg-gray-900">
            <img
              src={content || ''}
              alt={fileName}
              className="max-w-full max-h-full object-contain"
              loading="lazy"
              onError={() => setError('Failed to load image')}
            />
          </div>
        );

      case 'code':
      case 'text':
      case 'json':
        return (
          <div className="h-full overflow-auto">
            <pre className="p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap">
              {content}
            </pre>
            {fileSize > MAX_TEXT_SIZE && (
              <div className="p-4 text-sm text-yellow-500 border-t border-gray-700">
                ⚠️ Preview truncated - file is larger than {formatBytes(MAX_TEXT_SIZE)}
              </div>
            )}
          </div>
        );

      case 'unsupported':
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-6xl mb-4">📄</div>
            <div className="text-lg mb-2">{fileName}</div>
            <div className="text-sm mb-1">Size: {formatBytes(fileSize)}</div>
            <div className="text-sm text-gray-500">Preview not available for this file type</div>
          </div>
        );
    }
  };

  return (
    <div className="h-full w-full bg-gray-800 border-l border-gray-700">
      <div className="h-12 px-4 flex items-center border-b border-gray-700 bg-gray-850">
        <div className="text-sm font-medium text-gray-300 truncate">{fileName}</div>
      </div>
      <div className="h-[calc(100%-3rem)] overflow-hidden">
        {renderPreview()}
      </div>
    </div>
  );
};
