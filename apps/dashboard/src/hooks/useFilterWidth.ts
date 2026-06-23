import { Grid } from 'antd';

/**
 * Filter-bar inputs in the dashboard (Input.Search, Select, etc.)
 * typically have a fixed pixel `style={{ width: 260 }}` so the desktop
 * layout looks like a tidy row of sized inputs. On mobile the row
 * wraps but each filter keeps its small pixel width — so a 390px
 * phone shows a column of 260/160/140-px controls with the rest of
 * each row wasted.
 *
 * Use the returned function in place of the literal number. On mobile
 * (smaller than antd's `md` breakpoint = 768px) every filter snaps to
 * full row width; on tablet+ the original number is preserved.
 *
 * Usage:
 *   const filterW = useFilterWidth();
 *   <Input.Search style={{ width: filterW(260) }} />
 *   <Select       style={{ width: filterW(160) }} />
 *
 * Mirror of useFixedColumn — same pattern, same breakpoint.
 */
export function useFilterWidth(): (desktopPx: number) => number | '100%' {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  return (desktopPx) => (isMobile ? '100%' : desktopPx);
}
