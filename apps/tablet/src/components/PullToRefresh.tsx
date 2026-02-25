import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only activate when scrolled to top
    const scrollEl = e.currentTarget;
    if (scrollEl.scrollTop > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) {
      // Dampen the pull (feels more natural)
      setPullDistance(Math.min(diff * 0.5, MAX_PULL));
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.6);
      // Invalidate all active queries
      await queryClient.invalidateQueries();
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, queryClient]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="flex-1 overflow-auto"
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pullDistance > 0 || refreshing ? `${pullDistance}px` : 0 }}
      >
        <div className={`transition-transform ${pullDistance >= THRESHOLD ? 'scale-110' : ''}`}>
          {refreshing ? (
            <span className="inline-block w-6 h-6 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
          ) : (
            <svg
              width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-primary-500 transition-transform"
              style={{ transform: `rotate(${Math.min(pullDistance / THRESHOLD, 1) * 180}deg)`, opacity: Math.min(pullDistance / THRESHOLD, 1) }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
