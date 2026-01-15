import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const SCAN_SIZE = width * 0.7;

export default function ScanScreen() {
    const { user } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    // Modes: 'scan' | 'code'
    const [mode, setMode] = useState<'scan' | 'code'>('code');
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [qrToken, setQrToken] = useState<string>('');
    const [loadingToken, setLoadingToken] = useState(false);

    useEffect(() => {
        if (!permission) {
            requestPermission();
        }
    }, [permission]);

    // Generate QR token when switching to code mode
    useEffect(() => {
        if (mode === 'code' && !qrToken) {
            generateQRToken();
        }
    }, [mode]);

    // Auto-refresh QR token every 4 minutes (before 5-minute expiry)
    useEffect(() => {
        if (mode === 'code' && qrToken) {
            const interval = setInterval(() => {
                generateQRToken();
            }, 4 * 60 * 1000); // 4 minutes

            return () => clearInterval(interval);
        }
    }, [mode, qrToken]);

    const generateQRToken = async () => {
        setLoadingToken(true);
        try {
            const response = await api.generateQRToken();
            setQrToken(response.qr_token);
        } catch (error: any) {
            console.error('Failed to generate QR token:', error);
            Alert.alert('Error', 'Failed to generate QR code. Please try again.');
        } finally {
            setLoadingToken(false);
        }
    };

    if (!permission) {
        // Camera permissions are still loading.
        return <View style={[styles.container, { backgroundColor: theme.background }]} />;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet.
        return (
            <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                <Ionicons name="alert-circle-outline" size={60} color={theme.text} style={{ marginBottom: 20 }} />
                <Text style={[styles.message, { color: theme.text }]}>We need your permission to show the camera</Text>
                <TouchableOpacity onPress={requestPermission} style={[styles.permButton, { backgroundColor: theme.primary }]}>
                    <Text style={[styles.permButtonText, { color: theme.background }]}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleBarCodeScanned = ({ type, data }: { type: string, data: string }) => {
        if (scanned) return;
        setScanned(true);
        Alert.alert(
            "Scanned!",
            `Data: ${data}`,
            [{ text: 'OK', onPress: () => setScanned(false) }]
        );
        // TODO: Handle merchant/user code logic here
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>

            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Scan & Pay</Text>
            </View>

            {/* Custom Tab Switcher */}
            <View style={[styles.tabContainer, { backgroundColor: theme.inputBackground }]}>
                <TouchableOpacity
                    style={[styles.tabButton, mode === 'scan' && { backgroundColor: theme.background }]}
                    onPress={() => setMode('scan')}
                >
                    <Ionicons name="scan-outline" size={20} color={mode === 'scan' ? theme.primary : theme.icon} />
                    <Text style={[styles.tabText, { color: mode === 'scan' ? theme.primary : theme.icon }]}>Scan QR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, mode === 'code' && { backgroundColor: theme.background }]}
                    onPress={() => setMode('code')}
                >
                    <Ionicons name="qr-code-outline" size={20} color={mode === 'code' ? theme.primary : theme.icon} />
                    <Text style={[styles.tabText, { color: mode === 'code' ? theme.primary : theme.icon }]}>My Code</Text>
                </TouchableOpacity>
            </View>

            {/* Content Area */}
            <View style={styles.content}>

                {mode === 'scan' && (
                    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.fullScreen}>
                        <View style={styles.cameraContainer}>
                            <CameraView
                                style={styles.camera}
                                facing="back"
                                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                                barcodeScannerSettings={{
                                    barcodeTypes: ["qr"],
                                }}
                            >
                                {/* Overlay to create the "Square" look */}
                                <View style={styles.overlayLayer}>
                                    <View style={styles.overlayTop} />
                                    <View style={styles.overlayMiddle}>
                                        <View style={styles.overlaySide} />
                                        <View style={styles.scanFrame}>
                                            <View style={[styles.corner, styles.tl, { borderColor: theme.primary }]} />
                                            <View style={[styles.corner, styles.tr, { borderColor: theme.primary }]} />
                                            <View style={[styles.corner, styles.bl, { borderColor: theme.primary }]} />
                                            <View style={[styles.corner, styles.br, { borderColor: theme.primary }]} />
                                        </View>
                                        <View style={styles.overlaySide} />
                                    </View>
                                    <View style={styles.overlayBottom} >
                                        <Text style={styles.scanHint}>Align QR code within the frame</Text>
                                    </View>
                                </View>
                            </CameraView>
                        </View>
                    </Animated.View>
                )}

                {mode === 'code' && (
                    <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={styles.codeContainer}>
                        <LinearGradient
                            colors={['#1a1a1a', '#2a2a2a']}
                            style={[styles.card, { shadowColor: theme.primary }]}
                        >
                            <View style={styles.cardHeader}>
                                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                                    <Text style={styles.avatarText}>{user?.username?.[0]?.toUpperCase() || 'U'}</Text>
                                </View>
                                <View>
                                    <Text style={styles.memberName}>{user?.username || 'Guest'}</Text>
                                    <Text style={styles.memberRank}>{user?.rank || 'Member'}</Text>
                                </View>
                            </View>

                            <View style={[styles.qrWrapper, { backgroundColor: '#FFF' }]}>
                                {loadingToken ? (
                                    <View style={{ width: 200, height: 200, justifyContent: 'center', alignItems: 'center' }}>
                                        <ActivityIndicator size="large" color={theme.primary} />
                                    </View>
                                ) : qrToken ? (
                                    <QRCode
                                        value={qrToken}
                                        size={200}
                                        color="black"
                                        backgroundColor="white"
                                    />
                                ) : (
                                    <View style={{ width: 200, height: 200, justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ color: theme.text }}>Failed to load</Text>
                                        <TouchableOpacity onPress={generateQRToken} style={{ marginTop: 10 }}>
                                            <Text style={{ color: theme.primary }}>Retry</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <Text style={styles.codeHint}>Show this to the merchant to collect points</Text>
                            <Text style={[styles.codeHint, { fontSize: 10, marginTop: 8, opacity: 0.6 }]}>
                                Code refreshes automatically
                            </Text>
                        </LinearGradient>
                    </Animated.View>
                )}

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 50,
    },
    header: {
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 24,
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    tabText: {
        fontWeight: '600',
        fontSize: 14,
    },
    content: {
        flex: 1,
        overflow: 'hidden',
    },
    message: {
        textAlign: 'center',
        fontSize: 16,
        marginBottom: 20,
    },
    permButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    permButtonText: {
        fontWeight: '600',
    },
    fullScreen: {
        flex: 1,
    },
    cameraContainer: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 24, // Rounded corners for valid "modal" feel
        marginHorizontal: 0,
        marginBottom: 0,
    },
    camera: {
        flex: 1,
    },
    overlayLayer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    overlayTop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    overlayMiddle: {
        height: SCAN_SIZE,
        flexDirection: 'row',
    },
    overlaySide: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    scanFrame: {
        width: SCAN_SIZE,
        height: SCAN_SIZE,
        backgroundColor: 'transparent',
    },
    overlayBottom: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        paddingTop: 40,
    },
    corner: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderWidth: 4,
        borderColor: 'white',
    },
    tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
    br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
    scanHint: {
        color: '#FFF',
        fontSize: 14,
        opacity: 0.8,
    },
    // Code Mode
    codeContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 50,
    },
    card: {
        width: width * 0.85,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginBottom: 24,
        gap: 12,
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 20,
    },
    memberName: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
    memberRank: {
        color: '#888',
        fontSize: 14,
    },
    qrWrapper: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
    },
    codeHint: {
        color: '#AAA',
        fontSize: 12,
        textAlign: 'center',
    }
});
