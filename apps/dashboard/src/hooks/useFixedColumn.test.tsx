import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFixedColumn } from './useFixedColumn';

/**
 * Pin the mobile vs. desktop branching. The hook reads
 * Grid.useBreakpoint() which internally uses window.matchMedia. We
 * stub matchMedia per test to flip viewport size — this is the same
 * approach antd uses in its own internal tests.
 *
 * On desktop (md+): hook is a pass-through, returns the requested side.
 * On mobile (<md): hook returns undefined, dropping the fixed column.
 */
describe('useFixedColumn', () => {
  beforeEach(() => {
    // Default to desktop; individual tests override below.
    setMatchMediaMatches(true);
  });

  it('returns the requested side on desktop viewports', () => {
    setMatchMediaMatches(true); // md/lg/xl/xxl all match → not mobile
    const { result } = renderHook(() => useFixedColumn());
    expect(result.current('left')).toBe('left');
    expect(result.current('right')).toBe('right');
  });

  it('returns undefined on mobile viewports', () => {
    // antd's Grid.useBreakpoint maps md to ≥768px; matches=false simulates
    // a narrower viewport. The hook returns undefined so the fixed
    // column prop is dropped — restoring the rest of the columns to view.
    setMatchMediaMatches(false);
    const { result } = renderHook(() => useFixedColumn());
    expect(result.current('left')).toBeUndefined();
    expect(result.current('right')).toBeUndefined();
  });
});

function setMatchMediaMatches(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
