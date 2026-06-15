import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@alblue/i18n';
import { useAuthStore } from '@alblue/auth';
import { workSessionsApi } from '@alblue/api-client';

// Auto-logout countdown banner per Bojan spec 25.05.2026 (lazy approach
// 26.05.2026) + actual enforcement 30.05.2026. Polls /work-sessions/current
// at mount + every 5 min, drives the visible countdown locally via
// setInterval. Behaviour:
//   • now ≥ alarmAtUtc → orange banner with minutes remaining.
//   • now ≥ logoutAtUtc → fire POST /work-sessions/auto-checkout once,
//     then show a full-screen overlay forcing the worker to re-login
//     (mandatory for overtime per Bojan's "obavezna prijava na tabletu").
// The server-side lazy safety net catches forgotten cases the moment any
// other call hits /current, so the only way to stay "checked in" past
// the cap is to actually be on the tablet AND have it offline.
//
// Refresh-after-auto-logout (Milos 03.06.2026 polish): the overlay state is
// persisted to sessionStorage so a page refresh while auto-logged-out keeps
// the blocker up. Cleared when the worker taps "Prijavi se ponovo" so the
// next login lands cleanly. sessionStorage (per-tab) is the right scope —
// a fresh tab is a fresh session.
const AUTO_LOGOUT_FLAG = 'tablet.autoLoggedOut';

// Audible alarm — short beep when the warning banner first appears, longer
// beep + repeats when the auto-logout modal fires. Web Audio API needs no
// permission and works on any tablet that's already had user interaction.
// Bojan/Sale 06.06.2026: visual-only banner was missed during noisy shifts.
function beep(durationMs: number, frequency = 880, volume = 0.4): void {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.start();
    window.setTimeout(() => {
      try { osc.stop(); ctx.close(); } catch { /* already torn down */ }
    }, durationMs);
  } catch {
    // Audio not available — fall back to silent (visual banner still shows).
  }
}

export function AutoLogoutBanner() {
  const { t } = useTranslation('tablet');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [now, setNow] = useState(() => Date.now());
  const [autoLoggedOut, setAutoLoggedOut] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(AUTO_LOGOUT_FLAG) === '1',
  );
  const firedRef = useRef(false);

  // Tick once a minute so the visible "X min preostalo" updates without
  // hammering the server. /current is cheap but we refetch only every
  // 5 minutes (and on focus) — alarmAtUtc doesn't move unless shift
  // config or session changes.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { data } = useQuery({
    queryKey: ['active-work-session'],
    queryFn: async () => {
      const res = await workSessionsApi.getCurrent();
      if (res.status === 204 || !res.data) return null;
      return res.data;
    },
    enabled: isAuthenticated && !autoLoggedOut,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60_000,
  });

  const autoCheckOut = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await workSessionsApi.autoCheckOut({ userId: user.id });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['active-work-session'] });
    },
  });

  const alarmAt = data?.alarmAtUtc ? new Date(data.alarmAtUtc).getTime() : null;
  const logoutAt = data?.logoutAtUtc ? new Date(data.logoutAtUtc).getTime() : null;
  const expired = logoutAt !== null && now >= logoutAt;

  // Persist + restore the auto-logged-out blocker across refresh.
  const markAutoLoggedOut = () => {
    if (typeof window !== 'undefined') sessionStorage.setItem(AUTO_LOGOUT_FLAG, '1');
    setAutoLoggedOut(true);
  };
  const clearAutoLoggedOut = () => {
    if (typeof window !== 'undefined') sessionStorage.removeItem(AUTO_LOGOUT_FLAG);
    setAutoLoggedOut(false);
  };

  // Fire auto-checkout exactly once when the cap is hit.
  useEffect(() => {
    if (expired && !firedRef.current && user?.id) {
      firedRef.current = true;
      // 1.2s lower-pitched tone for the "logged out" moment — distinct from
      // the higher warning beep so workers can tell them apart.
      beep(1200, 440, 0.5);
      autoCheckOut.mutate(undefined, {
        onSettled: () => markAutoLoggedOut(),
      });
    }
    // We intentionally exclude `autoCheckOut` from deps — mutating once is the
    // whole point. firedRef guards re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired, user?.id]);

  // Single short beep the first time the warning banner enters the "X min
  // preostalo" state for this session. Re-arms when the worker logs out and
  // back in (component unmounts/remounts).
  const warnedRef = useRef(false);
  const inWarningWindow = alarmAt !== null && logoutAt !== null && now >= alarmAt && now < logoutAt;
  useEffect(() => {
    if (inWarningWindow && !warnedRef.current) {
      warnedRef.current = true;
      beep(300, 880, 0.35);
    }
  }, [inWarningWindow]);

  // Refresh-after-auto-logout safety net: detect transitions from "had a
  // session" → "no session" in the same tab (e.g. the BG service closed the
  // session while this tab's countdown was paused). A bare `data === null`
  // check would false-positive on fresh logins before the first process is
  // started (per no-explicit-check-in flow), so we only trigger after we've
  // observed an active session at least once in this mount.
  const hadSessionRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || autoLoggedOut) return;
    if (data) {
      hadSessionRef.current = true;
    } else if (data === null && hadSessionRef.current) {
      markAutoLoggedOut();
    }
  }, [data, isAuthenticated, autoLoggedOut]);

  // Full-screen blocker after auto-logout — worker must tap to re-login.
  if (autoLoggedOut) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-8 text-center">
        <div className="max-w-xl rounded-2xl bg-white p-8 shadow-2xl">
          <h2 className="mb-4 text-tablet-xl font-bold text-red-600">
            {t('autoLogout.loggedOutTitle')}
          </h2>
          <p className="mb-8 text-tablet-base text-gray-800">
            {t('autoLogout.loggedOutBody')}
          </p>
          <button
            type="button"
            onClick={() => {
              clearAutoLoggedOut();
              logout();
              navigate('/login', { replace: true });
            }}
            className="w-full rounded-xl bg-blue-600 py-4 text-tablet-lg font-semibold text-white active:bg-blue-700"
          >
            {t('autoLogout.loginAgain')}
          </button>
        </div>
      </div>
    );
  }

  if (!data || alarmAt === null || logoutAt === null) return null;
  if (now < alarmAt) return null;

  const minutesLeft = Math.max(0, Math.ceil((logoutAt - now) / 60_000));

  return (
    <div
      className={
        expired
          ? 'bg-red-600 text-white text-center py-2 px-4 text-tablet-sm font-semibold'
          : 'bg-orange-500 text-white text-center py-2 px-4 text-tablet-sm font-semibold'
      }
    >
      {expired ? t('autoLogout.expired') : t('autoLogout.warning', { minutes: minutesLeft })}
    </div>
  );
}
