/**
 * Standard server-error envelope our axios responses ship with.
 * Centralised to spare every page from re-deriving the same shape.
 */
type ServerErrorEnvelope = {
  response?: { data?: { error?: { code?: string; message?: string } } };
};

/**
 * Pull a user-facing message out of an axios error, with a fallback
 * for network-level failures or anything we can't decode.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  const envelope = (err as ServerErrorEnvelope)?.response?.data?.error;
  return envelope?.message || fallback;
}

/**
 * Extract the server-provided error code (e.g. "STOCK_INSUFFICIENT")
 * so callers can branch on it before deciding what message to show.
 */
export function getErrorCode(err: unknown): string | undefined {
  return (err as ServerErrorEnvelope)?.response?.data?.error?.code;
}

/**
 * Look the server error code up against a per-page translation table
 * (`<page>.errors.<CODE>` or `common:errors.<CODE>`), then fall back to
 * the server-provided message or a hard-coded fallback. Used by pages
 * that want localised error toasts on top of the BE's Serbian default.
 */
export function getTranslatedError(
  err: unknown,
  t: (key: string, opts?: Record<string, unknown>) => string,
  fallback: string,
): string {
  const code = getErrorCode(err);
  if (code) {
    const translated = t(`common:errors.${code}`, { defaultValue: '' });
    if (translated) return translated;
  }
  return getErrorMessage(err, fallback);
}
