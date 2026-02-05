import { BaseModal } from '@/components/ui/BaseModal';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface RewardQRModalProps {
    visible: boolean;
    onClose: () => void;
    rewardTitle: string;
    redemptionCode: string;
    expiresAt: string;
    rewardDescription?: string;
    status: 'active' | 'used' | 'expired' | 'cancelled';
}

export const RewardQRModal: React.FC<RewardQRModalProps> = ({
    visible,
    onClose,
    rewardTitle,
    redemptionCode,
    expiresAt,
    rewardDescription,
    status
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title="Reward QR Code"
            scrollable={false}
        >
            <View style={styles.container}>
                {/* Reward Info */}
                <View style={styles.infoSection}>
                    <Text style={[styles.rewardTitle, { color: theme.text }]}>
                        {rewardTitle}
                    </Text>
                    {rewardDescription && (
                        <Text style={[styles.rewardDescription, { color: theme.icon }]}>
                            {rewardDescription}
                        </Text>
                    )}
                </View>

                {/* QR Code with Redeemed Overlay */}
                <View style={[styles.qrContainer, { backgroundColor: '#fff' }]}>
                    <View style={{ opacity: status === 'used' ? 0.15 : 1 }}>
                        <QRCode
                            value={redemptionCode}
                            size={220}
                            backgroundColor="#ffffff"
                            color="#000000"
                        />
                    </View>

                    {status === 'used' && (
                        <View style={styles.overlayContainer} pointerEvents="none">
                            <View style={styles.watermarkContainer}>
                                <Text style={styles.watermarkText}>REDEEMED</Text>
                            </View>
                            <LottieView
                                source={require('../../../assets/lottie/Checkmark.json')}
                                autoPlay
                                loop={false}
                                style={{ width: 140, height: 140 }}
                            />
                        </View>
                    )}
                </View>

                {/* Redemption Code */}
                <View style={styles.codeSection}>
                    <Text style={[styles.codeLabel, { color: theme.icon }]}>Redemption Code</Text>
                    <Text style={[styles.codeValue, { color: theme.text }]}>
                        {redemptionCode}
                    </Text>
                </View>

                {/* Expiry Info */}
                <View style={[styles.expirySection, { backgroundColor: theme.card }]}>
                    <Ionicons name="time-outline" size={20} color={theme.icon} />
                    <View style={styles.expiryText}>
                        <Text style={[styles.expiryLabel, { color: theme.icon }]}>Expires on</Text>
                        <Text style={[styles.expiryDate, { color: theme.text }]}>
                            {formatDate(expiresAt)}
                        </Text>
                    </View>
                </View>

                {/* Instructions */}
                <View style={[styles.instructions, { backgroundColor: theme.card }]}>
                    <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
                    <Text style={[styles.instructionsText, { color: theme.icon }]}>
                        Show this QR code to the merchant staff at the counter to redeem your reward
                    </Text>
                </View>
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: Platform.OS === 'android' ? 16 : 20,
        alignItems: 'center',
    },
    infoSection: {
        width: '100%',
        marginBottom: Platform.OS === 'android' ? 16 : 24,
        alignItems: 'center',
    },
    rewardTitle: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    rewardDescription: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    qrContainer: {
        padding: Platform.OS === 'android' ? 16 : 24,
        borderRadius: 20,
        marginBottom: Platform.OS === 'android' ? 16 : 24,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        minHeight: 268,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    overlayContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    watermarkContainer: {
        position: 'absolute',
        transform: [{ rotate: '-15deg' }],
        borderWidth: 4,
        borderColor: '#4CAF50',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        opacity: 0.8,
    },
    watermarkText: {
        fontSize: 32,
        fontWeight: '900',
        color: '#4CAF50',
        letterSpacing: 4,
    },
    codeSection: {
        alignItems: 'center',
        marginBottom: Platform.OS === 'android' ? 16 : 24,
    },
    codeLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    codeValue: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 4,
    },
    expirySection: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        padding: 16,
        borderRadius: 12,
        marginBottom: Platform.OS === 'android' ? 12 : 16,
        gap: 12,
    },
    expiryText: {
        flex: 1,
    },
    expiryLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 2,
    },
    expiryDate: {
        fontSize: 14,
        fontWeight: '700',
    },
    instructions: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        gap: 12,
        width: '100%',
    },
    instructionsText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
});
