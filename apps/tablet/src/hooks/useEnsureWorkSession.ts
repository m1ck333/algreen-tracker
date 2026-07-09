import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@alblue/auth';
import { workSessionsApi } from '@alblue/api-client';

// Must match the flag AutoLogoutBanner persists on shift-end auto-logout.
const AUTO_LOGOUT_FLAG = 'tablet.autoLoggedOut';

/**
 * Self-heal for the "logged in but no work session" limbo (Bojan 29.06.2026):
 * a worker whose session was never created — or stayed logged in for days and
 * never re-logged-in — keeps working with NO prijava recorded. Sessions are
 * only created at login, so these workers never get a daily session.
 *
 * If an authenticated worker has NO active session on load, create one. The
 * guards keep this strictly complementary to AutoLogoutBanner, which owns the
 * opposite transition:
 *   - We only act on the "never had a session this mount" case (genuine limbo).
 *   - We never act right after a shift-end auto-logout (AUTO_LOGOUT_FLAG set) or
 *     after a had-session→lost transition — those MUST force a re-login, not
 *     silently re-open a session.
 */
export function useEnsureWorkSession(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const hadSessionRef = useRef(false);
  const ensuringRef = useRef(false);

  const { data, isSuccess } = useQuery({
    queryKey: ['active-work-session'],
    queryFn: async () => {
      const res = await workSessionsApi.getCurrent();
      if (res.status === 204 || !res.data) return null;
      return res.data;
    },
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60_000,
  });

  useEffect(() => {
    if (!isAuthenticated || !userId || !isSuccess) return;

    if (data) {
      hadSessionRef.current = true; // saw a real session — limbo no longer applies
      return;
    }

    // data === null: only the genuine "never had a session" case, and never
    // when a shift-end auto-logout is in progress (that path forces re-login).
    const autoLoggedOut =
      typeof window !== 'undefined' && sessionStorage.getItem(AUTO_LOGOUT_FLAG) === '1';
    if (autoLoggedOut || hadSessionRef.current || ensuringRef.current) return;

    ensuringRef.current = true;
    workSessionsApi
      .checkIn({ userId })
      .then(() => queryClient.invalidateQueries({ queryKey: ['active-work-session'] }))
      .catch(() => {
        // OVERTIME_EXHAUSTED / ALREADY_CHECKED_IN / offline — leave as-is.
      })
      .finally(() => {
        ensuringRef.current = false;
      });
  }, [isAuthenticated, userId, isSuccess, data, queryClient]);
}
