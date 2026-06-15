import dayjs from 'dayjs';

/**
 * Locale-aware date string. The whole UI uses DD.MM.YYYY. so this is
 * the canonical formatter — call instead of inlining the format mask.
 */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return dayjs(iso).format('DD.MM.YYYY.');
}

/** DD.MM.YYYY. HH:mm */
export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return dayjs(iso).format('DD.MM.YYYY. HH:mm');
}

/** HH:mm — used for shift times etc. */
export function formatTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return dayjs(iso).format('HH:mm');
}
