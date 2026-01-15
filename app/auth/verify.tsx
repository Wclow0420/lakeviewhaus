import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors, Layout } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

export default function VerifyScreen() {
    const router = useRouter();
    const { email, phone } = useLocalSearchParams<{ email: string; phone: string }>();
    const { login } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);

    const handleVerify = async () => {
        if (!otp || otp.length < 6) {
            Alert.alert('Error', 'Please enter a valid 6-digit OTP');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/verify-otp', { phone, otp });

            // Auto login on success
            if (response.access_token) {
                // Temporarily manual fetch strictly for this flow because we don't have token in SecureStore yet
                const meRes = await fetch(`${API_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${response.access_token}` }
                });
                const userData = await meRes.json();

                // response contains { access_token, refresh_token, message }
                await login(response.access_token, response.refresh_token, userData);
                router.replace('/(tabs)');
            } else {
                setLoading(false);
                router.replace('/auth/login');
            }

        } catch (error: any) {
            setLoading(false);
            Alert.alert('Verification Failed', error.error || 'Invalid OTP');
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

                <Button
                    title="Resend Code"
                    variant="ghost"
                    onPress={() => Alert.alert('TODO', 'Resend logic here')}
                    style={{ marginTop: Layout.spacing.sm }}
                />
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
