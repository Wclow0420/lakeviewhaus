import { RankUpSuccess } from '@/components/gamification/RankUpSuccess';
import { api } from '@/services/api';
import { useRouter, useSegments } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';


// Define the shape of the context
type AuthContextType = {
    user: any | null;
    isLoading: boolean;
    login: (token: string, refreshToken: string, userData: any) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (userData: any) => Promise<void>;
    refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    login: async () => { },
    logout: async () => { },
    updateUser: async () => { },
    refreshProfile: async () => { },
});

const RANK_HIERARCHY: Record<string, number> = {
    'bronze': 0,
    'silver': 1,
    'gold': 2,
    'platinum': 3
};

// Hook to access the context
export const useAuth = () => useContext(AuthContext);

// Provider Component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    // Rank Up State
    const [showRankUp, setShowRankUp] = useState(false);
    const [rankUpName, setRankUpName] = useState('');

    useEffect(() => {
        // Check for token on mount
        const checkAuth = async () => {
            try {
                const token = await SecureStore.getItemAsync('access_token');
                const userData = await SecureStore.getItemAsync('user_data');

                if (token && userData) {
                    const parsedUser = JSON.parse(userData);
                    // Legacy support: if type is missing, assume member
                    if (!parsedUser.type) parsedUser.type = 'member';

                    setUser(parsedUser);
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

        // Protective navigation logic
        const inAuthGroup = segments[0] === 'auth';
        const inMerchantTabs = segments[0] === '(merchant-tabs)';
        const inMemberTabs = segments[0] === '(tabs)';

        if (!user && !inAuthGroup) {
            // 1. Not logged in -> Redirect to Login
            router.replace('/auth/login');
        } else if (user) {
            // 2. Logged in -> Ensure they are in the correct interface
            if (user.type === 'branch') {
                // If Branch user is in Auth or Member Tabs -> Redirect to Merchant Tabs
                if (inAuthGroup || inMemberTabs) {
                    router.replace('/(merchant-tabs)');
                }
            } else {
                // If Member user is in Auth or Merchant Tabs -> Redirect to Member Tabs
                if (inAuthGroup || inMerchantTabs) {
                    router.replace('/(tabs)');
                }
            }
        }
    }, [user, segments, isLoading]);

    const login = async (token: string, refreshToken: string, userData: any) => {
        await SecureStore.setItemAsync('access_token', token);
        await SecureStore.setItemAsync('refresh_token', refreshToken);
        await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = async () => {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        await SecureStore.deleteItemAsync('user_data');
        setUser(null);
    };

    const updateUser = async (userData: any) => {
        // Check for Rank Up
        if (user && userData && user.rank && userData.rank) {
            const oldLevel = RANK_HIERARCHY[(user.rank).toLowerCase()] || 0;
            const newLevel = RANK_HIERARCHY[(userData.rank).toLowerCase()] || 0;

            if (newLevel > oldLevel) {
                // Trigger Animation
                setRankUpName(userData.rank);
                setShowRankUp(true);
            }
        }

        await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
        setUser(userData);
    };

    const refreshProfile = async () => {
        try {
            const userData = await api.get('/auth/me');
            await updateUser(userData);
        } catch (error) {
            console.error('Failed to refresh profile', error);
        }
    };

    // Check if we are in a "wrong" place before rendering to prevent flashing
    const inAuthGroup = segments[0] === 'auth';
    const inMerchantTabs = segments[0] === '(merchant-tabs)';
    const inMemberTabs = segments[0] === '(tabs)';

    // If loading, or if we are about to redirect (unauthorized path), don't show children
    const shouldShowContent = !isLoading && (
        // Case 1: Not logged in. Only allow rendering if in 'auth' group (where we are redirected).
        (!user && inAuthGroup) ||
        // Case 2: Logged in. Only allow if in correct role-based group.
        (user && user.type === 'branch' && !inMemberTabs && !inAuthGroup) ||
        (user && user.type !== 'branch' && !inMerchantTabs && !inAuthGroup)
    );

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser, refreshProfile }}>
            {shouldShowContent ? children : null}

            <RankUpSuccess
                visible={showRankUp}
                newRank={rankUpName}
                onClose={() => setShowRankUp(false)}
            />
        </AuthContext.Provider>
    );
};
