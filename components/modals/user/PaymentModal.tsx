import React, { useState } from 'react';
import { View, Text, TextInput, Alert, Linking, ActivityIndicator, StyleSheet } from 'react-native';
import { BaseModal } from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';
import { Fonts } from '@/constants/theme';

interface PaymentModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: (payment: any) => void;
    defaultAmount?: number;  // Amount in RM
    description?: string;
    metadata?: any;
    reference_1_label?: string;
    reference_1?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    visible,
    onClose,
    onSuccess,
    defaultAmount,
    description = 'Payment',
    metadata,
    reference_1_label,
    reference_1
}) => {
    const [amount, setAmount] = useState(defaultAmount?.toString() || '');
    const [mobile, setMobile] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePayment = async () => {
        // Validate amount
        const amountNum = parseFloat(amount);
        if (!amount || isNaN(amountNum) || amountNum <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        setLoading(true);

        try {
            // Convert RM to cents (e.g., 10.50 => 1050)
            const amountInCents = Math.round(amountNum * 100);

            // Create bill
            const response = await api.payment.createBill({
                amount: amountInCents,
                description,
                mobile: mobile || undefined,
                metadata,
                reference_1_label,
                reference_1
            });

            if (response.success && response.bill_url) {
                // Open payment URL in browser
                const canOpen = await Linking.canOpenURL(response.bill_url);
                if (canOpen) {
                    await Linking.openURL(response.bill_url);

                    // Call success callback
                    if (onSuccess) {
                        onSuccess(response.payment);
                    }

                    // Close modal
                    onClose();
                } else {
                    Alert.alert('Error', 'Unable to open payment page');
                }
            } else {
                Alert.alert('Error', 'Failed to create payment');
            }
        } catch (error: any) {
            console.error('Payment error:', error);
            Alert.alert(
                'Payment Error',
                error?.error || 'Failed to create payment. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <BaseModal visible={visible} onClose={onClose} title="Make Payment" scrollable={false}>
            <View style={styles.container}>
                <Text style={styles.label}>Amount (RM)</Text>
                <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    editable={!defaultAmount && !loading}
                    placeholderTextColor="#666"
                />

                <Text style={styles.label}>Mobile Number (Optional)</Text>
                <TextInput
                    style={styles.input}
                    value={mobile}
                    onChangeText={setMobile}
                    placeholder="+60123456789"
                    keyboardType="phone-pad"
                    editable={!loading}
                    placeholderTextColor="#666"
                />

                <Text style={styles.description}>
                    {description}
                </Text>

                <Button
                    title={loading ? 'Processing...' : 'Proceed to Payment'}
                    onPress={handlePayment}
                    disabled={loading}
                    style={styles.button}
                />

                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#FCD259" />
                        <Text style={styles.loadingText}>Creating payment...</Text>
                    </View>
                )}
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    label: {
        fontSize: 14,
        fontFamily: Fonts.semibold,
        color: '#FFFFFF',
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        backgroundColor: '#2A2A2A',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#3A3A3A',
    },
    description: {
        fontSize: 14,
        color: '#999',
        marginTop: 16,
        textAlign: 'center',
    },
    button: {
        marginTop: 24,
    },
    loadingContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },
    loadingText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#999',
    },
});
