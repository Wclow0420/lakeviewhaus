import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Pill } from '@/components/ui/Pill';
import { api } from '@/services/api';
import { socketService } from '@/services/socket';
import * as Haptics from 'expo-haptics';

type DateFilter = 'today' | 'week' | 'all';
type Bucket = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed';

interface Counts {
    pending: number;
    confirmed: number;
    preparing: number;
    ready: number;
    completed: number;
    cancelled: number;
}

const ZERO: Counts = { pending: 0, confirmed: 0, preparing: 0, ready: 0, completed: 0, cancelled: 0 };

const CARDS: Array<{
    bucket: Bucket;
    title: string;
    sub: string;
    icon: keyof typeof Ionicons.glyphMap;
    accent: string;
}> = [
    { bucket: 'confirmed', title: 'Orders', sub: 'awaiting kitchen', icon: 'receipt-outline', accent: '#3498DB' },
    { bucket: 'preparing', title: 'Preparing', sub: 'being made', icon: 'restaurant', accent: '#F39C12' },
    { bucket: 'ready', title: 'Ready', sub: 'for pickup / serving', icon: 'checkmark-done-circle', accent: '#16A085' },
    { bucket: 'completed', title: 'Completed', sub: 'today', icon: 'flag', accent: '#27AE60' },
];

export default function MerchantOrdersDashboard() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [counts, setCounts] = useState<Counts>(ZERO);
    const [dateFilter, setDateFilter] = useState<DateFilter>('today');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadCounts = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const response = await api.order.merchant.getCounts({ date: dateFilter });
            if (response.success) setCounts(response.counts || ZERO);
        } catch (e) {
            console.error('[merchant-dashboard] failed to load counts', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Refresh counts on focus + when date filter changes
    useFocusEffect(
        useCallback(() => {
            loadCounts();
        }, [dateFilter])
    );

    // Real-time: any order_update → debounced refetch (one query, cheap)
    useEffect(() => {
        const handler = () => {
            if (refetchTimer.current) clearTimeout(refetchTimer.current);
            refetchTimer.current = setTimeout(() => loadCounts(true), 400);
        };
        socketService.on('order_update', handler);
        return () => {
            socketService.off('order_update', handler);
            if (refetchTimer.current) clearTimeout(refetchTimer.current);
        };
    }, [dateFilter]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadCounts(true);
    };

    const openBucket = (bucket: Bucket) => {
        Haptics.selectionAsync();
        router.push({ pathname: '/merchant/orders-list', params: { bucket, date: dateFilter } });
    };

    const handleDateFilterChange = (date: DateFilter) => {
        Haptics.selectionAsync();
        setDateFilter(date);
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Order Dashboard</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.icon }]}>
                        {dateFilter === 'today' ? "Today's orders" : dateFilter === 'week' ? 'Past 7 days' : 'All time'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.refreshBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={handleRefresh}
                    activeOpacity={0.7}
                >
                    <Ionicons name="refresh" size={18} color={theme.text} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
                }
            >
                {/* Date filter pills */}
                <View style={styles.dateFilters}>
                    {(['today', 'week', 'all'] as DateFilter[]).map((d) => (
                        <Pill
                            key={d}
                            label={d === 'today' ? 'Today' : d === 'week' ? 'This Week' : 'All Time'}
                            selected={dateFilter === d}
                            onPress={() => handleDateFilterChange(d)}
                            style={styles.datePill}
                        />
                    ))}
                </View>

                {/* Pending Payment button */}
                <TouchableOpacity
                    style={[styles.pendingBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => openBucket('pending')}
                    activeOpacity={0.85}
                >
                    <View style={[styles.pendingIconBubble, { backgroundColor: '#FFF3E0' }]}>
                        <Ionicons name="time-outline" size={20} color="#E65100" />
                    </View>
                    <View style={styles.pendingTextCol}>
                        <Text style={[styles.pendingTitle, { color: theme.text }]}>Pending Payment</Text>
                        <Text style={[styles.pendingSub, { color: theme.icon }]}>
                            {counts.pending === 0 ? 'No customers in checkout' : `${counts.pending} awaiting payment`}
                        </Text>
                    </View>
                    {counts.pending > 0 && (
                        <View style={[styles.pendingBadge, { backgroundColor: '#E65100' }]}>
                            <Text style={styles.pendingBadgeText}>{counts.pending}</Text>
                        </View>
                    )}
                    <Ionicons name="chevron-forward" size={20} color={theme.icon} style={{ marginLeft: 4 }} />
                </TouchableOpacity>

                {/* 4 big cards in 2x2 grid */}
                <View style={styles.grid}>
                    {CARDS.map((card) => {
                        const count = counts[card.bucket];
                        return (
                            <TouchableOpacity
                                key={card.bucket}
                                style={[
                                    styles.bigCard,
                                    {
                                        backgroundColor: theme.card,
                                        borderColor: count > 0 ? card.accent : theme.border,
                                    },
                                ]}
                                onPress={() => openBucket(card.bucket)}
                                activeOpacity={0.85}
                            >
                                <View style={[styles.iconBubble, { backgroundColor: `${card.accent}15` }]}>
                                    <Ionicons name={card.icon} size={22} color={card.accent} />
                                </View>
                                <Text style={[styles.cardCount, { color: theme.text }]}>{count}</Text>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>{card.title}</Text>
                                <Text style={[styles.cardSub, { color: theme.icon }]} numberOfLines={1}>
                                    {card.sub}
                                </Text>
                                {count > 0 && (
                                    <View style={[styles.cardCta, { backgroundColor: card.accent }]}>
                                        <Text style={styles.cardCtaText}>View →</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {loading && counts === ZERO && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator color={theme.primary} />
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 22, fontFamily: Fonts.bold, letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 13, fontFamily: Fonts.medium, marginTop: 2 },
    refreshBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: { paddingHorizontal: 16, paddingTop: 12 },
    dateFilters: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    datePill: { marginRight: 0 },
    pendingBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: Layout.radius.md,
        borderWidth: 1,
        marginBottom: 16,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    pendingIconBubble: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pendingTextCol: { flex: 1 },
    pendingTitle: { fontSize: 15, fontFamily: Fonts.bold },
    pendingSub: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 2 },
    pendingBadge: {
        minWidth: 28,
        height: 28,
        borderRadius: 14,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pendingBadgeText: { fontSize: 13, fontFamily: Fonts.bold, color: '#FFFFFF' },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    bigCard: {
        width: '48%',
        flexGrow: 1,
        borderRadius: Layout.radius.md,
        padding: 16,
        borderWidth: 1,
        gap: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        minHeight: 150,
    },
    iconBubble: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    cardCount: { fontSize: 32, fontFamily: Fonts.bold, letterSpacing: -1, lineHeight: 36 },
    cardTitle: { fontSize: 15, fontFamily: Fonts.bold, marginTop: 2 },
    cardSub: { fontSize: 11, fontFamily: Fonts.medium },
    cardCta: {
        marginTop: 10,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    cardCtaText: { fontSize: 11, fontFamily: Fonts.bold, color: '#FFFFFF', letterSpacing: 0.3 },
    loadingOverlay: { paddingVertical: 40, alignItems: 'center' },
});
