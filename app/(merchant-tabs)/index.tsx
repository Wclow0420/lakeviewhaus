import { BaseModal } from '@/components/ui/BaseModal';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface DashboardStats {
    summary: {
        total_points_issued: number;
        total_redemptions: number;
        today_points_issued: number;
    };
    chart: {
        labels: string[];
        data: number[];
    };
}

export default function MerchantDashboard() {
    const { user } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const isMain = user?.is_main ?? false;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | 'all'>('all');

    // Details Modal State
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [detailsType, setDetailsType] = useState<'redemptions' | 'points'>('redemptions');
    const [detailsData, setDetailsData] = useState<any[]>([]);
    const [detailsLoading, setDetailsLoading] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            // 1. Fetch Branches (If Main) - Only need to do this once effectively, but ok to refetch
            if (isMain) {
                const branchData = await api.merchant.getBranches();
                setBranches(branchData);
            }

            // 2. Fetch Stats
            const statsData = await api.merchant.getStats(selectedBranchId);
            setStats(statsData);

        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', 'Failed to load dashboard data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [isMain, selectedBranchId]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleShowDetails = async (type: 'redemptions' | 'points', period: 'all' | 'today' = 'all') => {
        try {
            setDetailsLoading(true);
            setDetailsType(type);
            setDetailsModalVisible(true);
            setDetailsData([]); // Clear previous

            const data = await api.merchant.getStatDetails(type, period, selectedBranchId);
            setDetailsData(data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load details');
        } finally {
            setDetailsLoading(false);
        }
    };

    // Helper fordate formatting
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        // Ensure UTC parsing by checking/appending Z
        const utcStr = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
        const d = new Date(utcStr);

        // Manual formatting to ensure Local Time usage (toLocaleString can be flaky in RN)
        const day = d.getDate();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');

        return `${day} ${month} ${year}, ${hours}:${minutes}`;
    };

    // Chart Helper
    const renderChart = () => {
        if (!stats?.chart || stats.chart.data.length === 0) return null;

        const data = stats.chart.data;
        const labels = stats.chart.labels;
        const maxValue = Math.max(...data, 1); // Avoid div by 0

        return (
            <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Points Trend (7 Days)</Text>

                <View style={styles.chartArea}>
                    {data.map((value, index) => {
                        const heightPct = (value / maxValue) * 100;
                        return (
                            <View key={index} style={styles.barColumn}>
                                <View style={styles.barContainer}>
                                    <View
                                        style={[
                                            styles.bar,
                                            {
                                                height: `${heightPct}%`,
                                                backgroundColor: theme.primary,
                                                opacity: 0.8
                                            }
                                        ]}
                                    />
                                </View>
                                <Text style={[styles.barLabel, { color: theme.icon }]}>{labels[index]}</Text>
                                <Text style={[styles.barValue, { color: theme.text }]}>{value > 0 ? value : ''}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Dashboard</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.icon }]}>
                        {isMain ? 'Overview of all branches' : 'Branch Performance'}
                    </Text>
                </View>
            </View>

            {/* Branch Filter (Main Only) */}
            {isMain && (
                <View style={styles.filterContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                        <TouchableOpacity
                            style={[
                                styles.filterPill,
                                selectedBranchId === 'all' && { backgroundColor: theme.text },
                                selectedBranchId !== 'all' && { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }
                            ]}
                            onPress={() => setSelectedBranchId('all')}
                        >
                            <Text style={{ fontWeight: '600', color: selectedBranchId === 'all' ? theme.background : theme.text }}>
                                All Branches
                            </Text>
                        </TouchableOpacity>

                        {branches.map(b => (
                            <TouchableOpacity
                                key={b.id}
                                style={[
                                    styles.filterPill,
                                    selectedBranchId === b.id && { backgroundColor: theme.text },
                                    selectedBranchId !== b.id && { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }
                                ]}
                                onPress={() => setSelectedBranchId(b.id)}
                            >
                                <Text style={{ fontWeight: '600', color: selectedBranchId === b.id ? theme.background : theme.text }}>
                                    {b.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            >
                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {/* Points Issued */}
                    <TouchableOpacity
                        style={[styles.statCard, { backgroundColor: theme.card }]}
                        onPress={() => handleShowDetails('points', 'all')}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: theme.primary + '20' }]}>
                            <Ionicons name="star" size={24} color={theme.primary} />
                        </View>
                        <Text style={[styles.statValue, { color: theme.text }]}>
                            {stats?.summary.total_points_issued ?? 0}
                        </Text>
                        <Text style={[styles.statLabel, { color: theme.icon }]}>Total Points Issued</Text>
                        <View style={styles.tapIndicator}>
                            <Text style={{ fontSize: 10, color: theme.primary }}>Tap for details</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Redemptions */}
                    <TouchableOpacity
                        style={[styles.statCard, { backgroundColor: theme.card }]}
                        onPress={() => handleShowDetails('redemptions', 'all')}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: '#FF9F0A20' }]}>
                            <Ionicons name="gift" size={24} color="#FF9F0A" />
                        </View>
                        <Text style={[styles.statValue, { color: theme.text }]}>
                            {stats?.summary.total_redemptions ?? 0}
                        </Text>
                        <Text style={[styles.statLabel, { color: theme.icon }]}>Rewards Redeemed</Text>
                        <View style={styles.tapIndicator}>
                            <Text style={{ fontSize: 10, color: '#FF9F0A' }}>Tap for details</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Today */}
                    <TouchableOpacity
                        style={[styles.statCard, { backgroundColor: theme.card, flexBasis: '100%' }]}
                        onPress={() => handleShowDetails('points', 'today')}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={[styles.statLabel, { color: theme.icon, marginBottom: 4 }]}>Points Issued Today</Text>
                                <Text style={[styles.statValue, { color: theme.text, fontSize: 32 }]}>
                                    {stats?.summary.today_points_issued ?? 0}
                                </Text>
                                <Text style={{ fontSize: 11, color: theme.success, marginTop: 4 }}>Tap to view today's transactions</Text>
                            </View>
                            <View style={[styles.iconCircle, { backgroundColor: theme.success + '20', width: 48, height: 48 }]}>
                                <Ionicons name="trending-up" size={24} color={theme.success} />
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Chart Section */}
                {renderChart()}

            </ScrollView>

            <BaseModal
                visible={detailsModalVisible}
                onClose={() => setDetailsModalVisible(false)}
                title={detailsType === 'redemptions' ? 'Redemption History' : 'Points Transactions'}
                scrollable={false}
            >
                <View style={{ flex: 1 }}>
                    {detailsLoading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={theme.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={detailsData}
                            keyExtractor={(item) => item.id.toString()}
                            contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 20 }}
                            renderItem={({ item }) => (
                                <View style={[styles.detailItem, { borderBottomColor: theme.border }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.detailTitle, { color: theme.text }]}>
                                            {detailsType === 'redemptions' ? item.title : `${item.user_name}`}
                                        </Text>

                                        <View style={styles.detailMetaRow}>
                                            <Ionicons name="person-outline" size={12} color={theme.icon} />
                                            <Text style={[styles.detailMeta, { color: theme.icon }]}>
                                                {detailsType === 'redemptions' ? item.user_name : item.branch_name}
                                            </Text>
                                        </View>

                                        {detailsType === 'redemptions' && (
                                            <View style={styles.detailMetaRow}>
                                                <Ionicons name="pricetag-outline" size={12} color={theme.icon} />
                                                <Text style={[styles.detailMeta, { color: theme.icon }]}>
                                                    {item.type === 'free_item' ? 'Free Item' :
                                                        item.type === 'discount_percentage' ? `${item.discount_value}% OFF` :
                                                            `RM ${item.discount_value} OFF`}
                                                </Text>
                                            </View>
                                        )}

                                        <View style={styles.detailMetaRow}>
                                            <Ionicons name="time-outline" size={12} color={theme.icon} />
                                            <Text style={[styles.detailMeta, { color: theme.icon }]}>
                                                {formatDate(item.timestamp)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={{ alignItems: 'flex-end' }}>
                                        {detailsType === 'redemptions' ? (
                                            <View style={[styles.badge, { backgroundColor: theme.success + '20' }]}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.success }}>USED</Text>
                                            </View>
                                        ) : (
                                            <>
                                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.primary }}>
                                                    +{item.points} pts
                                                </Text>
                                                <Text style={{ fontSize: 12, color: theme.icon }}>
                                                    RM {item.amount}
                                                </Text>
                                            </>
                                        )}
                                        <Text style={{ fontSize: 10, color: theme.icon, marginTop: 4 }}>
                                            {detailsType === 'redemptions' ? item.branch_name : ''}
                                        </Text>
                                    </View>
                                </View>
                            )}
                            ListEmptyComponent={
                                <Text style={{ textAlign: 'center', color: theme.icon, marginTop: 20 }}>
                                    No records found
                                </Text>
                            }
                        />
                    )}
                </View>
            </BaseModal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    filterContainer: {
        marginBottom: 10,
        height: 40,
    },
    filterPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        padding: 16,
        borderRadius: 16,
        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    tapIndicator: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 12,
        marginTop: 4,
        fontWeight: '500',
    },
    chartContainer: {
        padding: 20,
        borderRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    chartArea: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 180,
    },
    barColumn: {
        alignItems: 'center',
        flex: 1,
    },
    barContainer: {
        height: 140, // Max bar height
        width: 8,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 4,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    bar: {
        width: '100%',
        borderRadius: 4,
    },
    barLabel: {
        fontSize: 10,
        marginTop: 8,
    },
    barValue: {
        position: 'absolute',
        top: -20,
        display: 'none', // Hide value labels for cleaner look
    },
    // modalTitle: removed as it is handled by BaseModal title now
    detailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    detailTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    detailMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: 4,
    },
    detailMeta: {
        fontSize: 12,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
});
