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

    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState(user?.username || '');
    const [profilePicUrl, setProfilePicUrl] = useState(user?.profile_pic_url || '');

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

            const response = await api.post('/upload', formData); // Assuming reused generic upload endpoint
            if (response.url) {
                setProfilePicUrl(response.url);
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
            const res = await api.user.updateProfile({ username, profile_pic_url: profilePicUrl });

            // Context update
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

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title="Settings"
            scrollable={false}
        >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <View style={{ gap: 16 }}>
                        <View style={{ alignItems: 'center', marginBottom: 10 }}>
                            <TouchableOpacity onPress={pickImage} style={[styles.avatarContainer, { borderColor: theme.border }]}>
                                {profilePicUrl ? (
                                    <Image
                                        key={profilePicUrl}
                                        source={{
                                            uri: profilePicUrl.startsWith('http')
                                                ? profilePicUrl
                                                : `${API_URL}${profilePicUrl}`
                                        }}
                                        style={{ width: '100%', height: '100%', borderRadius: 50 }}
                                    />
                                ) : (
                                    <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                                        <Text style={styles.avatarText}>{username?.[0]?.toUpperCase() || 'U'}</Text>
                                    </View>
                                )}
                                <View style={[styles.editBadge, { backgroundColor: theme.primary }]}>
                                    <Ionicons name="pencil" size={12} color="#fff" />
                                </View>
                            </TouchableOpacity>
                            <Text style={{ color: theme.icon, marginTop: 8, fontSize: 13 }}>Tap to change picture</Text>
                        </View>

                        <Input label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />

                        <Button
                            title="Save Changes"
                            onPress={handleUpdateProfile}
                            loading={loading}
                            style={{ marginTop: 20 }}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
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
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 40,
        fontWeight: '800',
        color: '#000',
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
