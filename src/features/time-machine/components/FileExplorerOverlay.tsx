/**
 * FileExplorerOverlay - Slide-in file browser overlay
 *
 * Wraps the existing FileBrowser component in the Observatory overlay style.
 */

import { memo } from 'react';
import { FileBrowser } from '../../../components/shared/FileBrowser';
import { Icons } from '../../../components/IconComponents';
import { Title } from '../../../components/ui';

interface FileExplorerOverlayProps {
  isOpen: boolean;
  path: string | null;
  jobId: string | null;
  snapshotTimestamp: number | null;
  destPath: string;
  onClose: () => void;
  /** Enable immersive full-screen mode with depth layers */
  immersive?: boolean;
}

function FileExplorerOverlayComponent({
  isOpen,
  path,
  jobId,
  snapshotTimestamp,
  destPath,
  onClose,
  immersive = false,
}: FileExplorerOverlayProps) {
  if (!path || !jobId) return null;

  const overlayClasses = [
    'tm-overlay',
    isOpen && 'tm-overlay--visible',
    immersive && 'tm-overlay--immersive',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={overlayClasses}>
      {/* Backdrop - absolute in immersive mode, flex in standard */}
      <div className={immersive ? 'absolute inset-0 z-0' : 'flex-1'} onClick={onClose} />

      {/* Panel */}
      <div className="tm-overlay-panel">
        {/* Header */}
        <div className="tm-overlay-header">
          <Title level={3} className="tm-overlay-title">
            File Browser
          </Title>
          <button onClick={onClose} className="tm-overlay-close">
            <Icons.X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="tm-overlay-content p-0">
          <FileBrowser
            initialPath={path}
            jobId={jobId}
            snapshotTimestamp={snapshotTimestamp ?? undefined}
            destPath={destPath}
          />
        </div>
      </div>
    </div>
  );
}

export const FileExplorerOverlay = memo(FileExplorerOverlayComponent);
FileExplorerOverlay.displayName = 'FileExplorerOverlay';

export default FileExplorerOverlay;
