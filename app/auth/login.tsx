import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const handleLogin = async () => {
        setLoading(true);
        try {
            const response = await api.post('/auth/login', { email, password }); // Backend expects 'email' now for Member login!
            // Let's verify backend: "data.get('email') # Login with Email". Correct.
            // So body should be { email, password }.

            await login(response.access_token, response.user);
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
                <View style={[styles.iconContainer, { backgroundColor: theme.inputBackground }]}>
                    <Ionicons name="restaurant" size={40} color={theme.primary} />
                </View>
                <Text style={[styles.title, { color: theme.text }]}>Welcome Back!</Text>
                <Text style={[styles.subtitle, { color: theme.icon }]}>Hungry for points? Sign in to continue.</Text>
            </View>

            <View style={styles.form}>
                <Input
                    label="Email Address"
                    placeholder="brian@lakeview.com"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
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
