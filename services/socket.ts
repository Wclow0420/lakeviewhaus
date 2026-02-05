import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './api';

class SocketService {
    private socket: Socket | null = null;

    /**
     * Initialize the socket connection
     * Call this after login or when the app starts if already logged in
     */
    init = async () => {
        if (this.socket && this.socket.connected) return;

        console.log('[Socket] Initializing...', API_URL);
        const token = await SecureStore.getItemAsync('access_token');

        // Socket.IO client usually needs the bare URI (e.g. http://localhost:5002)
        // If API_URL ends with /api, strip it. But based on our config, it's root.
        const baseUrl = API_URL;

        this.socket = io(baseUrl, {
            query: { token: token || '' },
            transports: ['websocket'],
            autoConnect: true,
            reconnection: true,
        });

        this.socket.on('connect', () => {
            console.log('[Socket] Connected:', this.socket?.id);
        });

        this.socket.on('connect_error', (err) => {
            console.warn('[Socket] Connection Error:', err.message);
        });

        this.socket.on('disconnect', () => {
            console.log('[Socket] Disconnected');
        });
    }

    /**
     * Disconnect the socket manually (e.g. on logout)
     */
    disconnect = () => {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
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
