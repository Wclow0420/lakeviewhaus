import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Replace with your machine's IP if running on physical Android device
// For iOS Simulator or Android Emulator (some), localhost might work or 10.0.2.2
const DEV_API_URL = Platform.select({
    ios: 'http://192.168.100.251:5002', // Your LAN IP for physical device
    android: 'http://192.168.100.251:5002', // Your LAN IP for physical device
    default: 'http://127.0.0.1:5002',
});

export const API_URL = DEV_API_URL;

const getHeaders = async () => {
    const token = await SecureStore.getItemAsync('access_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

export const api = {
    API_URL: DEV_API_URL,
    get: async (endpoint: string) => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}${endpoint}`, { headers });
        return res.json();
    },

    post: async (endpoint: string, body: any) => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
            throw { status: res.status, ...data };
        }
        return data;
    }
};
