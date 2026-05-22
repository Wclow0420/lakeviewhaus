import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart, CartItem } from '@/context/CartContext';
import { api, API_URL } from '@/services/api';
import { VoucherSelectorModal } from '@/components/modals/user/VoucherSelectorModal';
import { ProductDetailModal } from '@/components/store/ProductDetailModal';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme as keyof typeof Colors];

  const {
    cart,
    branchId,
    branchName,
    cartTotal,
    selectedVoucher,
    voucherDiscount,
    finalTotal,
    clearCart,
    updateQuantity,
    removeFromCart,
    itemDiscounts,
    autoApplyBestVoucher,
    invalidateVoucherCache,
  } = useCart();

  const [orderType, setOrderType] = useState<'pickup' | 'dine_in'>('pickup');
  const [tableNumber, setTableNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [voucherModalVisible, setVoucherModalVisible] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [autoApplying, setAutoApplying] = useState(false);

  // Edit item state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);

  // Auto-apply best voucher when checkout loads
  useEffect(() => {
    const applyBestVoucher = async () => {
      if (cart.length > 0 && !selectedVoucher && !autoApplying) {
        setAutoApplying(true);
        await autoApplyBestVoucher();
        setAutoApplying(false);
      }
    };
    applyBestVoucher();
  }, [cart.length]);

  const handleOrderTypeChange = (type: 'pickup' | 'dine_in') => {
    Haptics.selectionAsync();
    setOrderType(type);
    if (type === 'pickup') {
      setTableNumber('');
    }
  };

  // Handle editing a cart item
  const handleEditItem = async (item: CartItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoadingProduct(true);
    setEditingCartItemId(item.id);

    try {
      // Fetch full product data with options
      const productData = await api.customer.getProduct(item.productId);
      setEditingProduct(productData);
      setEditModalVisible(true);
    } catch (error) {
      console.error('Failed to load product:', error);
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleCloseEditModal = () => {
    setEditModalVisible(false);
    setEditingProduct(null);
    setEditingCartItemId(null);
  };

  const validateForm = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty');
      return false;
    }

    if (!branchId) {
      Alert.alert('Error', 'Branch not selected');
      return false;
    }

    if (orderType === 'dine_in' && !tableNumber.trim()) {
      Alert.alert('Table Number Required', 'Please enter your table number');
      return false;
    }

    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const orderItems = cart.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        selected_options: item.selectedOptions.map((opt) => ({
          group_id: opt.groupId,
          group_name: opt.groupName,
          option_id: opt.optionId,
          option_name: opt.optionName,
          price_adjustment: opt.priceAdjustment,
        })),
        special_instructions: item.specialInstructions,
      }));

      const response = await api.order.create({
        branch_id: branchId!.toString(),
        order_type: orderType,
        table_number: orderType === 'dine_in' ? tableNumber : undefined,
        items: orderItems,
        voucher_code: selectedVoucher?.redemption_code,
      });

      if (response.success) {
        setIsNavigating(true);
        // Clear cart and invalidate voucher cache so used vouchers aren't auto-applied next time
        clearCart();
        invalidateVoucherCache();
        router.replace({
          pathname: '/(tabs)/store/order-confirmation',
          params: { orderId: response.order.id },
        });
      } else {
        Alert.alert('Error', 'Failed to create order');
      }
    } catch (error: any) {
      console.error('Order creation error:', error);
      Alert.alert('Order Failed', error?.error || 'Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to get proper image URL
  const getImageUrl = (url?: string) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Redirect to store if cart is empty
  if (cart.length === 0 && !isNavigating) {
    router.back();
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header - Simple like reference */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Check Out</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Type Tabs - Like reference PICKUP/DELIVERY */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.orderTypeTabs}>
            <TouchableOpacity
              style={[
                styles.orderTypeTab,
                orderType === 'pickup' && [styles.orderTypeTabActive, { borderBottomColor: theme.secondary }],
              ]}
              onPress={() => handleOrderTypeChange('pickup')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.orderTypeTabText,
                  { color: orderType === 'pickup' ? theme.secondary : theme.icon },
                ]}
              >
                PICKUP
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.orderTypeTab,
                orderType === 'dine_in' && [styles.orderTypeTabActive, { borderBottomColor: theme.secondary }],
              ]}
              onPress={() => handleOrderTypeChange('dine_in')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.orderTypeTabText,
                  { color: orderType === 'dine_in' ? theme.secondary : theme.icon },
                ]}
              >
                DINE-IN
              </Text>
            </TouchableOpacity>
          </View>

          {/* Store Info */}
          <View style={styles.storeInfo}>
            <View style={styles.storeInfoLeft}>
              <Text style={[styles.storeName, { color: theme.text }]}>
                {branchName || 'Select Branch'}
                <Text style={[styles.storeArrow, { color: theme.secondary }]}> {'>'}</Text>
              </Text>
              <Text style={[styles.storeAddress, { color: theme.icon }]}>
                Lakeview Haus Branch
              </Text>
            </View>
            <View style={styles.storeInfoRight}>
              <View style={[styles.distanceBadge, { backgroundColor: `${theme.primary}20` }]}>
                <Text style={[styles.distanceText, { color: theme.secondary }]}>0.3km away</Text>
              </View>
              <View style={[styles.locationIcon, { backgroundColor: `${theme.primary}20` }]}>
                <Ionicons name="location" size={20} color={theme.secondary} />
              </View>
            </View>
          </View>

          {/* Table Number Input for Dine-in */}
          {orderType === 'dine_in' && (
            <View style={[styles.tableInputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
              <Ionicons name="grid-outline" size={20} color={theme.icon} />
              <TextInput
                style={[styles.tableInput, { color: theme.text }]}
                value={tableNumber}
                onChangeText={setTableNumber}
                placeholder="Enter table number"
                placeholderTextColor={theme.icon}
                keyboardType="default"
              />
            </View>
          )}

          {/* Expected time */}
          <View style={styles.expectedTime}>
            <Text style={[styles.expectedTimeText, { color: theme.text }]}>
              Expected to be ready in <Text style={[styles.expectedTimeNumber, { color: theme.secondary }]}>3</Text> minutes
            </Text>
            <Ionicons name="information-circle-outline" size={18} color={theme.icon} />
          </View>
        </View>

        {/* Order Items */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {cart.map((item, index) => {
            const discountInfo = itemDiscounts.find((d) => d.itemId === item.id);
            const hasDiscount = discountInfo?.hasDiscount || false;
            const imageUrl = getImageUrl(item.productImage);
            const isLoadingThisItem = loadingProduct && editingCartItemId === item.id;

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.itemRow,
                  index !== cart.length - 1 && styles.itemRowBorder,
                ]}
                onPress={() => handleEditItem(item)}
                activeOpacity={0.7}
                disabled={loadingProduct}
              >
                {/* Item Image */}
                <View style={styles.itemImageWrapper}>
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.itemImage} />
                  ) : (
                    <View style={[styles.itemImagePlaceholder, { backgroundColor: theme.border }]}>
                      <Ionicons name="cafe-outline" size={24} color={theme.icon} />
                    </View>
                  )}
                  {isLoadingThisItem && (
                    <View style={styles.itemLoadingOverlay}>
                      <ActivityIndicator size="small" color={theme.primary} />
                    </View>
                  )}
                </View>

                {/* Item Details */}
                <View style={styles.itemDetails}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
                    {item.productName}
                  </Text>
                  {item.selectedOptions.length > 0 && (
                    <Text style={[styles.itemOptions, { color: theme.icon }]} numberOfLines={2}>
                      {item.selectedOptions.map((opt) => opt.optionName).join('/')}
                    </Text>
                  )}

                  {/* Price Row */}
                  <View style={styles.itemPriceRow}>
                    {hasDiscount && discountInfo ? (
                      <>
                        <Text style={[styles.itemPrice, { color: theme.text }]}>
                          RM {discountInfo.discountedPrice.toFixed(2)}
                        </Text>
                        <Text style={[styles.originalPrice, { color: theme.icon }]}>
                          RM {discountInfo.originalPrice.toFixed(2)}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.itemPrice, { color: theme.text }]}>
                        RM {item.subtotal.toFixed(2)}
                      </Text>
                    )}
                  </View>

                  {/* Savings highlight - attractive inline display */}
                  {hasDiscount && discountInfo?.discountLabel && (
                    <View style={styles.savingsRow}>
                      <Ionicons name="sparkles" size={12} color="#FF6B00" />
                      <Text style={styles.savingsText}>
                        {discountInfo.discountLabel}
                        {discountInfo.discountedUnits > 0 && discountInfo.discountedUnits < item.quantity
                          ? ` on ${discountInfo.discountedUnits} unit`
                          : ' applied'}
                        {' • Save RM '}{discountInfo.discountAmount.toFixed(2)}
                      </Text>
                    </View>
                  )}

                  {/* Edit hint */}
                  <Text style={[styles.editHint, { color: theme.icon }]}>Tap to edit</Text>
                </View>

                {/* Quantity & Actions */}
                <View style={styles.itemActions}>
                  <Text style={[styles.itemQuantity, { color: theme.text }]}>x {item.quantity}</Text>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      Alert.alert(
                        'Remove Item',
                        `Remove ${item.productName} from cart?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(item.id) },
                        ]
                      );
                    }}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.error} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Item count divider */}
          <View style={styles.itemCountDivider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.itemCountText, { color: theme.icon }]}>{cart.length} item(s)</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>
        </View>

        {/* Voucher & Payment Section */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {/* Voucher Selector */}
          <TouchableOpacity
            style={styles.voucherRow}
            onPress={() => setVoucherModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.voucherLeft}>
              <View style={[styles.voucherIcon, { backgroundColor: `${theme.primary}30` }]}>
                <Ionicons name="ticket-outline" size={20} color={theme.secondary} />
              </View>
              <View style={styles.voucherInfo}>
                <Text style={[styles.voucherLabel, { color: theme.text }]}>Voucher</Text>
                {selectedVoucher ? (
                  <Text style={[styles.voucherApplied, { color: theme.success }]} numberOfLines={1}>
                    {selectedVoucher.reward_name}
                  </Text>
                ) : autoApplying ? (
                  <Text style={[styles.voucherHint, { color: theme.icon }]}>Finding best deal...</Text>
                ) : (
                  <Text style={[styles.voucherHint, { color: theme.icon }]}>Select or enter code</Text>
                )}
              </View>
            </View>
            <View style={styles.voucherRight}>
              {selectedVoucher && voucherDiscount > 0 && (
                <Text style={[styles.voucherSavings, { color: theme.success }]}>
                  -RM {voucherDiscount.toFixed(2)}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={20} color={theme.icon} />
            </View>
          </TouchableOpacity>

          {/* Divider */}
          <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />

          {/* Price Breakdown */}
          <View style={styles.priceBreakdown}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: theme.icon }]}>Subtotal</Text>
              <Text style={[styles.priceValue, { color: theme.text }]}>RM {cartTotal.toFixed(2)}</Text>
            </View>
            {voucherDiscount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: theme.success }]}>Voucher Discount</Text>
                <Text style={[styles.priceValue, { color: theme.success }]}>-RM {voucherDiscount.toFixed(2)}</Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: theme.text }]}>RM {finalTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Pay Button - Fixed at bottom */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.payButton, { backgroundColor: theme.primary }, loading && styles.payButtonDisabled]}
          onPress={handlePlaceOrder}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Text style={styles.payButtonText}>
              {finalTotal === 0 ? 'Place Free Order' : `Pay Now  RM${finalTotal.toFixed(2)}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Voucher Modal */}
      <VoucherSelectorModal
        visible={voucherModalVisible}
        onClose={() => setVoucherModalVisible(false)}
      />

      {/* Product Edit Modal */}
      <ProductDetailModal
        visible={editModalVisible}
        onClose={handleCloseEditModal}
        product={editingProduct}
        editMode={true}
        cartItemId={editingCartItemId || undefined}
      />
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
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.semibold,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Order Type Tabs
  orderTypeTabs: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  orderTypeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  orderTypeTabActive: {
    // borderBottomColor set dynamically via theme.secondary
  },
  orderTypeTabText: {
    fontSize: 14,
    fontFamily: Fonts.semibold,
    letterSpacing: 0.5,
  },

  // Store Info
  storeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  storeInfoLeft: {
    flex: 1,
    paddingRight: 16,
  },
  storeName: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
    marginBottom: 4,
  },
  storeArrow: {
    // color set dynamically via theme.secondary
  },
  storeAddress: {
    fontSize: 13,
    lineHeight: 18,
  },
  storeInfoRight: {
    alignItems: 'flex-end',
  },
  distanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  distanceText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Table Input
  tableInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  tableInput: {
    flex: 1,
    fontSize: 15,
  },

  // Expected Time
  expectedTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expectedTimeText: {
    fontSize: 14,
  },
  expectedTimeNumber: {
    fontFamily: Fonts.bold,
  },

  // Item Row
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemImageWrapper: {
    marginRight: 12,
    position: 'relative',
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
  },
  itemImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontFamily: Fonts.semibold,
    marginBottom: 4,
  },
  itemOptions: {
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemPrice: {
    fontSize: 15,
    fontFamily: Fonts.semibold,
  },
  originalPrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  savingsText: {
    fontSize: 12,
    color: '#FF6B00',
    fontFamily: Fonts.semibold,
  },
  editHint: {
    fontSize: 11,
    marginTop: 4,
  },
  itemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  itemQuantity: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  removeBtn: {
    padding: 4,
  },

  // Item Count Divider
  itemCountDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  itemCountText: {
    fontSize: 13,
    paddingHorizontal: 12,
  },

  // Voucher Section
  voucherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  voucherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  voucherIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voucherInfo: {
    flex: 1,
  },
  voucherLabel: {
    fontSize: 15,
    fontFamily: Fonts.semibold,
    marginBottom: 2,
  },
  voucherApplied: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  voucherHint: {
    fontSize: 13,
  },
  voucherRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voucherSavings: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },

  // Section Divider
  sectionDivider: {
    height: 1,
    marginVertical: 14,
  },

  // Price Breakdown
  priceBreakdown: {
    gap: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
  },
  priceValue: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },

  // Total Row
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
  },
  totalValue: {
    fontSize: 20,
    fontFamily: Fonts.bold,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  payButton: {
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: '#000000',
    fontSize: 16,
    fontFamily: Fonts.semibold,
  },
});
