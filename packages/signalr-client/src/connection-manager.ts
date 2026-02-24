import * as signalR from '@microsoft/signalr';

let connection: signalR.HubConnection | null = null;
let startPromise: Promise<void> | null = null;

const SIGNALR_URL =
  typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_SIGNALR_URL
    : undefined;

// Listeners notified when connection becomes available
type ConnectionListener = (conn: signalR.HubConnection) => void;
const connectionListeners = new Set<ConnectionListener>();

export function onConnectionReady(listener: ConnectionListener): () => void {
  // If already connected, invoke immediately
  if (connection && connection.state === signalR.HubConnectionState.Connected) {
    listener(connection);
  }
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

function notifyConnectionReady() {
  if (!connection) return;
  connectionListeners.forEach((listener) => listener(connection!));
}

export function getConnection(): signalR.HubConnection | null {
  return connection;
}

export function createConnection(token: string, url?: string): signalR.HubConnection {
  if (connection) {
    return connection;
  }

  const hubUrl = url || SIGNALR_URL || 'http://localhost:5030/hubs/production';

  connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: () => token,
    })
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (retryContext) => {
        // Exponential backoff: 0s, 1s, 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
        return delay;
      },
    })
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  // Re-notify listeners after automatic reconnect so event handlers are re-registered
  connection.onreconnected(() => {
    notifyConnectionReady();
  });

  return connection;
}

export async function startConnection(): Promise<void> {
  if (!connection) {
    throw new Error('Connection not created. Call createConnection first.');
  }

  if (connection.state === signalR.HubConnectionState.Connected) {
    return;
  }

  // If a start is already in-flight, reuse that promise (handles StrictMode double-mount)
  if (startPromise) {
    return startPromise;
  }

  startPromise = connection
    .start()
    .then(() => {
      notifyConnectionReady();
    })
    .catch((err) => {
      // Ignore the harmless "not in Disconnected state" error from StrictMode double-mount
      if (
        err instanceof Error &&
        err.message.includes('not in the \'Disconnected\' state')
      ) {
        return;
      }
      console.error('SignalR connection failed:', err);
      throw err;
    })
    .finally(() => {
      startPromise = null;
    });

  return startPromise;
}

export async function stopConnection(): Promise<void> {
  startPromise = null;
  if (connection) {
    await connection.stop();
    connection = null;
  }
}

export async function joinTenantGroup(tenantId: string): Promise<void> {
  if (connection?.state === signalR.HubConnectionState.Connected) {
    await connection.invoke('JoinTenantGroup', tenantId);
  }
}

export async function leaveTenantGroup(tenantId: string): Promise<void> {
  if (connection?.state === signalR.HubConnectionState.Connected) {
    await connection.invoke('LeaveTenantGroup', tenantId);
  }
}

export async function joinProcessGroup(processId: string): Promise<void> {
  if (connection?.state === signalR.HubConnectionState.Connected) {
    await connection.invoke('JoinProcessGroup', processId);
  }
}

export async function leaveProcessGroup(processId: string): Promise<void> {
  if (connection?.state === signalR.HubConnectionState.Connected) {
    await connection.invoke('LeaveProcessGroup', processId);
  }
}
