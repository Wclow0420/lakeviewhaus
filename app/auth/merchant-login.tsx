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
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MerchantLoginScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

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

        } catch (error: any) {
            setLoading(false);
            Alert.alert('Login Failed', error.error || 'Invalid credentials');
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
    }
});
