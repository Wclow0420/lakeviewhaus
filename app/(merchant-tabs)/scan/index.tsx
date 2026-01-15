import { AwardPointsModal } from '@/components/modals/merchant/AwardPointsModal';
import { RewardValidationModal } from '@/components/modals/merchant/RewardValidationModal';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useState } from 'react';
import { Alert, ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function MerchantScanScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [rewardModalVisible, setRewardModalVisible] = useState(false);
    const [validating, setValidating] = useState(false);

    // For user QR codes (awarding points)
    const [qrToken, setQrToken] = useState('');
    const [username, setUsername] = useState('');
    const [rank, setRank] = useState('');

    // For reward QR codes (validation)
    const [rewardData, setRewardData] = useState<any>(null);

    if (!permission) {
        return <View style={{ flex: 1, backgroundColor: theme.background }} />;
    }

    if (!permission.granted) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center' }]}>
                <Text style={{ textAlign: 'center', marginBottom: 20, color: theme.text, paddingHorizontal: 20 }}>
                    We need your permission to access the camera for scanning.
                </Text>
                <Button title="Grant Permission" onPress={requestPermission} />
            </View>
        );
    }

    const handleBarCodeScanned = async ({ type, data }: any) => {
        if (scanned || validating) return;
        setScanned(true);
        setValidating(true);

        try {
            // Check if it's a reward redemption code (8 uppercase alphanumeric characters)
            const isRewardCode = /^[A-Z0-9]{8}$/.test(data);

            if (isRewardCode) {
                // Handle reward redemption code
                const response = await api.rewards.previewRedemption(data);
                setRewardData(response);
                setRewardModalVisible(true);
            } else {
                // Handle user QR token (for awarding points)
                const response = await api.validateQR(data);

                if (response.valid) {
                    // Store validated data (username only, no user ID exposed)
                    setQrToken(response.qr_token);
                    setUsername(response.username);
                    setRank(response.rank);
                    setModalVisible(true);
                }
            }
        } catch (error: any) {
            console.error('QR Validation Error:', error);
            Alert.alert(
                'Invalid QR Code',
                error.error || 'This QR code is not valid.',
                [{ text: 'OK', onPress: () => setScanned(false) }]
            );
        } finally {
            setValidating(false);
        }
    };

    const handleClose = () => {
        setModalVisible(false);
        setScanned(false);
        setQrToken('');
        setUsername('');
        setRank('');
    };

    const handleSuccess = () => {
        handleClose();
        // Maybe navigate away or just stay ready for next scan
    };

    const handleCloseRewardModal = () => {
        setRewardModalVisible(false);
        setScanned(false);
        setRewardData(null);
    };

    const handleRewardValidated = () => {
        handleCloseRewardModal();
        Alert.alert('Success', 'Reward has been validated and marked as used!');
    };

    return (
        <View style={[styles.container, { backgroundColor: '#000' }]}>
            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
            />

            {/* Overlay */}
            <View style={styles.overlay}>
                <View style={[styles.scanFrame, { borderColor: validating ? '#888' : theme.primary }]} />
                <View style={{ position: 'absolute', bottom: 100, backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 8 }}>
                    {validating ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <ActivityIndicator color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Validating...</Text>
                        </View>
                    ) : (
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Scan QR Code</Text>
                    )}
                </View>
            </View>

            <AwardPointsModal
                visible={modalVisible}
                onClose={handleClose}
                qrToken={qrToken}
                username={username}
                rank={rank}
                onSuccess={handleSuccess}
            />

            {rewardModalVisible && rewardData && (
                <RewardValidationModal
                    visible={rewardModalVisible}
                    onClose={handleCloseRewardModal}
                    onSuccess={handleRewardValidated}
                    rewardData={rewardData}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    scanFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderRadius: 20,
        backgroundColor: 'transparent',
    }
});
