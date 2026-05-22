import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Pill } from '@/components/ui/Pill';
import { api } from '@/services/api';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ACTIVE_STATUSES = new Set(['confirmed', 'preparing', 'ready']);
type FilterKey = 'all' | 'pending' | 'active' | 'completed' | 'cancelled';

export default function OrderHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  const loadOrders = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);
      const response = await api.order.getHistory({ per_page: 50 });
      if (response.success) {
        setOrders(response.orders || []);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders(true);
  };

  const handleOrderPress = (orderId: string) => {
    router.push({ pathname: '/order-detail', params: { orderId } });
  };

  const getStatusColor = (status: string) => {
    if (ACTIVE_STATUSES.has(status)) return '#3498DB';
    if (status === 'completed') return '#27AE60';
    if (status === 'pending') return '#E65100';
    if (status === 'cancelled') return '#999999';
    return '#666666';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'pending') return 'time-outline';
    if (status === 'confirmed') return 'checkmark-circle-outline';
    if (status === 'preparing') return 'restaurant-outline';
    if (status === 'ready') return 'checkmark-done-outline';
    if (status === 'completed') return 'checkmark-circle';
    if (status === 'cancelled') return 'close-circle-outline';
    return 'ellipse';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'confirmed') return 'CONFIRMED';
    if (status === 'preparing') return 'PREPARING';
    if (status === 'ready') return 'READY';
    return status.toUpperCase();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-MY', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const renderOrderCard = (item: any) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.orderCard, { backgroundColor: theme.card }]}
      onPress={() => handleOrderPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.orderNumber, { color: theme.text }]}>#{item.order_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Ionicons name={getStatusIcon(item.status) as any} size={14} color="#FFFFFF" />
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="restaurant-outline" size={16} color={theme.icon} />
          <Text style={[styles.infoText, { color: theme.icon }]}>
            {item.order_type === 'dine_in' ? 'Dine In' : 'Pickup'}
            {item.table_number && ` • Table ${item.table_number}`}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="receipt-outline" size={16} color={theme.icon} />
          <Text style={[styles.infoText, { color: theme.icon }]}>
            {item.items?.length || 0} item{item.items?.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {item.branch && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={theme.icon} />
            <Text style={[styles.infoText, { color: theme.icon }]}>{item.branch.name}</Text>
          </View>
        )}
      </View>

      <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
        <Text style={[styles.dateText, { color: theme.icon }]}>{formatDate(item.created_at)}</Text>
        <Text style={[styles.totalText, { color: theme.text }]}>RM {item.total.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSection = (title: string, items: any[]) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {title} ({items.length})
        </Text>
        {items.map(renderOrderCard)}
      </View>
    );
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const activeOrders = orders.filter(o => ACTIVE_STATUSES.has(o.status));
  const completedOrders = orders.filter(o => o.status === 'completed');
  const cancelledOrders = orders.filter(o => o.status === 'cancelled');

  const filteredOrders = (() => {
    switch (filter) {
      case 'pending': return pendingOrders;
      case 'active': return activeOrders;
      case 'completed': return completedOrders;
      case 'cancelled': return cancelledOrders;
      default: return orders;
    }
  })();

  const filterPills: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: orders.length },
    { key: 'pending', label: 'Pending', count: pendingOrders.length },
    { key: 'active', label: 'Active', count: activeOrders.length },
    { key: 'completed', label: 'Completed', count: completedOrders.length },
    { key: 'cancelled', label: 'Cancelled', count: cancelledOrders.length },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header — matches vouchers page */}
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Order History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Pills */}
      {!loading && orders.length > 0 && (
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            data={filterPills}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <Pill
                label={item.count > 0 ? `${item.label} (${item.count})` : item.label}
                selected={filter === item.key}
                onPress={() => setFilter(item.key)}
                style={styles.filterPill}
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color={theme.icon} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Orders Yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.icon }]}>Start ordering from the store</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
          }
        >
          {filter === 'all' ? (
            <>
              {renderSection('Pending', pendingOrders)}
              {renderSection('Active', activeOrders)}
              {renderSection('Completed', completedOrders)}
              {renderSection('Cancelled', cancelledOrders)}
            </>
          ) : filteredOrders.length === 0 ? (
            <View style={styles.emptyBucket}>
              <Ionicons name="receipt-outline" size={48} color={theme.icon} />
              <Text style={[styles.emptyBucketText, { color: theme.icon }]}>
                No {filter} orders
              </Text>
            </View>
          ) : (
            filteredOrders.map(renderOrderCard)
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
  filterContainer: {
    paddingVertical: 12,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    marginRight: 8,
  },
  emptyBucket: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyBucketText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 12,
  },
  orderCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  cardBody: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  dateText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
  },
  totalText: {
    fontSize: 17,
    fontFamily: Fonts.bold,
  },
});
