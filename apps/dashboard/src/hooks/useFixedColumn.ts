import { Grid } from 'antd';

/**
 * On narrow viewports (smaller than antd's `md` breakpoint = 768px) a
 * fixed antd Table column eats too much of the limited horizontal
 * space and forces the rest of the columns into a horizontal scroll
 * AFTER the fixed one — net result is the fixed column shows but the
 * data the user actually wants to read is cropped or hidden.
 *
 * Use the returned function in column definitions instead of writing
 * the literal `fixed: 'left'`. Drops the fix on mobile while keeping
 * it on tablet+ viewports where there's enough width to make a fixed
 * column useful.
 *
 * Usage:
 *   const fixedCol = useFixedColumn();
 *   const columns = useMemo(() => [
 *     { title: 'Code', dataIndex: 'code', fixed: fixedCol('left') },
 *   ], [fixedCol, ...]);
 */
export function useFixedColumn(): (side: 'left' | 'right') => 'left' | 'right' | undefined {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  return (side) => (isMobile ? undefined : side);
}
