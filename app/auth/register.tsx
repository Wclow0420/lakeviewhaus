import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';

export default function RegisterScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [countryCode, setCountryCode] = useState('+60'); // Default Malaysia
    const [showCountryPicker, setShowCountryPicker] = useState(false);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [loading, setLoading] = useState(false);

    const COUNTRIES = [
        { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
        { code: '+65', name: 'Singapore', flag: '🇸🇬' },
    ];

    // Validation State
    const [validations, setValidations] = useState({
        hasUpper: false,
        hasLower: false,
        hasNumber: false,
        hasMinLength: false,
        match: false
    });

    useEffect(() => {
        setValidations({
            hasUpper: /[A-Z]/.test(password),
            hasLower: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasMinLength: password.length >= 8,
            match: password === confirmPassword && password.length > 0
        });
    }, [password, confirmPassword]);

    const isFormValid = Object.values(validations).every(v => v) && username && email && phone;

    const handleRegister = async () => {
        if (!isFormValid) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert('Invalid Form', 'Please fix the errors before proceeding.');
            return;
        }

        setLoading(true);

        // Format Phone: Remove '+' from code, remove leading '0' from number
        const cleanCode = countryCode.replace('+', '');
        const cleanPhone = phone.startsWith('0') ? phone.slice(1) : phone;
        const finalPhone = `${cleanCode}${cleanPhone}`;

        try {
            await api.post('/auth/register', {
                username,
                email,
                phone: finalPhone,
                password,
                referral_code: referralCode
            });
            setLoading(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Account created! Please verify your phone.', [
                { text: 'Verify Now', onPress: () => router.push({ pathname: '/auth/verify', params: { phone: finalPhone, email } }) }
            ]);
        } catch (error: any) {
            setLoading(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Registration Failed', error.error || 'Something went wrong');
        }
    };

    const RequirementItem = ({ fulfilled, text }: { fulfilled: boolean; text: string }) => (
        <View style={styles.reqItem}>
            <Ionicons
                name={fulfilled ? "checkmark-circle" : "ellipse-outline"}
                size={16}
                color={fulfilled ? theme.primary : theme.icon}
            />
            <Text style={[styles.reqText, { color: fulfilled ? theme.primary : theme.icon }]}>
                {text}
            </Text>
        </View>
    );

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
                <View>
                    <Text style={[styles.label, { color: theme.text }]}>Phone Number</Text>
                    <View style={[styles.phoneRow, { borderColor: theme.border }]}>
                        <TouchableOpacity
                            style={[styles.countryButton, { borderRightColor: theme.border }]}
                            onPress={() => setShowCountryPicker(!showCountryPicker)}
                        >
                            <Text style={[styles.countryText, { color: theme.text }]}>
                                {COUNTRIES.find(c => c.code === countryCode)?.flag} {countryCode}
                            </Text>
                        </TouchableOpacity>
                        <Input
                            containerStyle={{ flex: 1, borderWidth: 0, marginBottom: 0 }}
                            placeholder="123456789"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                        />
                    </View>
                    {/* Simple Country Picker Dropdown */}
                    {showCountryPicker && (
                        <View style={[styles.pickerContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            {COUNTRIES.map((c) => (
                                <TouchableOpacity
                                    key={c.code}
                                    style={styles.pickerItem}
                                    onPress={() => {
                                        setCountryCode(c.code);
                                        setShowCountryPicker(false);
                                    }}
                                >
                                    <Text style={{ fontSize: 16 }}>{c.flag} {c.name} ({c.code})</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
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
                <Input
                    label="Confirm Password"
                    placeholder="••••••••"
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                />

                <Input
                    label="Referral Code (Optional)"
                    placeholder="Have a code?"
                    value={referralCode}
                    onChangeText={setReferralCode}
                    autoCapitalize="characters"
                />

                {/* Password Requirements Checklist */}
                <View style={styles.requirementsContainer}>
                    <RequirementItem fulfilled={validations.hasMinLength} text="At least 8 characters" />
                    <RequirementItem fulfilled={validations.hasUpper} text="One uppercase letter" />
                    <RequirementItem fulfilled={validations.hasLower} text="One lowercase letter" />
                    <RequirementItem fulfilled={validations.hasNumber} text="One number" />
                    <RequirementItem fulfilled={validations.match} text="Passwords match" />
                </View>

                <Button
                    title="Sign Up"
                    onPress={handleRegister}
                    loading={loading}
                    disabled={!isFormValid}
                    style={{
                        marginTop: Layout.spacing.lg,
                        opacity: isFormValid ? 1 : 0.6
                    }}
                />
            </View>
            <View style={{ height: 40 }} />
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
    requirementsContainer: {
        marginTop: 8,
        marginBottom: 8,
        gap: 4,
    },
    reqItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    reqText: {
        fontSize: 12,
        fontWeight: '500',
    },
    label: {
        marginBottom: 8,
        fontWeight: '500',
    },
    phoneRow: {
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 16,
        alignItems: 'center',
        overflow: 'hidden',
    },
    countryButton: {
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderRightWidth: 1,
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    countryText: {
        fontWeight: '600',
    },
    pickerContainer: {
        position: 'absolute',
        top: 75, // Adjust based on layout
        left: 0,
        zIndex: 10,
        width: 200,
        borderWidth: 1,
        borderRadius: 8,
        padding: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    pickerItem: {
        padding: 12,
    }
});
