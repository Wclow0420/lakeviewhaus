import { BaseModal } from '@/components/ui/BaseModal';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

interface PointsEntry {
    key: string;
    source: 'order' | 'transaction';
    label: string;       // e.g. "Order #LVH240422001" or branch name
    sublabel?: string;   // secondary line, e.g. branch name or transaction type
    amount?: number;     // RM spent (optional)
    points: number;      // points credited
    date: string;        // ISO date for sorting + display
}

interface PointsHistoryModalProps {
    visible: boolean;
    onClose: () => void;
}

export const PointsHistoryModal: React.FC<PointsHistoryModalProps> = ({ visible, onClose }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const [entries, setEntries] = useState<PointsEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) fetchHistory();
    }, [visible]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            // Pull both sources in parallel. Each may fail independently — we still
            // want to show whatever did come back.
            const [transactionsResp, ordersResp] = await Promise.allSettled([
                api.transactions.getHistory(),
                api.order.getHistory({ per_page: 100 }),
            ]);

            const merged: PointsEntry[] = [];

            // Legacy points transactions (manual awards from merchants)
            if (transactionsResp.status === 'fulfilled' && Array.isArray(transactionsResp.value)) {
                for (const t of transactionsResp.value) {
                    if (!t.points_earned || t.points_earned <= 0) continue;
                    merged.push({
                        key: `t-${t.id}`,
                        source: 'transaction',
                        label: t.branch_name || 'Transaction',
                        sublabel: t.transaction_type ? `via ${t.transaction_type}` : undefined,
                        amount: t.amount_spent,
                        points: t.points_earned,
                        date: t.date,
                    });
                }
            }

            // Food orders that earned points (only paid orders contribute points)
            if (ordersResp.status === 'fulfilled' && ordersResp.value?.success) {
                for (const o of ordersResp.value.orders ?? []) {
                    if (o.payment_status !== 'paid') continue;
                    if (!o.points_earned || o.points_earned <= 0) continue;
                    merged.push({
                        key: `o-${o.id}`,
                        source: 'order',
                        label: `Order #${o.order_number}`,
                        sublabel: o.branch?.name,
                        amount: o.total,
                        points: o.points_earned,
                        date: o.created_at,
                    });
                }
            }

            // Newest first
            merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setEntries(merged);
        } catch (e) {
            console.error('Failed to fetch points history', e);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('en-MY', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });

    const renderItem = ({ item }: { item: PointsEntry }) => (
        <View style={[styles.item, { borderBottomColor: theme.border }]}>
            <View style={[styles.iconBubble, { backgroundColor: `${theme.primary}30` }]}>
                <Ionicons
                    name={item.source === 'order' ? 'receipt-outline' : 'star-outline'}
                    size={18}
                    color={theme.secondary}
                />
            </View>
            <View style={styles.middle}>
                <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
                    {item.label}
                </Text>
                {item.sublabel ? (
                    <Text style={[styles.sublabel, { color: theme.icon }]} numberOfLines={1}>
                        {item.sublabel}
                    </Text>
                ) : null}
                <Text style={[styles.date, { color: theme.icon }]}>{formatDate(item.date)}</Text>
            </View>
            <View style={styles.right}>
                {item.amount != null && item.amount > 0 ? (
                    <Text style={[styles.amount, { color: theme.text }]}>
                        RM {item.amount.toFixed(2)}
                    </Text>
                ) : null}
                <Text style={[styles.points, { color: theme.success }]}>+{item.points} pts</Text>
            </View>
        </View>
    );

    return (
        <BaseModal visible={visible} onClose={onClose} title="Points History" scrollable={false}>
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={entries}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.key}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Ionicons name="star-outline" size={48} color={theme.icon} />
                            <Text style={[styles.emptyTitle, { color: theme.text }]}>No points yet</Text>
                            <Text style={[styles.emptyText, { color: theme.icon }]}>
                                Place an order or check in daily to start earning.
                            </Text>
                        </View>
                    }
                />
            )}
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    center: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        gap: 12,
    },
    iconBubble: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    middle: {
        flex: 1,
        gap: 2,
    },
    right: {
        alignItems: 'flex-end',
        gap: 2,
    },
    label: {
        fontSize: 15,
        fontFamily: Fonts.semibold,
    },
    sublabel: {
        fontSize: 12,
        fontFamily: Fonts.regular,
    },
    date: {
        fontSize: 11,
        fontFamily: Fonts.regular,
    },
    amount: {
        fontSize: 14,
        fontFamily: Fonts.semibold,
    },
    points: {
        fontSize: 13,
        fontFamily: Fonts.bold,
    },
    emptyTitle: {
        fontSize: 16,
        fontFamily: Fonts.bold,
        marginTop: 12,
    },
    emptyText: {
        fontSize: 13,
        fontFamily: Fonts.regular,
        textAlign: 'center',
        marginTop: 4,
    },
});
