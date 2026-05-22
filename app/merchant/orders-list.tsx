import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { socketService } from '@/services/socket';
import { OrderDetailModal } from '@/components/modals/merchant/OrderDetailModal';
import * as Haptics from 'expo-haptics';

type Bucket = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed';
type DateFilter = 'today' | 'week' | 'all';

const BUCKET_META: Record<Bucket, { title: string; nextLabel?: string; nextStatus?: string; nextIcon?: string; color: string }> = {
    pending:   { title: 'Pending Payment',                                                   color: '#E67E22' },
    confirmed: { title: 'Orders',     nextLabel: 'Start Preparing', nextStatus: 'preparing', nextIcon: 'restaurant',     color: '#3498DB' },
    preparing: { title: 'Preparing',  nextLabel: 'Mark Ready',      nextStatus: 'ready',     nextIcon: 'checkmark-done', color: '#F39C12' },
    ready:     { title: 'Ready',      nextLabel: 'Complete',        nextStatus: 'completed', nextIcon: 'flag',           color: '#16A085' },
    completed: { title: 'Completed',                                                        color: '#27AE60' },
};

const PER_PAGE = 20;

export default function MerchantOrdersListScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const params = useLocalSearchParams<{ bucket: Bucket; date?: DateFilter }>();
    const bucket = (params.bucket as Bucket) || 'confirmed';
    const dateFilter = (params.date as DateFilter) || 'today';

    const meta = BUCKET_META[bucket];

    const [orders, setOrders] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const loadPage = async (pageNum: number, mode: 'replace' | 'append' = 'replace') => {
        try {
            if (mode === 'replace' && pageNum === 1) setLoading(true);
            if (mode === 'append') setLoadingMore(true);
            const response = await api.order.merchant.getOrders({
                status: bucket,
                date: dateFilter,
                page: pageNum,
                per_page: PER_PAGE,
            });
            if (response.success) {
                setTotalPages(response.total_pages || 1);
                setPage(response.page || pageNum);
                setOrders((prev) => mode === 'append' ? [...prev, ...(response.orders || [])] : (response.orders || []));
            }
        } catch (e) {
            console.error('[merchant-list] load failed', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadPage(1, 'replace');
        }, [bucket, dateFilter])
    );

    // Real-time: splice live updates into the list
    useEffect(() => {
        const handler = (data: any) => {
            if (!data) return;
            setOrders((prev) => {
                const matches = bucket === 'pending'
                    ? data.payment_status === 'pending' && data.status === 'pending'
                    : data.status === bucket;
                const existingIdx = prev.findIndex((o) => o.id === data.id);

                if (existingIdx >= 0 && !matches) {
                    // No longer in this bucket — remove
                    const next = [...prev];
                    next.splice(existingIdx, 1);
                    return next;
                }
                if (existingIdx >= 0 && matches) {
                    // Update in place
                    const next = [...prev];
                    next[existingIdx] = data;
                    return next;
                }
                if (existingIdx < 0 && matches) {
                    // New arrival in this bucket — prepend
                    return [data, ...prev];
                }
                return prev;
            });
        };
        socketService.on('order_update', handler);
        return () => socketService.off('order_update', handler);
    }, [bucket]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadPage(1, 'replace');
    };

    const handleEndReached = () => {
        if (loadingMore || page >= totalPages) return;
        loadPage(page + 1, 'append');
    };

    const handleOrderPress = (order: any) => {
        setSelectedOrder(order);
        setModalVisible(true);
    };

    const handleAdvance = async (order: any, e: any) => {
        e.stopPropagation();
        if (!meta.nextStatus) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Optimistic UI: remove the card from the current bucket immediately
        // so it doesn't depend on the socket round-trip. The socket event
        // arrives later and is idempotent — it'll either be a no-op (already
        // removed) or correctly reconcile if the API call failed below.
        setOrders((prev) => prev.filter((o) => o.id !== order.id));

        try {
            await api.order.merchant.updateStatus(order.id, meta.nextStatus as any);
        } catch (err) {
            console.error('[merchant-list] advance failed', err);
            // Roll back by refetching from server
            loadPage(1, 'replace');
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hr ago`;
        return date.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
    };

    const renderCard = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.card }]}
            onPress={() => handleOrderPress(item)}
            activeOpacity={0.85}
        >
            <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.orderNumber, { color: theme.text }]}>#{item.order_number}</Text>
                    <View style={styles.typeRow}>
                        <Ionicons
                            name={item.order_type === 'dine_in' ? 'restaurant' : 'bag-handle'}
                            size={13}
                            color={theme.icon}
                        />
                        <Text style={[styles.typeText, { color: theme.icon }]}>
                            {item.order_type === 'dine_in' ? 'Dine In' : 'Pickup'}
                            {item.table_number ? ` · Table ${item.table_number}` : ''}
                        </Text>
                    </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: meta.color }]}>
                    <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                </View>
            </View>

            <View style={styles.itemsBlock}>
                {item.items?.slice(0, 2).map((it: any, idx: number) => (
                    <Text key={idx} style={[styles.itemText, { color: theme.text }]} numberOfLines={1}>
                        {it.quantity}× {it.product_name}
                    </Text>
                ))}
                {item.items?.length > 2 && (
                    <Text style={[styles.moreText, { color: theme.icon }]}>+{item.items.length - 2} more</Text>
                )}
            </View>

            {item.user && (
                <View style={styles.customerRow}>
                    <Ionicons name="person-outline" size={13} color={theme.icon} />
                    <Text style={[styles.customerText, { color: theme.icon }]} numberOfLines={1}>
                        {item.user.username || item.user.email}
                    </Text>
                </View>
            )}

            <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.timeText, { color: theme.icon }]}>{formatTime(item.created_at)}</Text>
                    <Text style={[styles.totalText, { color: theme.text }]}>RM {item.total.toFixed(2)}</Text>
                </View>
                {meta.nextStatus && (
                    <TouchableOpacity
                        style={[styles.advanceBtn, { backgroundColor: theme.primary }]}
                        onPress={(e) => handleAdvance(item, e)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name={meta.nextIcon as any} size={15} color={theme.secondary} />
                        <Text style={[styles.advanceBtnText, { color: theme.secondary }]}>{meta.nextLabel}</Text>
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={56} color={theme.icon} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No {bucket} orders</Text>
            <Text style={[styles.emptySubtitle, { color: theme.icon }]}>
                {dateFilter === 'today' ? 'Quiet so far today.' : 'Nothing matches this filter.'}
            </Text>
        </View>
    );

    const renderFooter = () =>
        loadingMore ? (
            <View style={styles.footerLoader}>
                <ActivityIndicator color={theme.primary} />
            </View>
        ) : null;

    return (
        <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>{meta.title}</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.icon }]}>
                        {orders.length} {orders.length === 1 ? 'order' : 'orders'}
                        {totalPages > 1 ? ` · page ${page} / ${totalPages}` : ''}
                    </Text>
                </View>
            </View>

            {loading && page === 1 && orders.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderCard}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
                    }
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.4}
                    ListEmptyComponent={renderEmpty}
                    ListFooterComponent={renderFooter}
                />
            )}

            <OrderDetailModal
                visible={modalVisible}
                onClose={() => { setModalVisible(false); setSelectedOrder(null); }}
                order={selectedOrder}
                onOrderUpdated={() => { /* socket will splice — no manual refetch needed */ }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        gap: 4,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontFamily: Fonts.bold, letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 2 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: { padding: 16 },
    card: {
        borderRadius: Layout.radius.md,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
        gap: 12,
    },
    orderNumber: { fontSize: 17, fontFamily: Fonts.bold, marginBottom: 4 },
    typeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    typeText: { fontSize: 12, fontFamily: Fonts.medium },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    statusText: { fontSize: 10, fontFamily: Fonts.bold, color: '#FFFFFF', letterSpacing: 0.4 },
    itemsBlock: { marginBottom: 8, gap: 3 },
    itemText: { fontSize: 13, fontFamily: Fonts.medium },
    moreText: { fontSize: 12, fontFamily: Fonts.regular, fontStyle: 'italic' },
    customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    customerText: { fontSize: 12, fontFamily: Fonts.regular },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: 1,
    },
    timeText: { fontSize: 11, fontFamily: Fonts.regular },
    totalText: { fontSize: 16, fontFamily: Fonts.bold, marginTop: 2 },
    advanceBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 18,
    },
    advanceBtnText: { fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 0.2 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 6 },
    emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, marginTop: 12 },
    emptySubtitle: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', paddingHorizontal: 40 },
    footerLoader: { paddingVertical: 20, alignItems: 'center' },
});
