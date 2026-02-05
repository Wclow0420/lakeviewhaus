import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors, Layout } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MerchantLoginScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const [showBiometric, setShowBiometric] = useState(false);

    useEffect(() => {
        const checkBiometric = async () => {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            const saved = await SecureStore.getItemAsync('biometric_merchant');
            setShowBiometric(hasHardware && isEnrolled && !!saved);
        };
        checkBiometric();
    }, []);

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/merchant/login', { username, password });

            // Mark user type for redirect logic
            const branchData = { ...response.branch, type: 'branch' };
            await login(response.access_token, response.refresh_token, branchData);
            promptSaveBiometric(username, password);

        } catch (error: any) {
            setLoading(false);
            Alert.alert('Login Failed', error.error || 'Invalid credentials');
        }
    };

    const promptSaveBiometric = async (user: string, pw: string) => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) return;

        const alreadySaved = await SecureStore.getItemAsync('biometric_merchant');
        const saveCreds = () => SecureStore.setItemAsync('biometric_merchant', JSON.stringify({ username: user, password: pw }));

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
            const { username: savedUser } = JSON.parse(alreadySaved);
            if (savedUser !== user) {
                Alert.alert(
                    'Replace Saved Login',
                    `You have a different merchant account saved for biometrics. Replace with this one?`,
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
                promptMessage: 'Sign in as Merchant',
                cancelLabel: 'Cancel',
                disableDeviceFallback: Constants.isDevice,
            });
            if (!result.success) return;

            const saved = await SecureStore.getItemAsync('biometric_merchant');
            if (!saved) return;

            const { username: savedUser, password: savedPw } = JSON.parse(saved);
            setLoading(true);
            const response = await api.post('/auth/merchant/login', { username: savedUser, password: savedPw });
            const branchData = { ...response.branch, type: 'branch' };
            await login(response.access_token, response.refresh_token, branchData);
        } catch (error: any) {
            setLoading(false);
            await SecureStore.deleteItemAsync('biometric_merchant');
            setShowBiometric(false);
            Alert.alert('Biometric Login Failed', 'Your saved login is outdated. Please sign in manually.');
        }
    };

    return (
        <ScreenWrapper>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={{ flex: 1, justifyContent: 'center' }}>
                <View style={[styles.card, { backgroundColor: theme.inputBackground }]}>
                    <View style={styles.header}>
                        <View style={[styles.iconContainer, { backgroundColor: theme.background }]}>
                            <Ionicons name="business" size={40} color={theme.primary} />
                        </View>
                        <Text style={[styles.title, { color: theme.text }]}>Merchant Portal</Text>
                        <Text style={[styles.subtitle, { color: theme.icon }]}>Branch Access</Text>
                    </View>

                    <View style={styles.form}>
                        <Input
                            label="Branch Username"
                            placeholder="lakeview_main"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                        <Input
                            label="Password"
                            placeholder="••••••••"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />

                        <Button
                            title="Access Dashboard"
                            onPress={handleLogin}
                            loading={loading}
                            style={{ marginTop: Layout.spacing.lg, backgroundColor: '#000' }} // distinct black button
                            textStyle={{ color: '#FCD259' }}
                        />

                        {/* Biometric Login Button */}
                        {showBiometric && (
                            <View style={{ alignItems: 'center', marginTop: 24 }}>
                                <TouchableOpacity
                                    style={[styles.biometricButton, { backgroundColor: theme.background }]}
                                    onPress={handleBiometricLogin}
                                >
                                    <MaterialCommunityIcons name="face-recognition" size={28} color={theme.primary} />
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity onPress={() => router.back()} style={{ alignSelf: 'center', marginTop: 20 }}>
                            <Text style={{ color: theme.icon }}>Back to Member Login</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    card: {
        margin: 20,
        padding: 30,
        borderRadius: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: Layout.spacing.xl,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Layout.spacing.lg,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: Layout.spacing.xs,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
    form: {
        marginTop: Layout.spacing.md,
    },
    biometricButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
