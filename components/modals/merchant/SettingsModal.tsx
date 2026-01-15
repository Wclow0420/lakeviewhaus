import { BaseModal } from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
    const { user, updateUser } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
    const [loading, setLoading] = useState(false);

    // Profile State
    const [name, setName] = useState(user?.name || '');
    const [username, setUsername] = useState(user?.username || '');

    const [location, setLocation] = useState(user?.location || '');
    const [logoUrl, setLogoUrl] = useState(user?.logo_url || '');

    // Password State
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Password Validation
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasLength = newPassword.length > 8;
    const isPasswordValid = hasUpper && hasLower && hasNumber && hasLength;
    const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string) => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', {
                uri,
                name: 'profile_pic.jpg',
                type: 'image/jpeg',
            } as any);

            const response = await api.post('/upload', formData);
            if (response.url) {
                setLogoUrl(response.url);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to upload image');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async () => {
        setLoading(true);
        try {
            const res = await api.put('/merchant/profile', { name, username, location, logo_url: logoUrl });
            // Update context user if backend returns updated user
            if (res.user) {
                const updatedUser = { ...user, ...res.user };
                await updateUser(updatedUser);
                Alert.alert('Success', 'Profile updated', [
                    { text: 'OK', onPress: onClose }
                ]);
            }
        } catch (error: any) {
            Alert.alert('Error', error.error || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!isPasswordValid) return;
        if (!passwordsMatch) {
            Alert.alert('Error', 'New passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await api.put('/merchant/password', { old_password: oldPassword, new_password: newPassword });
            Alert.alert('Success', 'Password updated successfully');
            setOldPassword(''); setNewPassword(''); setConfirmPassword('');
            setActiveTab('profile');
        } catch (error: any) {
            Alert.alert('Error', error.error || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    const ValidationItem = ({ label, valid }: { label: string, valid: boolean }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons
                name={valid ? "checkmark-circle" : "ellipse-outline"}
                size={16}
                color={valid ? "green" : theme.icon}
            />
            <Text style={{ color: valid ? "green" : theme.icon, marginLeft: 8, fontSize: 12 }}>
                {label}
            </Text>
        </View>
    );

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title="Settings"
            scrollable={false}
        >
            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'profile' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
                    onPress={() => setActiveTab('profile')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'profile' ? theme.primary : theme.text }]}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'password' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
                    onPress={() => setActiveTab('password')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'password' ? theme.primary : theme.text }]}>Password</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    {activeTab === 'profile' ? (
                        <View style={{ gap: 16 }}>
                            <View style={{ alignItems: 'center', marginBottom: 10 }}>
                                <TouchableOpacity onPress={pickImage} style={[styles.avatarContainer, { borderColor: theme.border }]}>
                                    {logoUrl ? (
                                        <Image
                                            key={logoUrl}
                                            source={{
                                                uri: logoUrl.startsWith('http')
                                                    ? logoUrl
                                                    : `${API_URL}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`
                                            }}
                                            style={{ width: '100%', height: '100%', borderRadius: 50 }}
                                        />
                                    ) : (
                                        <Ionicons name="camera" size={40} color={theme.icon} />
                                    )}
                                    <View style={[styles.editBadge, { backgroundColor: theme.primary }]}>
                                        <Ionicons name="pencil" size={12} color="#fff" />
                                    </View>
                                </TouchableOpacity>
                                <Text style={{ color: theme.icon, marginTop: 8, fontSize: 13 }}>Tap to change logo</Text>
                            </View>

                            <Input label="Branch Name" value={name} onChangeText={setName} />
                            <Input label="Username (Login ID)" value={username} onChangeText={setUsername} autoCapitalize="none" />
                            <Input label="Location" value={location} onChangeText={setLocation} placeholder="Optional" />

                            <Button
                                title="Save Changes"
                                onPress={handleUpdateProfile}
                                loading={loading}
                                style={{ marginTop: 20 }}
                            />
                        </View>
                    ) : (
                        <View style={{ gap: 16 }}>
                            <Input
                                label="Current Password"
                                value={oldPassword}
                                onChangeText={setOldPassword}
                                secureTextEntry
                                placeholder="Enter existing password"
                            />
                            <Input
                                label="New Password"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry
                                placeholder="Enter new password"
                            />

                            {/* Live Validation */}
                            <View style={{ marginLeft: 4, marginTop: -8, marginBottom: 8 }}>
                                <ValidationItem label="One uppercase letter" valid={hasUpper} />
                                <ValidationItem label="One lowercase letter" valid={hasLower} />
                                <ValidationItem label="One number" valid={hasNumber} />
                                <ValidationItem label="More than 8 characters" valid={hasLength} />
                            </View>

                            <Input
                                label="Confirm New Password"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                                placeholder="Re-enter new password"
                            />

                            <Button
                                title="Update Password"
                                onPress={handleUpdatePassword}
                                loading={loading}
                                disabled={!isPasswordValid || !passwordsMatch || !oldPassword}
                                style={{ marginTop: 20, opacity: (!isPasswordValid || !passwordsMatch || !oldPassword) ? 0.5 : 1 }}
                            />
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    tabText: {
        fontWeight: '600',
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        borderWidth: 1,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    }
});
