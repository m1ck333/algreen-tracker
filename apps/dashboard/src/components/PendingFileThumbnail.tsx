import { useEffect, useMemo } from 'react';

/**
 * Thumbnail for a not-yet-uploaded File (pending attachment upload).
 *
 * Mints the object URL once per File and revokes it on unmount/change. Inline
 * `URL.createObjectURL(file)` in JSX leaked a fresh blob URL on every render —
 * and the order drawers re-render often (a 10s timer tick + form keystrokes),
 * so an open drawer with pending images leaked dozens of blobs until page unload.
 */
export function PendingFileThumbnail({
  file,
  size = 40,
  onClick,
}: {
  file: File;
  size?: number;
  onClick?: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <img
      src={url}
      width={size}
      height={size}
      style={{ objectFit: 'cover', borderRadius: 4, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      alt={file.name}
    />
  );
}
