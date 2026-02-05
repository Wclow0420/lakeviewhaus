import { BaseModal } from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';

interface AwardPointsModalProps {
    visible: boolean;
    onClose: () => void;
    qrToken: string;
    username: string;
    rank: string;
    onSuccess: () => void;
}

export const AwardPointsModal: React.FC<AwardPointsModalProps> = ({
    visible,
    onClose,
    qrToken,
    username,
    rank,
    onSuccess
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);

    const handleKeyPress = (key: string) => {
        // Light haptic feedback for each key press
        if (key === 'DEL') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAmount(prev => prev.slice(0, -1));
        } else if (key === '.') {
            if (!amount.includes('.')) {
                Haptics.selectionAsync();
                setAmount(prev => prev + '.');
            }
        } else {
            // Prevent leading zeros unless 0.
            if (amount === '0' && key !== '.') {
                Haptics.selectionAsync();
                setAmount(key);
            } else if (amount.includes('.') && amount.split('.')[1].length >= 2) {
                return; // Limit 2 decimal
            } else {
                Haptics.selectionAsync();
                setAmount(prev => prev + key);
            }
        }
    };

    const handleAward = async () => {
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert('Invalid Amount', 'Please enter a valid positive amount.');
            return;
        }

        setLoading(true);
        try {
            const res = await api.merchant.awardPoints(qrToken, parseFloat(amount));

            // Success haptic feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            Alert.alert('Success', `Awarded ${parseFloat(res.points_earned).toFixed(2)} points to ${res.user_name}`, [
                {
                    text: 'OK', onPress: () => {
                        setAmount('');
                        onSuccess();
                    }
                }
            ]);
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.error || 'Failed to award points');
        } finally {
            setLoading(false);
        }
    };

    const renderKey = (key: string) => {
        return (
            <TouchableOpacity
                style={[styles.keyButton, { backgroundColor: theme.card }]}
                onPress={() => handleKeyPress(key)}
            >
                {key === 'DEL' ? (
                    <Ionicons name="backspace-outline" size={28} color={theme.text} />
                ) : (
                    <Text style={[styles.keyText, { color: theme.text }]}>{key}</Text>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title="Enter Amount"
            scrollable={false}
        >
            {/* Display */}
            <View style={styles.displayContainer}>
                <View style={{ alignSelf: 'flex-end', marginBottom: 0 }}>
                    <Text style={{ color: theme.icon, fontSize: 14, marginBottom: 0, textAlign: 'right' }}>Member</Text>
                    <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700', textAlign: 'right' }}>{username}</Text>
                </View>
                <Text style={[styles.amountText, { color: theme.text }]}>
                    ${amount ? parseFloat(amount).toFixed(2) : '0.00'}
                </Text>
            </View>

            {/* Keypad */}
            <View style={styles.keypadContainer}>
                <View style={styles.keyRow}>
                    {renderKey('1')}
                    {renderKey('2')}
                    {renderKey('3')}
                </View>
                <View style={styles.keyRow}>
                    {renderKey('4')}
                    {renderKey('5')}
                    {renderKey('6')}
                </View>
                <View style={styles.keyRow}>
                    {renderKey('7')}
                    {renderKey('8')}
                    {renderKey('9')}
                </View>
                <View style={styles.keyRow}>
                    {renderKey('.')}
                    {renderKey('0')}
                    {renderKey('DEL')}
                </View>
            </View>

            {/* Confirm Button */}
            <View style={styles.footer}>
                <Button
                    title="Confirm Amount"
                    onPress={handleAward}
                    loading={loading}
                    style={{ height: 56, borderRadius: 28 }}
                    textStyle={{ fontSize: 18, fontWeight: 'bold' }}
                    disabled={!amount || parseFloat(amount) <= 0}
                />
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    displayContainer: {
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        paddingHorizontal: 24,
        paddingTop: -10,
        paddingBottom: 0,
        minHeight: 100,
    },
    amountText: {
        fontSize: 48,
        fontWeight: '300',
    },
    keypadContainer: {
        paddingHorizontal: 30,
        paddingBottom: 12,
        gap: 5,
    },
    keyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 15,
    },
    keyButton: {
        flex: 1,
        aspectRatio: 1,
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#eee',
    },
    keyText: {
        fontSize: 28,
        fontWeight: '400',
    },
    footer: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    }
});
