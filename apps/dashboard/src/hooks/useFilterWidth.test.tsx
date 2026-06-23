import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFilterWidth } from './useFilterWidth';

/**
 * Sibling test to useFixedColumn — same Grid.useBreakpoint mechanic, same
 * matchMedia stub strategy. Pins desktop = pass-through, mobile = '100%'
 * so a future refactor of the breakpoint logic can't silently drop the
 * mobile behaviour and leave admin/orders filters stuck at fixed pixel
 * widths on a phone.
 */
describe('useFilterWidth', () => {
  beforeEach(() => {
    setMatchMediaMatches(true);
  });

  it('returns the desktop number on tablet+ viewports', () => {
    setMatchMediaMatches(true);
    const { result } = renderHook(() => useFilterWidth());
    expect(result.current(220)).toBe(220);
    expect(result.current(160)).toBe(160);
  });

  it('returns 100% on mobile viewports', () => {
    setMatchMediaMatches(false);
    const { result } = renderHook(() => useFilterWidth());
    expect(result.current(220)).toBe('100%');
    expect(result.current(160)).toBe('100%');
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
