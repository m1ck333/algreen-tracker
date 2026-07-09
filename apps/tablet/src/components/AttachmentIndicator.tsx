import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@alblue/api-client';

export function AttachmentIndicator({
  orderId,
  orderItemId,
  count,
}: {
  orderId: string;
  orderItemId?: string;
  // When provided (e.g. from the tablet queue/incoming response), the count is
  // used directly and no per-order request is made — avoids the /attachments
  // N+1 (one call per order card). Falls back to fetching for other callers.
  count?: number;
}) {
  const { data: allAttachments } = useQuery({
    queryKey: ['order-attachments', orderId],
    queryFn: () => ordersApi.getAttachments(orderId).then((r) => r.data),
    enabled: count === undefined && !!orderId,
    staleTime: 5 * 60_000,
  });

  const resolvedCount =
    count !== undefined
      ? count
      : (orderItemId
          ? allAttachments?.filter((a) => a.orderItemId === null || a.orderItemId === orderItemId)
          : allAttachments
        )?.length ?? 0;

  if (!resolvedCount) return null;

  return (
    <span className="inline-flex items-center gap-0.5 text-gray-400 text-tablet-xs">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
      <span>{resolvedCount}</span>
    </span>
  );
}
