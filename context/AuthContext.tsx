import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';

// Define the shape of the context
type AuthContextType = {
    user: any | null;
    isLoading: boolean;
    login: (token: string, userData: any) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    login: async () => { },
    logout: async () => { },
});

// Hook to access the context
export const useAuth = () => useContext(AuthContext);

// Provider Component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        // Check for token on mount
        const checkAuth = async () => {
            try {
                const token = await SecureStore.getItemAsync('access_token');
                const userData = await SecureStore.getItemAsync('user_data');

                if (token && userData) {
                    setUser(JSON.parse(userData));
                }
            } catch (e) {
                console.error('Auth check failed', e);
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, []);

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === 'auth';

        if (!user && !inAuthGroup) {
            // If not logged in and not in auth group, redirect to login
            router.replace('/auth/login');
        } else if (user && inAuthGroup) {
            // If logged in and in auth group, redirect to home
            router.replace('/(tabs)');
        }
    }, [user, segments, isLoading]);

    const login = async (token: string, userData: any) => {
        await SecureStore.setItemAsync('access_token', token);
        await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = async () => {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('user_data');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
