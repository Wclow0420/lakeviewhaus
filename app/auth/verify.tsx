import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors, Layout } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function VerifyScreen() {
    const router = useRouter();
    const { email, phone, password } = useLocalSearchParams<{ email: string; phone: string; password?: string }>();
    const { login } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(60); // Start with 60s cooldown

    // Countdown Timer
    React.useEffect(() => {
        let interval: any;
        if (countdown > 0) {
            interval = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [countdown]);

    const handleVerify = async () => {
        if (!otp || otp.length < 6) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert('Error', 'Please enter a valid 6-digit OTP');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/verify-otp', { phone, otp });

            // Auto login on success
            if (response.access_token) {
                // Success haptic feedback
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Temporarily manual fetch strictly for this flow because we don't have token in SecureStore yet
                const meRes = await fetch(`${API_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${response.access_token}` }
                });
                const userData = await meRes.json();

                // response contains { access_token, refresh_token, message }
                await login(response.access_token, response.refresh_token, userData);

                // Prompt for biometric save if password is available
                if (password) {
                    await promptSaveBiometric(phone, password);
                }

                router.replace('/(tabs)');
            } else {
                setLoading(false);
                router.replace('/auth/login');
            }

        } catch (error: any) {
            setLoading(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Verification Failed', error.error || 'Invalid OTP');
        }
    };

    const promptSaveBiometric = async (id: string, pw: string) => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) return;

        const saveCreds = () => SecureStore.setItemAsync('biometric_user', JSON.stringify({ identifier: id, password: pw }));

        return new Promise<void>((resolve) => {
            Alert.alert(
                'Save Login',
                'Would you like to use biometrics for faster sign in next time?',
                [
                    {
                        text: 'Not Now',
                        style: 'cancel',
                        onPress: () => resolve()
                    },
                    {
                        text: 'Yes',
                        onPress: async () => {
                            await saveCreds();
                            resolve();
                        }
                    }
                ]
            );
        });
    };

    const handleResend = async () => {
        if (countdown > 0) return;

        setLoading(true);
        try {
            await api.post('/auth/resend-otp', { phone });
            setCountdown(60);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Verification code resent!');
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            if (error.status === 429) {
                if (error.wait_seconds) {
                    setCountdown(error.wait_seconds);
                    Alert.alert('Rate Limit', `Please wait ${Math.ceil(error.wait_seconds / 60)} minutes before resending.`);
                } else if (error.daily_limit) {
                    setCountdown(0); // No point counting down if daily limit
                    Alert.alert('Limit Reached', error.error || 'Daily limit reached.');
                } else {
                    setCountdown(60); // Fallback
                    Alert.alert('Rate Limit', error.error || 'Please wait before resending.');
                }
            } else {
                Alert.alert('Error', error.error || 'Could not resend code');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Check your SMS</Text>
                <Text style={[styles.subtitle, { color: theme.icon }]}>
                    We sent a verification code to {phone || email}
                </Text>
            </View>

            <View style={styles.form}>
                <Input
                    label="Verification Code"
                    placeholder="123456"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={{ letterSpacing: 8, fontSize: 24, textAlign: 'center' }}
                />

                <Button
                    title="Verify Account"
                    onPress={handleVerify}
                    loading={loading}
                    style={{ marginTop: Layout.spacing.lg }}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: Layout.spacing.xl, alignItems: 'center' }}>
                    <Text style={{ color: theme.icon, fontSize: 14 }}>Didn't receive code? </Text>
                    <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
                        <Text style={{
                            color: countdown > 0 ? theme.icon : theme.primary,
                            fontWeight: '600',
                            fontSize: 14,
                            textDecorationLine: countdown > 0 ? 'none' : 'underline'
                        }}>
                            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        marginVertical: Layout.spacing.xl,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: Layout.spacing.xs,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
    },
    form: {
        marginTop: Layout.spacing.md,
    },
});
