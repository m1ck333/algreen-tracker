import { useState, useEffect } from 'react';

/**
 * Debounce a fast-changing value (e.g. a search input). Returns the
 * latest value seen after `delayMs` of inactivity. Used to throttle
 * query refetches keyed off user typing.
 */
export function useDebounce<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
