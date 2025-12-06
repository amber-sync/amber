import React, { useState, useEffect, useCallback } from 'react';
import { formatBytes } from '../utils/formatters';
import { api } from '../api';
import { getErrorMessage } from '../types';
import { logger } from '../utils/logger';
import { Body, Caption, Code } from './ui';

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
  const [previewType, setPreviewType] = useState<
    'image' | 'text' | 'code' | 'json' | 'unsupported'
  >('unsupported');

  const getFileExtension = useCallback((name: string): string => {
    const parts = name.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }, []);

  const determinePreviewType = useCallback((ext: string): typeof previewType => {
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const codeExts = [
      'js',
      'ts',
      'tsx',
      'jsx',
      'py',
      'rb',
      'go',
      'rs',
      'java',
      'c',
      'cpp',
      'h',
      'css',
      'scss',
      'html',
    ];
    const textExts = ['txt', 'md', 'log', 'csv', 'xml', 'yml', 'yaml', 'ini', 'conf'];
    const jsonExts = ['json'];

    if (imageExts.includes(ext)) return 'image';
    if (codeExts.includes(ext)) return 'code';
    if (jsonExts.includes(ext)) return 'json';
    if (textExts.includes(ext)) return 'text';
    return 'unsupported';
  }, []);

  const loadPreview = useCallback(async () => {
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

      setLoading(true);
      setError(null);

      try {
        // Load image as base64 data URI
        const dataUri = await api.readFileAsBase64(filePath);
        setContent(dataUri);
      } catch (err: unknown) {
        logger.error('Error loading image', err);
        setError(getErrorMessage(err) || 'Failed to load image');
      } finally {
        setLoading(false);
      }
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
      const fileContent = await api.readFilePreview(filePath, PREVIEW_LINES);
      setContent(fileContent);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [filePath, fileName, fileSize, getFileExtension, determinePreviewType]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Body color="secondary">Loading preview...</Body>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <Body className="mb-2 text-red-500 dark:text-red-400">⚠️ {error}</Body>
          <Caption color="tertiary" className="mb-1">
            File: {fileName}
          </Caption>
          <Caption color="tertiary">Size: {formatBytes(fileSize)}</Caption>
        </div>
      );
    }

    switch (previewType) {
      case 'image':
        return (
          <div className="flex items-center justify-center h-full p-4 bg-gray-50 dark:bg-gray-900">
            <img
              src={content || ''}
              alt={fileName}
              className="max-w-full max-h-full object-contain"
              loading="lazy"
              onError={() => setError('Failed to render image')}
            />
          </div>
        );

      case 'code':
      case 'text':
      case 'json':
        return (
          <div className="h-full overflow-auto bg-white dark:bg-gray-900">
            <pre className="p-4">
              <Code size="sm" className="whitespace-pre-wrap">
                {content}
              </Code>
            </pre>
            {fileSize > MAX_TEXT_SIZE && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/10">
                <Caption className="text-yellow-600 dark:text-yellow-500">
                  ⚠️ Preview truncated - file is larger than {formatBytes(MAX_TEXT_SIZE)}
                </Caption>
              </div>
            )}
          </div>
        );

      case 'unsupported':
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <div className="text-6xl mb-4">📄</div>
            <Body size="lg" className="mb-2 text-gray-700 dark:text-gray-300">
              {fileName}
            </Body>
            <Caption className="mb-1">Size: {formatBytes(fileSize)}</Caption>
            <Caption>Preview not available for this file type</Caption>
          </div>
        );
    }
  };

  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      <div className="h-12 px-4 flex items-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850">
        <Body size="sm" weight="medium" className="truncate text-gray-700 dark:text-gray-300">
          {fileName}
        </Body>
      </div>
      <div className="h-[calc(100%-3rem)] overflow-hidden">{renderPreview()}</div>
    </div>
  );
};
