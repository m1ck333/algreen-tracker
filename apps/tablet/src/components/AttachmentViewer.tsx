import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@algreen/api-client';
import type { OrderAttachmentDto } from '@algreen/shared-types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

interface AttachmentViewerProps {
  orderId: string;
}

export function AttachmentViewer({ orderId }: AttachmentViewerProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['order-attachments', orderId],
    queryFn: () => ordersApi.getAttachments(orderId).then((r) => r.data),
    enabled: !!orderId,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="mt-3 text-center text-gray-400 text-tablet-xs">
        Loading attachments...
      </div>
    );
  }

  if (attachments.length === 0) return null;

  const getUrl = (a: OrderAttachmentDto) =>
    ordersApi.getAttachmentDownloadUrl(orderId, a.id);

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-tablet-sm font-medium text-gray-700 py-2"
      >
        <span>
          Attachments ({attachments.length})
        </span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-2 mt-1">
          {attachments.map((a) => (
            <a
              key={a.id}
              href={getUrl(a)}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-gray-200 rounded-lg overflow-hidden no-underline"
            >
              {isImage(a.contentType) ? (
                <img
                  src={getUrl(a)}
                  alt={a.originalFileName}
                  className="w-full h-24 object-cover"
                />
              ) : (
                <div className="w-full h-24 flex items-center justify-center bg-gray-50">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
              )}
              <div className="px-2 py-1">
                <div className="text-tablet-xs text-gray-700 truncate">{a.originalFileName}</div>
                <div className="text-tablet-xs text-gray-400">{formatFileSize(a.fileSizeBytes)}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
