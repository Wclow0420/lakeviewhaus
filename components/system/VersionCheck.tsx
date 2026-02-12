import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, StyleSheet, Text, View } from 'react-native';

interface AppConfig {
    min_version_ios: string;
    min_version_android: string;
    store_url_ios: string;
    store_url_android: string;
    maintenance_mode: string;
}

export default function VersionCheck() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [updateRequired, setUpdateRequired] = useState(false);
    const [checking, setChecking] = useState(true);
    const [storeUrl, setStoreUrl] = useState('');
    const [isOTAUpdating, setIsOTAUpdating] = useState(false);

    useEffect(() => {
        checkVersionAndUpdates();
    }, []);

    const compareVersions = (v1: string, v2: string) => {
        // Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
        const p1 = v1.split('.').map(Number);
        const p2 = v2.split('.').map(Number);
        const len = Math.max(p1.length, p2.length);

        for (let i = 0; i < len; i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    };

    const checkVersionAndUpdates = async () => {
        try {
            // 1. Check for OTA Updates first (silent background check)
            if (!__DEV__) {
                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    setIsOTAUpdating(true);
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                    return; // App will reload
                }
            }
        } catch (e) {
            console.log("OTA Update check failed:", e);
        }

        try {
            // 2. Check Native Version Requirement
            // In Expo Go (__DEV__), nativeApplicationVersion is the *Expo Client* version (e.g., 54.0.0).
            // We want the JS version (1.0.0) from package.json for testing.
            const currentVersion = __DEV__
                ? Constants.expoConfig?.version || '1.0.0'
                : Application.nativeApplicationVersion || '1.0.0';

            console.log(`📱 App Version (${__DEV__ ? 'DEV' : 'PROD'}):`, currentVersion);
            const config: AppConfig = await api.get('/config/version');

            const minVersion = Platform.OS === 'ios' ? config.min_version_ios : config.min_version_android;
            const url = Platform.OS === 'ios' ? config.store_url_ios : config.store_url_android;

            setStoreUrl(url);

            if (compareVersions(currentVersion, minVersion) < 0) {
                setUpdateRequired(true);
            }

        } catch (e) {
            console.log("Version check failed:", e);
        } finally {
            setChecking(false);
        }
    };

    const handleUpdate = () => {
        Linking.openURL(storeUrl);
    };

    if (isOTAUpdating) {
        return (
            <Modal visible={true} transparent={true} animationType="fade" statusBarTranslucent>
                <View style={styles.overlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={[styles.title, { color: theme.text, marginTop: 20 }]}>Updating App...</Text>
                        <Text style={[styles.subtitle, { color: theme.text }]}>Please wait while we apply the latest changes.</Text>
                    </View>
                </View>
            </Modal>
        );
    }

    if (!updateRequired) return null;

    return (
        <Modal visible={true} transparent={true} animationType="fade" statusBarTranslucent>
            <View style={styles.overlay}>
                <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
                    <Ionicons name="rocket-outline" size={60} color={theme.primary} />
                    <Text style={[styles.title, { color: theme.text }]}>Update Required</Text>
                    <Text style={[styles.subtitle, { color: theme.text }]}>
                        A new version of Lakeview Haus is available. Please update to continue using the app.
                    </Text>

                    <Button
                        title="Update Now"
                        onPress={handleUpdate}
                        style={{ width: '100%' }}
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', // Semi-transparent black background
    },
    modalCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center'
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        opacity: 0.8,
        marginBottom: 24
    }
});
