import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors, Layout } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { Stack, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { Alert, Image as RNImage, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

export default function LoginScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [secretTaps, setSecretTaps] = useState(0); // Secret reveal state
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const [showBiometric, setShowBiometric] = useState(false);

    useEffect(() => {
        const checkBiometric = async () => {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            const saved = await SecureStore.getItemAsync('biometric_user');
            setShowBiometric(hasHardware && isEnrolled && !!saved);
        };
        checkBiometric();
    }, []);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const response = await api.post('/auth/login', { identifier, password });

            // Success haptic feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            await login(response.access_token, response.refresh_token, response.user);
            promptSaveBiometric(identifier, password);

        } catch (error: any) {
            setLoading(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            if (error.status === 403 && error.phone) {
                Alert.alert(
                    'Verification Required',
                    'Your account is not verified yet.',
                    [
                        {
                            text: 'Verify Now',
                            onPress: () => router.push({
                                pathname: '/auth/verify',
                                params: { phone: error.phone, email: error.email }
                            })
                        }
                    ]
                );
            } else {
                Alert.alert('Login Failed', error.error || 'Invalid credentials');
            }
        }
    };

    const promptSaveBiometric = async (id: string, pw: string) => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) return;

        const alreadySaved = await SecureStore.getItemAsync('biometric_user');
        const saveCreds = () => SecureStore.setItemAsync('biometric_user', JSON.stringify({ identifier: id, password: pw }));

        if (!alreadySaved) {
            Alert.alert(
                'Save Login',
                'Would you like to use biometrics for faster sign in next time?',
                [
                    { text: 'Not Now', style: 'cancel' },
                    { text: 'Yes', onPress: () => { saveCreds(); setShowBiometric(true); } }
                ]
            );
        } else {
            const { identifier: savedId } = JSON.parse(alreadySaved);
            if (savedId !== id) {
                Alert.alert(
                    'Replace Saved Login',
                    `You have a different account saved for biometrics. Replace with this one?`,
                    [
                        { text: 'Not Now', style: 'cancel' },
                        { text: 'Replace', onPress: () => { saveCreds(); setShowBiometric(true); } }
                    ]
                );
            }
        }
    };

    const handleBiometricLogin = async () => {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Sign in to Lakeview Haus',
                cancelLabel: 'Cancel',
                disableDeviceFallback: Constants.isDevice,
            });
            if (!result.success) return;

            const saved = await SecureStore.getItemAsync('biometric_user');
            if (!saved) return;

            const { identifier: savedId, password: savedPw } = JSON.parse(saved);
            setLoading(true);
            const response = await api.post('/auth/login', { identifier: savedId, password: savedPw });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await login(response.access_token, response.refresh_token, response.user);
        } catch (error: any) {
            setLoading(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            // Credentials are stale — clear and nudge to manual login
            await SecureStore.deleteItemAsync('biometric_user');
            setShowBiometric(false);
            Alert.alert('Biometric Login Failed', 'Your saved login is outdated. Please sign in manually.');
        }
    };

    return (
        <ScreenWrapper>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableWithoutFeedback onPress={() => setSecretTaps(prev => prev + 1)}>
                    <RNImage
                        source={require('../../assets/images/logo.png')}
                        style={{ width: 120, height: 120, borderRadius: 60, resizeMode: 'contain', marginBottom: Layout.spacing.md }}
                    />
                </TouchableWithoutFeedback>
                <Text style={[styles.title, { color: theme.text }]}>Welcome Back!</Text>
                <Text style={[styles.subtitle, { color: theme.icon }]}>Hungry for points? Sign in to continue.</Text>
            </View>

            <View style={styles.form}>
                <Input
                    label="Email, Phone or Username"
                    placeholder="Enter your email, phone or username"
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                />
                <Input
                    label="Password"
                    placeholder="••••••••"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                />

                <TouchableOpacity style={styles.forgotPassword}>
                    <Text style={{ color: theme.primary, fontWeight: '600' }}>Forgot Password?</Text>
                </TouchableOpacity>

                <Button
                    title="Sign In"
                    onPress={handleLogin}
                    loading={loading}
                    style={{ marginTop: Layout.spacing.lg }}
                />

                {/* Biometric Login Button */}
                {showBiometric && (
                    <View style={{ alignItems: 'center', marginTop: 24 }}>
                        <TouchableOpacity
                            style={[styles.biometricButton, { backgroundColor: theme.inputBackground }]}
                            onPress={handleBiometricLogin}
                        >
                            <MaterialCommunityIcons name="face-recognition" size={28} color={theme.primary} />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.footer}>
                    <Text style={{ color: theme.icon }}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => router.push('/auth/register')}>
                        <Text style={{ color: theme.primary, fontWeight: '700' }}>Sign Up</Text>
                    </TouchableOpacity>
                </View>

                {/* Secret Merchant Entry */}
                {secretTaps >= 7 && (
                    <TouchableOpacity onPress={() => router.push('/auth/merchant-login')} style={{ marginTop: 30, alignSelf: 'center' }}>
                        <Text style={{ color: theme.icon, fontSize: 12 }}>Merchant Sign In</Text>
                    </TouchableOpacity>
                )}
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        alignItems: 'center',
        marginVertical: Layout.spacing.xl * 1.5,
    },
    title: {
        fontSize: 28,
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
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: Layout.spacing.md,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: Layout.spacing.xl,
    },
    biometricButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
