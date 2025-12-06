/**
 * FileExplorerOverlay - Slide-in file browser overlay
 *
 * Wraps the existing FileBrowser component in the Observatory overlay style.
 */

import { memo } from 'react';
import { FileBrowser } from '../../../components/FileBrowser';
import { Icons } from '../../../components/IconComponents';

interface FileExplorerOverlayProps {
  isOpen: boolean;
  path: string | null;
  jobId: string | null;
  snapshotTimestamp: number | null;
  destPath: string;
  onClose: () => void;
}

function FileExplorerOverlayComponent({
  isOpen,
  path,
  jobId,
  snapshotTimestamp,
  destPath,
  onClose,
}: FileExplorerOverlayProps) {
  if (!path || !jobId) return null;

  return (
    <div className={`tm-overlay ${isOpen ? 'tm-overlay--visible' : ''}`}>
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel */}
      <div className="tm-overlay-panel">
        {/* Header */}
        <div className="tm-overlay-header">
          <h2 className="tm-overlay-title">File Browser</h2>
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
