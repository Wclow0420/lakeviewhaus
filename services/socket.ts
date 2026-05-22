import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { API_URL } from './api';

const WATCHDOG_INTERVAL_MS = 30000; // check liveness every 30s

class SocketService {
    private socket: Socket | null = null;
    private lastToken: string | null = null;
    /**
     * Shared in-flight init promise. Concurrent callers (AuthContext +
     * NotificationContext both firing on `user` change, plus React strict-mode
     * double-mounts) all await the SAME promise — so exactly one socket is
     * created even if `init()` is called 5× in quick succession. Without this,
     * the race window between `await SecureStore.getItemAsync()` and
     * `this.socket = io(...)` lets two callers both observe `this.socket ===
     * null` and both call `io()`, leaving two live sockets connected to the
     * server.
     */
    private pendingInit: Promise<void> | null = null;
    private watchdogTimer: ReturnType<typeof setInterval> | null = null;
    private appStateSubscription: NativeEventSubscription | null = null;

    init = (): Promise<void> => {
        if (this.pendingInit) return this.pendingInit;
        this.pendingInit = this._runInit().finally(() => {
            this.pendingInit = null;
        });
        return this.pendingInit;
    }

    private _runInit = async (): Promise<void> => {
        const token = await SecureStore.getItemAsync('access_token');

        // Same token AND socket is still live → existing socket is fine.
        if (this.socket && this.socket.connected && this.lastToken === token) {
            return;
        }

        // Token changed (or socket dead/half-dead) → tear down before reconnecting.
        if (this.socket) {
            console.log('[Socket] Tearing down existing connection before reconnect');
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }

        console.log('[Socket] Initializing...', API_URL);
        this.lastToken = token;

        this.socket = io(API_URL, {
            query: { token: token || '' },
            transports: ['websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });

        this.socket.on('connect', () => {
            console.log('[Socket] Connected:', this.socket?.id);
        });

        this.socket.on('connect_error', (err) => {
            console.warn('[Socket] Connection Error:', err.message);
        });

        this.socket.on('disconnect', (reason: string) => {
            // Reasons worth investigating:
            //   'io server disconnect' → server kicked us, we must reconnect manually
            //   'ping timeout' → underlying socket died silently, server stopped hearing us
            //   'transport close' → network dropped (mobile network switch, wifi off)
            console.log('[Socket] Disconnected:', reason);
            if (reason === 'io server disconnect') {
                // socket.io won't auto-reconnect after a server-initiated kick; force it.
                this.socket?.connect();
            }
        });

        this.startWatchdog();
        this.subscribeAppState();
    }

    /**
     * Periodic liveness check. If the socket has been dropped silently
     * (typical on mobile / SUNMI Android after the device wakes from doze
     * or after a long uptime where the TCP connection dies without an
     * RST), force a full reconnect.
     *
     * socket.io has its own heartbeat (pingInterval/pingTimeout) but on
     * Android Doze the JS timer may be suspended, missing the ping
     * window and leaving the client with a stale `socket.connected ===
     * true` that's not actually receiving server messages. This watchdog
     * is the safety net that ensures the merchant/customer reconnects
     * within ~30s of the device waking up.
     */
    private startWatchdog = () => {
        if (this.watchdogTimer) return;
        this.watchdogTimer = setInterval(() => {
            if (this.socket && !this.socket.connected) {
                console.log('[Socket] Watchdog: socket disconnected, forcing reconnect');
                this.forceReconnect();
            }
        }, WATCHDOG_INTERVAL_MS);
    }

    private stopWatchdog = () => {
        if (this.watchdogTimer) {
            clearInterval(this.watchdogTimer);
            this.watchdogTimer = null;
        }
    }

    /**
     * On AppState 'active' (app came back to foreground), do an immediate
     * health check rather than waiting for the 30s watchdog tick. This is
     * the common path for regular users who minimize and return.
     */
    private subscribeAppState = () => {
        if (this.appStateSubscription) return;
        this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (nextState === 'active' && this.socket && !this.socket.connected) {
                console.log('[Socket] AppState active + socket disconnected → reconnect');
                this.forceReconnect();
            }
        });
    }

    /**
     * Force a full reconnect: tear down + re-init from scratch. Used by
     * the watchdog and the AppState listener when socket.io's built-in
     * reconnection has stalled.
     */
    forceReconnect = () => {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        this.lastToken = null; // bypass the same-token guard so init() really runs
        this.init();
    }

    /**
     * Disconnect the socket manually (e.g. on logout).
     */
    disconnect = () => {
        this.stopWatchdog();
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        this.lastToken = null;
    }

    /**
     * Subscribe to an event
     */
    on = (event: string, callback: (...args: any[]) => void) => {
        if (!this.socket) {
            console.warn('[Socket] Trying to listen to event but socket not initialized');
            return;
        }
        this.socket.on(event, callback);
    }

    /**
     * Unsubscribe from an event
     */
    off = (event: string, callback?: (...args: any[]) => void) => {
        if (!this.socket) return;
        this.socket.off(event, callback);
    }

    /**
     * Emit an event to server
     */
    emit = (event: string, data: any) => {
        if (!this.socket) {
            console.warn('[Socket] Trying to emit event but socket not initialized');
            return;
        }
        this.socket.emit(event, data);
    }
}

export const socketService = new SocketService();
