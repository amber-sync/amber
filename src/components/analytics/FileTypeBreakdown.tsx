import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SyncJob, FileNode } from '../../types';
import { formatBytes } from '../../utils/formatters';

interface FileTypeBreakdownProps {
  jobs: SyncJob[];
}

interface CategoryData {
  name: string;
  value: number;
  count: number;
  color: string;
  [key: string]: string | number; // Index signature for Recharts compatibility
}

// File type categories with their extensions and colors
const FILE_CATEGORIES: Record<string, { extensions: string[]; color: string }> = {
  Documents: {
    extensions: [
      '.pdf',
      '.doc',
      '.docx',
      '.txt',
      '.rtf',
      '.odt',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
      '.pages',
      '.numbers',
      '.key',
    ],
    color: '#3B82F6', // blue
  },
  Images: {
    extensions: [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.bmp',
      '.svg',
      '.webp',
      '.raw',
      '.heic',
      '.heif',
      '.tiff',
      '.ico',
    ],
    color: '#10B981', // green
  },
  Videos: {
    extensions: ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg'],
    color: '#F59E0B', // amber
  },
  Audio: {
    extensions: ['.mp3', '.wav', '.aac', '.flac', '.ogg', '.wma', '.m4a', '.aiff'],
    color: '#8B5CF6', // purple
  },
  Code: {
    extensions: [
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.h',
      '.rs',
      '.go',
      '.rb',
      '.php',
      '.swift',
      '.kt',
      '.cs',
      '.html',
      '.css',
      '.scss',
      '.json',
      '.xml',
      '.yaml',
      '.yml',
      '.md',
      '.sql',
    ],
    color: '#EC4899', // pink
  },
  Archives: {
    extensions: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.dmg', '.iso'],
    color: '#6366F1', // indigo
  },
};

function getFileCategory(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

  for (const [category, { extensions }] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(ext)) {
      return category;
    }
  }

  return 'Other';
}

function traverseFileTree(
  nodes: FileNode[],
  stats: Map<string, { size: number; count: number }>
): void {
  for (const node of nodes) {
    if (node.type === 'FILE') {
      const category = getFileCategory(node.name);
      const existing = stats.get(category) || { size: 0, count: 0 };
      existing.size += node.size;
      existing.count += 1;
      stats.set(category, existing);
    } else if (node.children) {
      traverseFileTree(node.children, stats);
    }
  }
}

export const FileTypeBreakdown: React.FC<FileTypeBreakdownProps> = ({ jobs }) => {
  const categoryData = useMemo(() => {
    const stats = new Map<string, { size: number; count: number }>();

    // Analyze file trees from latest snapshots
    jobs.forEach(job => {
      if (job.snapshots.length > 0) {
        const latestSnapshot = job.snapshots[job.snapshots.length - 1];
        if (latestSnapshot.root && latestSnapshot.root.length > 0) {
          traverseFileTree(latestSnapshot.root, stats);
        }
      }
    });

    // Convert to chart data
    const data: CategoryData[] = [];

    // Add known categories
    for (const [category, { color }] of Object.entries(FILE_CATEGORIES)) {
      const stat = stats.get(category);
      if (stat && stat.size > 0) {
        data.push({
          name: category,
          value: stat.size,
          count: stat.count,
          color,
        });
      }
    }

    // Add "Other" category
    const otherStat = stats.get('Other');
    if (otherStat && otherStat.size > 0) {
      data.push({
        name: 'Other',
        value: otherStat.size,
        count: otherStat.count,
        color: '#6B7280', // gray
      });
    }

    // Sort by size descending and take top 5
    data.sort((a, b) => b.value - a.value);
    return data.slice(0, 5);
  }, [jobs]);

  const totalSize = categoryData.reduce((acc, cat) => acc + cat.value, 0);
  const hasData = categoryData.length > 0;

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: CategoryData }>;
  }) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const percentage = totalSize > 0 ? ((data.value / totalSize) * 100).toFixed(1) : 0;

    return (
      <div className="bg-layer-2 border border-border-base rounded-lg p-2 shadow-lg">
        <div className="font-medium text-text-primary text-sm">{data.name}</div>
        <div className="text-text-secondary text-xs mt-1">
          {formatBytes(data.value)} ({percentage}%)
        </div>
        <div className="text-text-tertiary text-xs">{data.count.toLocaleString()} files</div>
      </div>
    );
  };

  return (
    <div className="bg-layer-1 rounded-xl border border-border-base p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary">File Types</h3>
        {hasData && (
          <span className="text-xs text-text-tertiary">{formatBytes(totalSize)} total</span>
        )}
      </div>

      {hasData ? (
        <div className="flex items-center gap-4">
          {/* Pie Chart */}
          <div className="w-32 h-32 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={50}
                  paddingAngle={2}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2">
            {categoryData.map(category => {
              const percentage =
                totalSize > 0 ? ((category.value / totalSize) * 100).toFixed(0) : 0;

              return (
                <div key={category.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-xs text-text-secondary">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-primary">
                      {formatBytes(category.value)}
                    </span>
                    <span className="text-xs text-text-tertiary w-8 text-right">{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="h-32 flex items-center justify-center text-text-tertiary text-sm">
          No file data available
        </div>
      )}
    </div>
  );
};
