import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@algreen/api-client';
import type { OrderAttachmentDto } from '@algreen/shared-types';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

function isPdf(contentType: string): boolean {
  return contentType === 'application/pdf';
}

interface AttachmentViewerProps {
  orderId: string;
  orderItemId?: string;
}

export function AttachmentViewer({ orderId, orderItemId }: AttachmentViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<OrderAttachmentDto | null>(null);
  const [viewingPdf, setViewingPdf] = useState<OrderAttachmentDto | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: allAttachments = [], isLoading } = useQuery({
    queryKey: ['order-attachments', orderId],
    queryFn: () => ordersApi.getAttachments(orderId).then((r) => r.data),
    enabled: !!orderId,
    staleTime: 5 * 60_000,
  });

  const attachments = orderItemId
    ? allAttachments.filter((a) => a.orderItemId === null || a.orderItemId === orderItemId)
    : allAttachments;

  if (isLoading) {
    return (
      <div className="mt-3 text-center text-gray-400 text-tablet-xs">
        Učitavanje...
      </div>
    );
  }

  if (attachments.length === 0) return null;

  const getUrl = (a: OrderAttachmentDto) =>
    ordersApi.getAttachmentDownloadUrl(orderId, a.id);

  const handleOpen = async (a: OrderAttachmentDto) => {
    if (isPdf(a.contentType)) {
      setViewingPdf(a);
      setPdfLoading(true);
      setPdfPages([]);
      try {
        const resp = await fetch(getUrl(a));
        const arrayBuffer = await resp.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport } as never).promise;
          pages.push(canvas.toDataURL('image/png'));
        }
        setPdfPages(pages);
      } catch {
        setPdfPages([]);
      } finally {
        setPdfLoading(false);
      }
    } else {
      setViewingAttachment(a);
    }
  };

  const closePdf = () => {
    setPdfPages([]);
    setViewingPdf(null);
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-tablet-base font-semibold text-gray-700 py-3 px-2 rounded-lg active:bg-gray-100"
      >
        <span>📎 Dokumenti ({attachments.length})</span>
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          {attachments.map((a) => (
            <button
              key={a.id}
              onClick={() => handleOpen(a)}
              className="block border-2 border-gray-200 rounded-xl overflow-hidden text-left w-full bg-white active:border-primary-400 active:bg-primary-50 transition-colors"
            >
              {isImage(a.contentType) ? (
                <img src={getUrl(a)} alt={a.originalFileName} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 flex flex-col items-center justify-center bg-red-50">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span className="text-tablet-sm text-red-500 mt-1 font-bold">PDF</span>
                </div>
              )}
              <div className="px-3 py-2">
                <div className="text-tablet-sm text-gray-700 truncate font-medium">{a.originalFileName}</div>
                <div className="text-tablet-xs text-gray-400">{formatFileSize(a.fileSizeBytes)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen image viewer */}
      {viewingAttachment && isImage(viewingAttachment.contentType) && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={() => setViewingAttachment(null)}>
          <div className="flex justify-between items-center p-3 bg-black/80">
            <span className="text-white text-tablet-sm truncate max-w-[70%]">{viewingAttachment.originalFileName}</span>
            <button onClick={() => setViewingAttachment(null)} className="text-white bg-red-600 rounded-xl px-5 py-3 text-tablet-base font-bold active:bg-red-700 min-w-[80px]">
              Zatvori
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-auto p-2">
            <img src={getUrl(viewingAttachment)} alt={viewingAttachment.originalFileName} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}

      {/* Fullscreen PDF viewer - rendered as images */}
      {viewingPdf && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex justify-between items-center p-3 bg-black/80">
            <span className="text-white text-tablet-sm truncate max-w-[70%]">{viewingPdf.originalFileName}</span>
            <button onClick={closePdf} className="text-white bg-red-600 rounded-xl px-5 py-3 text-tablet-base font-bold active:bg-red-700 min-w-[80px]">
              Zatvori
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-gray-800 p-2">
            {pdfLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white text-tablet-base">Učitavanje PDF...</span>
              </div>
            ) : pdfPages.length > 0 ? (
              <div className="space-y-2">
                {pdfPages.map((dataUrl, i) => (
                  <img key={i} src={dataUrl} alt={`Strana ${i + 1}`} className="w-full rounded" />
                ))}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white text-tablet-base">Greška pri učitavanju PDF-a</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
