import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';

export default function RegisterScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!username || !email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/register', { username, email, password });
            setLoading(false);
            Alert.alert('Success', 'Account created! Please verify your email.', [
                { text: 'Verify Now', onPress: () => router.push({ pathname: '/auth/verify', params: { email } }) }
            ]);
        } catch (error: any) {
            setLoading(false);
            Alert.alert('Registration Failed', error.error || 'Something went wrong');
        }
    };

    return (
        <ScreenWrapper>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
                <Text style={[styles.subtitle, { color: theme.icon }]}>Join Lakeview Haus today!</Text>
            </View>

            <View style={styles.form}>
                <Input
                    label="Username"
                    placeholder="LakeviewFan"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                />
                <Input
                    label="Email Address"
                    placeholder="you@example.com"
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

                <Button
                    title="Sign Up"
                    onPress={handleRegister}
                    loading={loading}
                    style={{ marginTop: Layout.spacing.lg }}
                />
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        marginVertical: Layout.spacing.xl,
    },
    backButton: {
        marginBottom: Layout.spacing.md,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: Layout.spacing.xs,
    },
    subtitle: {
        fontSize: 16,
    },
    form: {
        marginTop: Layout.spacing.md,
    },
});
