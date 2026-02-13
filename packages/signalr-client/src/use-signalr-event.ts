import { useEffect, useRef } from 'react';
import { getConnection } from './connection-manager';
import type { SignalREventName } from './event-names';

export function useSignalREvent<T = unknown>(
  eventName: SignalREventName,
  handler: (data: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const connection = getConnection();
    if (!connection) return;

    const callback = (data: T) => {
      handlerRef.current(data);
    };

    connection.on(eventName, callback);

    return () => {
      connection.off(eventName, callback);
    };
  }, [eventName]);
}
