import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function VerifyScreen() {
    const router = useRouter();
    const { email } = useLocalSearchParams<{ email: string }>();
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
            const response = await api.post('/auth/verify-otp', { email, otp });

            // Auto login on success
            if (response.access_token) {
                // Fetch user data if not fully provided in verify response?
                // Verify response gives tokens, but maybe not full user object?
                // Let's check backend... backend verify returns tokens but NO user object.
                // So we might need to fetch /auth/me or just basic info

                // Wait, verify-otp in backend returns: { message, access_token, refresh_token }
                // We lack user object to store in context. 
                // We can Decode token or call /auth/me temporarily or update backend.
                // Let's quickly try to call /auth/me using the new token.

                // Temporarily manual fetch strictly for this flow
                const meRes = await fetch(`${api.API_URL || 'http://127.0.0.1:5002'}/auth/me`, {
                    headers: { Authorization: `Bearer ${response.access_token}` }
                });
                const userData = await meRes.json();

                await login(response.access_token, userData);
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
                <Text style={[styles.title, { color: theme.text }]}>Check your Email</Text>
                <Text style={[styles.subtitle, { color: theme.icon }]}>
                    We sent a verification code to {email}
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
