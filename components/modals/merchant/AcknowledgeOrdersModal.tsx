import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BaseModal } from '@/components/ui/BaseModal';
import { Colors, Fonts, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AcknowledgeOrdersModalProps {
    visible: boolean;
    orders: any[];
    onAcknowledgeAll: () => void;
    onClose: () => void;
}

export function AcknowledgeOrdersModal({
    visible,
    orders,
    onAcknowledgeAll,
    onClose,
}: AcknowledgeOrdersModalProps) {
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const formatTime = (iso: string) => {
        try {
            return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    const handleOpen = (order: any) => {
        // Stop alarm and route to bucket view filtered to confirmed (where this order now lives)
        onAcknowledgeAll();
        router.push({ pathname: '/merchant/orders-list', params: { bucket: 'confirmed', date: 'today' } });
    };

    return (
        <BaseModal visible={visible} onClose={onClose} title="🔔 New Orders" scrollable={false}>
            <View style={styles.container}>
                <Text style={[styles.subheader, { color: theme.icon }]}>
                    {orders.length} new {orders.length === 1 ? 'order' : 'orders'} arrived. Tap below to acknowledge and stop the alarm.
                </Text>

                <FlatList
                    data={orders}
                    keyExtractor={(o) => o.id.toString()}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                            onPress={() => handleOpen(item)}
                            activeOpacity={0.85}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.orderNumber, { color: theme.text }]}>
                                    #{item.order_number}
                                </Text>
                                <Text style={[styles.subText, { color: theme.icon }]}>
                                    {item.items?.length || 0} item{(item.items?.length || 0) !== 1 ? 's' : ''} · {item.order_type === 'pickup' ? 'Pickup' : `Table ${item.table_number || '-'}`} · {formatTime(item.created_at)}
                                </Text>
                                <Text style={[styles.totalText, { color: theme.text }]}>
                                    RM {(item.total || 0).toFixed(2)}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.icon} />
                        </TouchableOpacity>
                    )}
                />

                <TouchableOpacity
                    style={[styles.ackButton, { backgroundColor: theme.primary }]}
                    onPress={onAcknowledgeAll}
                    activeOpacity={0.85}
                >
                    <Ionicons name="checkmark-done" size={22} color={theme.secondary} />
                    <Text style={[styles.ackButtonText, { color: theme.secondary }]}>
                        Acknowledge & Stop Alarm
                    </Text>
                </TouchableOpacity>
            </View>
        </BaseModal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingBottom: 24,
        gap: 12,
    },
    subheader: {
        fontSize: 13,
        fontFamily: Fonts.medium,
        marginBottom: 4,
    },
    list: {
        gap: 10,
        paddingBottom: 8,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 14,
        borderRadius: Layout.radius.md,
        borderWidth: 1,
    },
    orderNumber: {
        fontSize: 15,
        fontFamily: Fonts.bold,
    },
    subText: {
        fontSize: 12,
        fontFamily: Fonts.medium,
        marginTop: 4,
    },
    totalText: {
        fontSize: 14,
        fontFamily: Fonts.bold,
        marginTop: 6,
    },
    ackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: Layout.radius.md,
        marginTop: 4,
    },
    ackButtonText: {
        fontSize: 16,
        fontFamily: Fonts.bold,
    },
});
