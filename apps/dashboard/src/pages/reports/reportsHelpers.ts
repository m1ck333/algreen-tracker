import { ComplexityType } from '@alblue/shared-types';

/** Format seconds as h:mm:ss. Time-tracking rows use this directly. */
export function formatSeconds(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || totalSeconds <= 0) return '0:00:00';
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Process-times stats arrive as decimal minutes (BE divides seconds by 60). */
export function formatMinutes(decimalMinutes: number | null | undefined): string {
  if (decimalMinutes == null || decimalMinutes <= 0) return '0:00:00';
  return formatSeconds(Math.round(decimalMinutes * 60));
}

export const COMPLEXITY_ORDER: ComplexityType[] = [
  ComplexityType.T,
  ComplexityType.S,
  ComplexityType.L,
];
