import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import {
    useFonts,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
    anchor: '(tabs)',
};

import VersionCheck from '@/components/system/VersionCheck';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { CartProvider } from '@/context/CartContext';

// Keep the splash up while we load the custom font
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const [fontsLoaded] = useFonts({
        PlusJakartaSans_400Regular,
        PlusJakartaSans_500Medium,
        PlusJakartaSans_600SemiBold,
        PlusJakartaSans_700Bold,
    });

    useEffect(() => {
        if (fontsLoaded) {
            console.log('[fonts] Plus Jakarta Sans loaded, hiding splash');
            SplashScreen.hideAsync().catch(() => {});
        } else {
            console.log('[fonts] waiting for fonts to load...');
        }
    }, [fontsLoaded]);

    if (!fontsLoaded) return null;

    return (
        <AuthProvider>
            <NotificationProvider>
                <CartProvider>
                    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                        <VersionCheck />
                        <Stack>
                            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                            <Stack.Screen name="(merchant-tabs)" options={{ headerShown: false }} />
                            <Stack.Screen name="merchant" options={{ headerShown: false }} />
                            <Stack.Screen name="auth" options={{ headerShown: false }} />
                            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                            <Stack.Screen name="rewards" options={{ headerShown: false }} />
                            <Stack.Screen name="orders" options={{ headerShown: false }} />
                            <Stack.Screen name="order-detail" options={{ headerShown: false }} />
                        </Stack>
                        <StatusBar style="auto" />
                    </ThemeProvider>
                </CartProvider>
            </NotificationProvider>
        </AuthProvider>
    );
}
