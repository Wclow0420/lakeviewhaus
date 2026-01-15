import { BaseModal } from '@/components/ui/BaseModal';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

interface Transaction {
    id: number;
    amount_spent: number;
    points_earned: number;
    transaction_type: string;
    date: string;
    branch_name: string;
}

interface TransactionHistoryModalProps {
    visible: boolean;
    onClose: () => void;
}

export const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({ visible, onClose }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            fetchHistory();
        }
    }, [visible]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await api.transactions.getHistory();
            setTransactions(data);
        } catch (e) {
            console.error("Failed to fetch history", e);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const renderItem = ({ item }: { item: Transaction }) => (
        <View style={[styles.item, { borderBottomColor: theme.border }]}>
            <View style={styles.left}>
                <Text style={[styles.branchName, { color: theme.text }]}>{item.branch_name}</Text>
                <Text style={[styles.date, { color: theme.icon }]}>{formatDate(item.date)}</Text>
            </View>
            <View style={styles.right}>
                <Text style={[styles.amount, { color: theme.text }]}>RM {item.amount_spent.toFixed(2)}</Text>
                <Text style={[styles.points, { color: theme.primary }]}>+{item.points_earned.toFixed(0)} pts</Text>
            </View>
        </View>
    );

    return (
        <BaseModal visible={visible} onClose={onClose} title="Order History" scrollable={false}>
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={transactions}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={[styles.emptyText, { color: theme.icon }]}>No transactions found.</Text>
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
    },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 0.5,
    },
    left: {
        gap: 4,
    },
    right: {
        alignItems: 'flex-end',
        gap: 4,
    },
    branchName: {
        fontSize: 16,
        fontWeight: '600',
    },
    date: {
        fontSize: 12,
    },
    amount: {
        fontSize: 16,
        fontWeight: '700',
    },
    points: {
        fontSize: 12,
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 20,
    }
});
