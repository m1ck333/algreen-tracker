import { useEffect, useRef } from 'react';
import { getConnection, onConnectionReady } from './connection-manager';
import type { SignalREventName } from './event-names';

export function useSignalREvent<T = unknown>(
  eventName: SignalREventName,
  handler: (data: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const callback = (data: T) => {
      console.log(`[useSignalREvent] ${eventName} fired`);
      handlerRef.current(data);
    };

    // If already connected, register immediately
    const existing = getConnection();
    console.log(`[useSignalREvent] registering ${eventName}, connection exists:`, !!existing);
    if (existing) {
      existing.on(eventName, callback);
    }

    // Subscribe to future connection readiness (handles late-mount or reconnect)
    const unsubscribe = onConnectionReady((conn) => {
      console.log(`[useSignalREvent] onConnectionReady -> re-registering ${eventName}`);
      // Remove first to avoid double-registering
      conn.off(eventName, callback);
      conn.on(eventName, callback);
    });

    return () => {
      unsubscribe();
      const conn = getConnection();
      if (conn) {
        conn.off(eventName, callback);
      }
    };
  }, [eventName]);
}
