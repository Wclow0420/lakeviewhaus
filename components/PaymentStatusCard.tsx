import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';

interface PaymentStatusCardProps {
    payment: {
        id: number;
        amount_rm: number;
        description: string;
        status: 'pending' | 'paid' | 'failed' | 'cancelled';
        created_at: string;
        paid_at?: string;
        billplz_bill_id: string;
        environment?: string;
    };
    onPress?: () => void;
}

export const PaymentStatusCard: React.FC<PaymentStatusCardProps> = ({ payment, onPress }) => {
    const getStatusColor = () => {
        switch (payment.status) {
            case 'paid':
                return '#4CAF50';
            case 'pending':
                return '#FCD259';
            case 'failed':
                return '#FF5252';
            case 'cancelled':
                return '#999';
            default:
                return '#666';
        }
    };

    const getStatusIcon = () => {
        switch (payment.status) {
            case 'paid':
                return 'checkmark-circle';
            case 'pending':
                return 'time';
            case 'failed':
                return 'close-circle';
            case 'cancelled':
                return 'ban';
            default:
                return 'help-circle';
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-MY', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View style={styles.header}>
                <View style={styles.amountContainer}>
                    <Text style={styles.currency}>RM</Text>
                    <Text style={styles.amount}>{payment.amount_rm.toFixed(2)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
                    <Ionicons
                        name={getStatusIcon() as any}
                        size={14}
                        color="#FFFFFF"
                        style={styles.statusIcon}
                    />
                    <Text style={styles.statusText}>{payment.status.toUpperCase()}</Text>
                </View>
            </View>

            <Text style={styles.description}>{payment.description}</Text>

            <View style={styles.footer}>
                <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={14} color="#999" />
                    <Text style={styles.infoText}>
                        {formatDate(payment.paid_at || payment.created_at)}
                    </Text>
                </View>
                {payment.environment === 'sandbox' && (
                    <View style={styles.sandboxBadge}>
                        <Text style={styles.sandboxText}>SANDBOX</Text>
                    </View>
                )}
            </View>

            <Text style={styles.billId} numberOfLines={1}>
                Bill ID: {payment.billplz_bill_id}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#2A2A2A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#3A3A3A',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    currency: {
        fontSize: 14,
        fontFamily: Fonts.semibold,
        color: '#FCD259',
        marginRight: 4,
    },
    amount: {
        fontSize: 24,
        fontFamily: Fonts.bold,
        color: '#FFFFFF',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusIcon: {
        marginRight: 4,
    },
    statusText: {
        fontSize: 11,
        fontFamily: Fonts.bold,
        color: '#FFFFFF',
    },
    description: {
        fontSize: 14,
        color: '#CCCCCC',
        marginBottom: 12,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoText: {
        fontSize: 12,
        color: '#999',
        marginLeft: 6,
    },
    sandboxBadge: {
        backgroundColor: '#FF9800',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    sandboxText: {
        fontSize: 10,
        fontFamily: Fonts.bold,
        color: '#FFFFFF',
    },
    billId: {
        fontSize: 11,
        color: '#666',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
});
