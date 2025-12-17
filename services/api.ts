import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Replace with your machine's IP if running on physical Android device
// For iOS Simulator or Android Emulator (some), localhost might work or 10.0.2.2
const DEV_API_URL = Platform.select({
    ios: 'http://172.20.10.2:5002', // Your LAN IP for physical device
    android: 'http://172.20.10.2:5002', // Your LAN IP for physical device
    default: 'http://127.0.0.1:5002',
});

export const API_URL = DEV_API_URL;

const getHeaders = async (tokenOverride?: string) => {
    const token = tokenOverride || await SecureStore.getItemAsync('access_token');
    console.log('[API] Getting headers, token present:', !!token);
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const refreshAccessToken = async (): Promise<string | null> => {
    try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) return null;

        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${refreshToken}`
            }
        });

        if (res.ok) {
            const data = await res.json();
            await SecureStore.setItemAsync('access_token', data.access_token);
            return data.access_token;
        }
        return null;
    } catch (error) {
        console.error("Token refresh failed", error);
        return null;
    }
};

const request = async (method: 'GET' | 'POST', endpoint: string, body?: any) => {
    let headers = await getHeaders();
    let config: RequestInit = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    };

    let res = await fetch(`${API_URL}${endpoint}`, config);

    if (res.status === 401) {
        console.log("401 detected, attempting to refresh token...");
        const newToken = await refreshAccessToken();

        if (newToken) {
            console.log("Token refreshed successfully, retrying request...");
            headers = await getHeaders(newToken);
            config.headers = headers;
            res = await fetch(`${API_URL}${endpoint}`, config);
        } else {
            console.log("Refresh failed or no refresh token. Logging out...");
            // Clear tokens to force logout on next app check or via interceptor
            await SecureStore.deleteItemAsync('access_token');
            await SecureStore.deleteItemAsync('refresh_token');
            await SecureStore.deleteItemAsync('user_data');
            // We can't easily access AuthContext's logout here, but clearing storage is a start.
            throw { status: 401, error: "Session expired" };
        }
    }

    const data = await res.json();
    if (!res.ok) {
        throw { status: res.status, ...data };
    }
    return data;
};

export const api = {
    API_URL: DEV_API_URL,
    get: async (endpoint: string) => {
        return request('GET', endpoint);
    },

    post: async (endpoint: string, body: any) => {
        return request('POST', endpoint, body);
    },

    // Gamification

    // Gamification
    getCheckInStatus: async () => {
        return api.get('/gamification/status');
    },
    performCheckIn: async () => {
        return api.post('/gamification/check-in', {});
    }
};
