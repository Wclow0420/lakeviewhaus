import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseModal } from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';
import { printerService } from '@/services/printer';
import * as Haptics from 'expo-haptics';

interface OrderDetailModalProps {
  visible: boolean;
  onClose: () => void;
  order: any | null;
  onOrderUpdated: () => void;
}

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export function OrderDetailModal({ visible, onClose, order, onOrderUpdated }: OrderDetailModalProps) {
  const [updating, setUpdating] = useState(false);
  const [reprinting, setReprinting] = useState(false);
  const [printerAvailable, setPrinterAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!visible) return;
    (async () => {
      const ok = await printerService.isAvailable();
      if (!cancelled) setPrinterAvailable(ok);
    })();
    return () => { cancelled = true; };
  }, [visible]);

  const handleReprint = async () => {
    if (!order) return;
    try {
      setReprinting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await printerService.printOrderStickers(order);
    } catch (e: any) {
      console.error('Reprint failed', e);
      Alert.alert('Print Failed', e?.message || 'Could not print stickers. Check the printer.');
    } finally {
      setReprinting(false);
    }
  };

  if (!order) return null;

  const statusFlow: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
  const currentStatusIndex = statusFlow.indexOf(order.status);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#27AE60';
      case 'preparing':
      case 'ready':
        return '#FCD259';
      case 'confirmed':
        return '#3498DB';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
        return '#E53935';
      default:
        return '#666666';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'preparing':
        return 'restaurant';
      case 'ready':
        return 'checkmark-done';
      case 'confirmed':
        return 'time';
      case 'pending':
        return 'hourglass';
      case 'cancelled':
        return 'close-circle';
      default:
        return 'ellipse';
    }
  };

  const getNextStatus = (): OrderStatus | null => {
    if (currentStatusIndex >= 0 && currentStatusIndex < statusFlow.length - 1) {
      return statusFlow[currentStatusIndex + 1];
    }
    return null;
  };

  const getNextStatusLabel = (status: OrderStatus): string => {
    switch (status) {
      case 'confirmed':
        return 'Confirm Order';
      case 'preparing':
        return 'Start Preparing';
      case 'ready':
        return 'Mark as Ready';
      case 'completed':
        return 'Complete Order';
      default:
        return 'Update Status';
    }
  };

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    try {
      setUpdating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const response = await api.order.merchant.updateStatus(order.id, newStatus);

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', `Order status updated to ${newStatus}`);
        onOrderUpdated();
        onClose();
      } else {
        Alert.alert('Error', 'Failed to update order status');
      }
    } catch (error: any) {
      console.error('Failed to update status:', error);
      Alert.alert('Error', error?.error || 'Failed to update order status');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

              const response = await api.order.merchant.updateStatus(order.id, 'cancelled');

              if (response.success) {
                Alert.alert('Order Cancelled', 'The order has been cancelled');
                onOrderUpdated();
                onClose();
              } else {
                Alert.alert('Error', 'Failed to cancel order');
              }
            } catch (error: any) {
              console.error('Failed to cancel order:', error);
              Alert.alert('Error', error?.error || 'Failed to cancel order');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const nextStatus = getNextStatus();
  const canCancel = order.status === 'pending' || order.status === 'confirmed';

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-MY', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <BaseModal visible={visible} onClose={onClose} title="Order Details" scrollable={true}>
      <View style={styles.container}>
        {/* Order Number & Status */}
        <View style={styles.headerSection}>
          <Text style={styles.orderNumber}>#{order.order_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
            <Ionicons name={getStatusIcon(order.status) as any} size={16} color="#FFFFFF" />
            <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Order Info */}
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color="#666666" />
            <Text style={styles.infoText}>{formatTime(order.created_at)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name={order.order_type === 'dine_in' ? 'restaurant' : 'bag-handle'}
              size={18}
              color="#666666"
            />
            <Text style={styles.infoText}>
              {order.order_type === 'dine_in' ? 'Dine In' : 'Pickup'}
              {order.table_number && ` • Table ${order.table_number}`}
            </Text>
          </View>

          {order.user && (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color="#666666" />
              <Text style={styles.infoText}>{order.user.username || order.user.email}</Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items ({order.items?.length || 0})</Text>
          {order.items?.map((item: any, index: number) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemQuantity}>{item.quantity}×</Text>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemPrice}>RM {item.item_total.toFixed(2)}</Text>
              </View>

              {/* Selected Options */}
              {item.selected_options && item.selected_options.length > 0 && (
                <View style={styles.optionsContainer}>
                  {item.selected_options.map((option: any, optIndex: number) => (
                    <View key={optIndex} style={styles.optionRow}>
                      <Text style={styles.optionText}>
                        • {option.group_name}: {option.option_name}
                        {option.price_adjustment > 0 && (
                          <Text style={styles.optionPrice}> (+RM {option.price_adjustment.toFixed(2)})</Text>
                        )}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Special Instructions */}
              {item.special_instructions && (
                <View style={styles.instructionsContainer}>
                  <Ionicons name="information-circle-outline" size={14} color="#FCD259" />
                  <Text style={styles.instructionsText}>{item.special_instructions}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Special Notes */}
        {order.notes && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Special Instructions</Text>
              <View style={styles.notesCard}>
                <Ionicons name="chatbox-outline" size={18} color="#666666" />
                <Text style={styles.notesText}>{order.notes}</Text>
              </View>
            </View>
          </>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Payment Info */}
        <View style={styles.section}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>RM {order.total.toFixed(2)}</Text>
          </View>

          <View style={styles.paymentStatusRow}>
            <Text style={styles.paymentLabel}>Payment Status:</Text>
            <View
              style={[
                styles.paymentBadge,
                { backgroundColor: order.payment_status === 'paid' ? '#27AE60' : '#FF9800' },
              ]}
            >
              <Text style={styles.paymentText}>
                {order.payment_status === 'paid' ? 'PAID' : 'PENDING'}
              </Text>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Status Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Status Timeline</Text>
          <View style={styles.timeline}>
            {statusFlow.map((status, index) => {
              const isCompleted = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;

              return (
                <View key={status} style={styles.timelineItem}>
                  <View style={styles.timelineIndicator}>
                    <View
                      style={[
                        styles.timelineDot,
                        isCompleted && styles.timelineDotCompleted,
                        isCurrent && styles.timelineDotCurrent,
                      ]}
                    >
                      {isCompleted && (
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={isCurrent ? '#FFFFFF' : '#27AE60'}
                        />
                      )}
                    </View>
                    {index < statusFlow.length - 1 && (
                      <View
                        style={[styles.timelineLine, isCompleted && styles.timelineLineCompleted]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.timelineLabel,
                      isCompleted && styles.timelineLabelCompleted,
                      isCurrent && styles.timelineLabelCurrent,
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Action Buttons */}
        {order.status !== 'completed' && order.status !== 'cancelled' && (
          <>
            <View style={styles.divider} />
            <View style={styles.actions}>
              {nextStatus && (
                <Button
                  title={updating ? 'Updating...' : getNextStatusLabel(nextStatus)}
                  onPress={() => handleUpdateStatus(nextStatus)}
                  variant="primary"
                  size="lg"
                  disabled={updating}
                  style={styles.actionButton}
                />
              )}

              {/* Reprint stickers — only on devices with a SUNMI printer */}
              {printerAvailable && order.payment_status === 'paid' && (
                <TouchableOpacity
                  style={styles.reprintButton}
                  onPress={handleReprint}
                  disabled={reprinting}
                  activeOpacity={0.7}
                >
                  <Ionicons name="print-outline" size={20} color="#000" />
                  <Text style={styles.reprintButtonText}>
                    {reprinting ? 'Printing...' : 'Reprint Stickers'}
                  </Text>
                </TouchableOpacity>
              )}

              {canCancel && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelOrder}
                  disabled={updating}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle-outline" size={20} color="#E53935" />
                  <Text style={styles.cancelButtonText}>Cancel Order</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Spacer */}
        <View style={{ height: 20 }} />
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  orderNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  section: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 15,
    color: '#666666',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  itemCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemQuantity: {
    fontSize: 15,
    fontWeight: '700',
    color: '#666666',
    width: 35,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  optionsContainer: {
    marginLeft: 35,
    marginBottom: 8,
  },
  optionRow: {
    marginBottom: 4,
  },
  optionText: {
    fontSize: 13,
    color: '#666666',
  },
  optionPrice: {
    fontSize: 13,
    color: '#27AE60',
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginLeft: 35,
    backgroundColor: '#FFFBF0',
    padding: 8,
    borderRadius: 8,
  },
  instructionsText: {
    flex: 1,
    fontSize: 13,
    color: '#666666',
    fontStyle: 'italic',
  },
  notesCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 12,
  },
  notesText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  paymentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 15,
    color: '#666666',
  },
  paymentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  paymentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  timelineIndicator: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotCompleted: {
    borderColor: '#27AE60',
    backgroundColor: '#E8F5E9',
  },
  timelineDotCurrent: {
    borderColor: '#FCD259',
    backgroundColor: '#FCD259',
  },
  timelineLine: {
    width: 2,
    height: 30,
    backgroundColor: '#E0E0E0',
    marginTop: 2,
  },
  timelineLineCompleted: {
    backgroundColor: '#27AE60',
  },
  timelineLabel: {
    fontSize: 15,
    color: '#999999',
    paddingTop: 2,
  },
  timelineLabelCompleted: {
    color: '#27AE60',
    fontWeight: '600',
  },
  timelineLabelCurrent: {
    color: '#000000',
    fontWeight: '700',
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    width: '100%',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E53935',
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E53935',
  },
  reprintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
  },
  reprintButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});
