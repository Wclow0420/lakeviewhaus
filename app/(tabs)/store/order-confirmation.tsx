import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  TouchableOpacity,
  Image,
  AppState,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { api, API_URL } from '@/services/api';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';
import { socketService } from '@/services/socket';
import { OrderProgress } from '@/components/store/OrderProgress';

// Timeout window is driven by the server — `order.expires_at` is authoritative.

export default function OrderConfirmationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);

  // Load order details
  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId]);

  // Countdown timer - starts when order is loaded and payment is pending
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Only run timer if payment is pending and time remaining
    if (order?.payment_status === 'pending' && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleAutoCancel();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [order?.payment_status, order?.id]);

  // Poll for payment status every 3 seconds
  useEffect(() => {
    if (order?.payment_status === 'pending') {
      pollRef.current = setInterval(() => {
        checkPaymentStatus();
      }, 3000);

      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [order?.payment_status]);

  // Check payment when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        order?.payment_status === 'pending'
      ) {
        checkPaymentStatus();
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [order]);

  // Real-time: server pushes order_update on every state transition. Polling
  // remains as a fallback for socket disconnects / slow networks.
  useEffect(() => {
    if (!orderId) return;
    const handler = (data: any) => {
      if (!data || data.id !== orderId) return;
      setOrder(data);
      if (data.payment_status === 'paid' || data.status === 'cancelled' || data.payment_status === 'failed') {
        if (timerRef.current) clearInterval(timerRef.current);
        if (pollRef.current) clearInterval(pollRef.current);
        if (data.payment_status === 'paid') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    };
    socketService.on('order_update', handler);
    return () => socketService.off('order_update', handler);
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await api.order.getDetails(orderId);

      if (response.success) {
        setOrder(response.order);
        // Use server-provided expires_at so the client never needs to know the window length
        if (response.order.expires_at && response.order.payment_status === 'pending') {
          const expiresAt = new Date(response.order.expires_at).getTime();
          const remaining = Math.max(Math.floor((expiresAt - Date.now()) / 1000), 0);
          setTimeRemaining(remaining);
        }
      } else {
        Alert.alert('Error', 'Failed to load order details');
      }
    } catch (error) {
      console.error('Failed to load order:', error);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!orderId) return;
    try {
      const response = await api.order.verifyPayment(orderId);
      const newStatus = response.order.payment_status;
      const changed = newStatus !== order?.payment_status || response.order.status !== order?.status;
      if (response.success && changed) {
        setOrder(response.order);
        const terminal = newStatus === 'paid' || newStatus === 'failed' || response.order.status === 'cancelled';
        if (terminal) {
          if (newStatus === 'paid') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          if (timerRef.current) clearInterval(timerRef.current);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    } catch (error) {
      console.error('Failed to check payment status:', error);
    }
  };

  const handleAutoCancel = async () => {
    if (!order || order.payment_status !== 'pending') return;
    try {
      await api.order.cancel(order.id);
      setOrder({ ...order, status: 'cancelled' });
      Alert.alert('Order Cancelled', 'Your order was cancelled due to payment timeout.');
    } catch (error) {
      console.error('Auto-cancel failed:', error);
    }
  };

  const handleCancelOrder = async () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            setCancelLoading(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await api.order.cancel(order.id);
            router.replace('/(tabs)/store');
          } catch (error: any) {
            Alert.alert('Error', error?.error || 'Failed to cancel order');
          } finally {
            setCancelLoading(false);
          }
        },
      },
    ]);
  };

  const handleToPayment = async () => {
    if (!order) return;

    try {
      setPaymentLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const response = await api.order.createPayment(order.id);
      if (response.success && response.payment_url) {
        await Linking.openURL(response.payment_url);
      } else {
        Alert.alert('Error', 'Failed to create payment');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert('Payment Error', error?.error || 'Failed to open payment page');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleCopyOrderId = async () => {
    if (order?.order_number) {
      await Clipboard.setStringAsync(order.order_number);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }) + ' ' + date.toLocaleTimeString('en-MY', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getImageUri = (url: string | null) => {
    if (!url) return 'https://via.placeholder.com/60';
    if (url.startsWith('http')) return url;
    return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.icon }]}>Loading order details...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#E53935" />
          <Text style={[styles.errorTitle, { color: theme.text }]}>Order Not Found</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => router.replace('/(tabs)/store')}
          >
            <Text style={[styles.primaryButtonText, { color: theme.secondary }]}>Back to Store</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isPaid = order.payment_status === 'paid' && order.status !== 'cancelled';
  const isPending = order.payment_status === 'pending';
  const isFailed = order.payment_status === 'failed' && order.status !== 'cancelled';
  const isCancelled = order.status === 'cancelled';
  const isPickup = order.order_type === 'pickup';
  const cancelledDueToTimeout = isCancelled && order.payment_status === 'failed';

  // Main screen (Pending or Paid)
  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {isCancelled ? 'Order Cancelled' : isPaid ? 'Order Confirmed' : isFailed ? 'Payment Failed' : 'To be paid'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Status Section */}
      <View style={[styles.statusSection, { backgroundColor: theme.card }]}>
        {isPending ? (
          <>
            {/* Countdown Timer */}
            <View style={[styles.timerBadge, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="time-outline" size={20} color="#E65100" />
              <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
            </View>
            <Text style={[styles.statusSubtext, { color: theme.icon }]}>
              Complete payment or the order will be cancelled
            </Text>
          </>
        ) : isFailed ? (
          <>
            <View style={[styles.failedBadge, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="close-circle" size={24} color="#E53935" />
              <Text style={styles.failedText}>Payment Failed</Text>
            </View>
            <Text style={[styles.statusSubtext, { color: theme.icon }]}>
              Your payment did not go through. Try again or cancel the order.
            </Text>
          </>
        ) : isCancelled ? (
          <>
            <View style={[styles.cancelledBadge, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="close-circle" size={24} color="#E53935" />
              <Text style={styles.cancelledBadgeText}>Order Cancelled</Text>
            </View>
            <Text style={[styles.statusSubtext, { color: theme.icon }]}>
              {cancelledDueToTimeout ? 'Payment timed out — the order was cancelled' : 'This order has been cancelled'}
            </Text>
          </>
        ) : (
          <>
            {/* Payment Success */}
            <View style={[styles.successBadge, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#27AE60" />
              <Text style={styles.successText}>Payment Successful</Text>
            </View>

            {/* Pickup / Dine-in Info */}
            <View style={styles.pickupInfoContainer}>
              {isPickup ? (
                <>
                  <Text style={[styles.pickupLabel, { color: theme.icon }]}>Show this order number to pick up</Text>
                  <View style={styles.orderNumberContainer}>
                    <Text style={[styles.orderNumberLarge, { color: theme.text }]}>{order.order_number}</Text>
                    <TouchableOpacity onPress={handleCopyOrderId} style={styles.copyButton}>
                      <Ionicons name="copy-outline" size={20} color={theme.icon} />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.pickupLabel, { color: theme.icon }]}>Your order will be served at</Text>
                  <View style={styles.tableNumberContainer}>
                    <Ionicons name="restaurant-outline" size={24} color={theme.primary} />
                    <Text style={[styles.tableNumberText, { color: theme.text }]}>Table {order.table_number}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Live order progress — driven by socket order_update events */}
            <OrderProgress status={order.status} />
          </>
        )}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Order Card */}
        <View style={[styles.orderCard, { backgroundColor: theme.card }]}>
          {/* Order Type Badge */}
          <View style={[styles.orderTypeBadge, { backgroundColor: isPickup ? '#E3F2FD' : '#E8F5E9' }]}>
            <Ionicons
              name={isPickup ? 'bag-handle-outline' : 'restaurant-outline'}
              size={14}
              color={isPickup ? '#1976D2' : '#2E7D32'}
            />
            <Text style={[styles.orderTypeBadgeText, { color: isPickup ? '#1976D2' : '#2E7D32' }]}>
              {isPickup ? 'Take Out' : 'Dine In'}
            </Text>
          </View>

          {/* Branch Name */}
          <View style={styles.branchRow}>
            <Text style={[styles.branchName, { color: theme.text }]}>{order.branch?.name || 'Lakeview Haus'}</Text>
          </View>

          {/* Items List */}
          {order.items?.map((item: any, index: number) => (
            <View key={index} style={[styles.itemRow, { borderBottomColor: theme.border }]}>
              <Image
                source={{ uri: getImageUri(item.product_image) }}
                style={styles.itemImage}
              />
              <View style={styles.itemDetails}>
                <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>{item.product_name}</Text>
                {item.selected_options?.length > 0 && (
                  <Text style={[styles.itemOptions, { color: theme.icon }]} numberOfLines={1}>
                    {item.selected_options.map((opt: any) => opt.option_name).join(' / ')}
                  </Text>
                )}
                <Text style={[styles.itemPrice, { color: theme.text }]}>RM {item.item_total.toFixed(2)}</Text>
              </View>
              <Text style={[styles.itemQuantity, { color: theme.icon }]}>× {item.quantity}</Text>
            </View>
          ))}

          {/* Items Count Divider */}
          <View style={styles.itemsCountDivider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.itemsCountText, { color: theme.icon }]}>{order.items?.length || 0} item(s)</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          {/* Price Breakdown */}
          {order.voucher_discount > 0 && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: theme.icon }]}>Voucher Discount</Text>
              <Text style={styles.discountValue}>-RM {order.voucher_discount.toFixed(2)}</Text>
            </View>
          )}

          {/* Total */}
          <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
            <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: theme.text }]}>RM {order.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Order Info Card */}
        <View style={[styles.orderInfoCard, { backgroundColor: theme.card }]}>
          <View style={styles.orderInfoRow}>
            <Text style={[styles.orderInfoLabel, { color: theme.icon }]}>Order ID</Text>
            <View style={styles.orderIdContainer}>
              <Text style={[styles.orderInfoValue, { color: theme.text }]}>{order.order_number}</Text>
              <TouchableOpacity onPress={handleCopyOrderId}>
                <Ionicons name="copy-outline" size={16} color={theme.icon} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.orderInfoRow}>
            <Text style={[styles.orderInfoLabel, { color: theme.icon }]}>Ordered on</Text>
            <Text style={[styles.orderInfoValue, { color: theme.text }]}>{formatDate(order.created_at)}</Text>
          </View>
          <View style={styles.orderInfoRow}>
            <Text style={[styles.orderInfoLabel, { color: theme.icon }]}>Payment</Text>
            <Text style={[styles.orderInfoValue, {
              color: isPaid ? '#27AE60' : (isCancelled || isFailed) ? '#E53935' : '#E65100',
            }]}>
              {isPaid ? 'Paid' : isCancelled ? 'Cancelled' : isFailed ? 'Failed' : 'Pending'}
            </Text>
          </View>
          {order.points_earned > 0 && isPaid && (
            <View style={[styles.pointsEarnedContainer, { backgroundColor: '#FFFBF0' }]}>
              <Ionicons name="star" size={18} color={theme.primary} />
              <Text style={[styles.pointsEarnedText, { color: theme.text }]}>
                You earned {order.points_earned} points!
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer Buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: theme.card }]}>
        {isPending || isFailed ? (
          <>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelOrder}
              disabled={cancelLoading}
            >
              <Text style={styles.cancelButtonText}>
                {cancelLoading ? 'Cancelling...' : 'Cancel'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paymentButton, { backgroundColor: theme.primary }]}
              onPress={handleToPayment}
              disabled={paymentLoading}
            >
              <Text style={[styles.paymentButtonText, { color: theme.secondary }]}>
                {paymentLoading ? 'Processing...' : isFailed ? 'Try Again' : 'Pay Now'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary, flex: 1 }]}
            onPress={() => router.replace('/(tabs)/store')}
          >
            <Text style={[styles.primaryButtonText, { color: theme.secondary }]}>Back to Store</Text>
          </TouchableOpacity>
        )}
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
  headerRight: {
    width: 40,
  },
  statusSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  timerText: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#E65100',
  },
  statusSubtext: {
    marginTop: 8,
    fontSize: 14,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  successText: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
    color: '#27AE60',
  },
  failedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  failedText: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
    color: '#E53935',
  },
  cancelledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  cancelledBadgeText: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
    color: '#E53935',
  },
  pickupInfoContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  pickupLabel: {
    fontSize: 14,
  },
  orderNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  orderNumberLarge: {
    fontSize: 32,
    fontFamily: Fonts.bold,
    letterSpacing: 2,
  },
  copyButton: {
    padding: 8,
  },
  tableNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  tableNumberText: {
    fontSize: 28,
    fontFamily: Fonts.bold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  orderCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  orderTypeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  orderTypeBadgeText: {
    fontSize: 12,
    fontFamily: Fonts.semibold,
  },
  branchRow: {
    marginBottom: 16,
  },
  branchName: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 15,
    fontFamily: Fonts.semibold,
    marginBottom: 2,
  },
  itemOptions: {
    fontSize: 13,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: Fonts.semibold,
  },
  itemQuantity: {
    fontSize: 14,
    marginLeft: 12,
  },
  itemsCountDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  itemsCountText: {
    paddingHorizontal: 16,
    fontSize: 14,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
  },
  discountValue: {
    fontSize: 14,
    fontFamily: Fonts.semibold,
    color: '#27AE60',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  totalValue: {
    fontSize: 20,
    fontFamily: Fonts.bold,
  },
  orderInfoCard: {
    borderRadius: 16,
    padding: 16,
  },
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  orderInfoLabel: {
    fontSize: 14,
  },
  orderInfoValue: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsEarnedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  pointsEarnedText: {
    fontSize: 14,
    fontFamily: Fonts.semibold,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
    color: '#E53935',
  },
  paymentButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginTop: 16,
    marginBottom: 24,
  },
});
