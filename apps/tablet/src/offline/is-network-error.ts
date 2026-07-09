/**
 * True when an error is a *connectivity* failure (request sent, no HTTP reply)
 * rather than a server rejection. axios sets `.response` only when the server
 * actually answered — a 4xx/5xx — so its absence on an axios error means the
 * connection dropped (offline, DNS, timeout). That distinction is what lets us
 * queue-and-retry a lost request while still surfacing genuine 4xx/5xx errors.
 */
export function isNetworkError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { isAxiosError?: boolean; response?: unknown };
  return e.isAxiosError === true && e.response === undefined;
}
