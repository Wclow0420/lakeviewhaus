import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors, Layout } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

export default function LoginScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [secretTaps, setSecretTaps] = useState(0); // Secret reveal state
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const handleLogin = async () => {
        setLoading(true);
        try {
            const response = await api.post('/auth/login', { identifier, password });

            await login(response.access_token, response.refresh_token, response.user);
            // Router redirect handled by AuthContext automatically

        } catch (error: any) {
            setLoading(false);
            Alert.alert('Login Failed', error.error || 'Invalid credentials');
        }
    };

    return (
        <ScreenWrapper>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableWithoutFeedback onPress={() => setSecretTaps(prev => prev + 1)}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.inputBackground }]}>
                        <Ionicons name="restaurant" size={40} color={theme.primary} />
                    </View>
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
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Layout.spacing.lg,
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
});
