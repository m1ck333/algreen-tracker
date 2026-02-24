import { useEffect, useRef, useCallback } from 'react';

// Minimal base64 silent MP4 video — keeps iOS screen awake when playing
const SILENT_MP4 =
  'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAABxtZGF0AAAA' +
  'DwYBhgABrQGOAa4BAAAAAwAAAbBtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAA' +
  'AAQAAAAAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQ' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAADHR0cmFrAAAAXHRr' +
  'aGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAA' +
  'AAAAAAAAAAAAQAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJAAAACZG1kaW' +
  'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC5oZGxyAAAAAAAAAAB2aWRlAAAAAAAA' +
  'AAAAAAAAAAAAAAAAC21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRy' +
  'ZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAALNzdGJsAAAAl3N0c2QAAAAAAAAAAQAAAIdh' +
  'dmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAABAAEAEgAAABIAAAAAAAAAAEAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAALWF2Y0MBZAAf/+EAFWdkAB+' +
  's2UBQBBAAAPAIAAADAPFA4oABcJYAAAPABAAK/AAAAGHNzdHMAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAABAAAAAHNZ3RzAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAABc3RjbwAAAAAAAAABA' +
  'AAALAAAAAF0cmFrAAAAXHRraGQAAAAHAAAAAAAAAAAAAAACAAAAAAAAAPoAAAAAAAAAAAA' +
  'AAAEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAg' +
  'bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAAgBVxAAAAAAALWhkbHIAAAAAAAAAAH' +
  'NvdW4AAAAAAAAAAAAAAAAAAABTb3VuZEhhbmRsZXIAAAAA0G1pbmYAAAAQc21oZAAAAAAA' +
  'AAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAClHN0YmwAAABoc3Rz' +
  'ZAAAAAAAAAABAAAAWm1wNGEAAAAAAAAAAQAAAAAAAAAAAAIAEAAAAACoAAAAAAADNmVz' +
  'ZHMAAAAAAwIAAQAEAA9AABQAKAABAAETABgAAAAYc3R0cwAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAHHN0c2MAAAAAAAAAAAAAAAAAAAAAAAAAAAHN0c3oAAAAAAAAAAAAAAAAAAAAAAAA' +
  'ABHNOdGNvAAAAAAAAAAEAAAAsAAAAYnVkdGEAAABabWV0YQAAAAAAAAAhaGRscgAAAAAAAA' +
  'AAbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWpdG9vAAAAHWRhdGEAAAABAAAAAExh' +
  'dmY1Ni40MC4xMDE=';

export function useWakeLock() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    // Try native Wake Lock API first
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        return;
      } catch {
        // Fall through to video fallback
      }
    }

    // iOS fallback: loop a silent video to prevent screen dimming
    if (!videoRef.current) {
      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.style.position = 'fixed';
      video.style.top = '-1px';
      video.style.left = '-1px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0.01';
      video.src = SILENT_MP4;
      document.body.appendChild(video);
      videoRef.current = video;
    }

    try {
      videoRef.current.muted = true;
      await videoRef.current.play();
    } catch {
      // Autoplay blocked — will retry on visibility change
    }
  }, []);

  useEffect(() => {
    requestWakeLock();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, [requestWakeLock]);
}
