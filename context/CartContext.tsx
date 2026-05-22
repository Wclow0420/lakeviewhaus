import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { useAuth } from './AuthContext';
import { api } from '@/services/api';

// ============================================================================
// TYPES
// ============================================================================

export interface SelectedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceAdjustment: number;
}

export interface CartItem {
  id: string;  // Unique cart item ID (UUID)
  productId: string;
  productName: string;
  productPrice: number;
  productImage?: string;
  quantity: number;
  selectedOptions: SelectedOption[];
  subtotal: number;
  specialInstructions?: string;
  categoryId?: string;  // For category-based voucher validation
}

// Item discount info for display
export interface ItemDiscountInfo {
  itemId: string;
  originalPrice: number;
  discountedPrice: number;
  discountAmount: number;
  discountLabel: string;  // e.g., "20% OFF", "RM 5 OFF", "FREE"
  discountedUnits: number; // How many units of this line got the discount (1 for product/category scope, full quantity for order scope)
  hasDiscount: boolean;
}

export interface UserReward {
  id: string;
  redemption_code: string;
  reward_type: 'discount_percentage' | 'discount_fixed' | 'free_item';
  reward_value: number;
  reward_name: string;
  expires_at: string;
  status: 'active' | 'used' | 'expired';
  // Additional fields for validation
  target_scope?: 'custom' | 'order' | 'product' | 'category';
  target_id?: string | null;  // Product ID or Category ID depending on target_scope
  branch_id?: string | null;
}

interface CartState {
  items: CartItem[];
  branchId: number | null;
  branchName?: string;
  selectedVoucher?: UserReward | null;
}

interface CartContextType {
  // State
  cart: CartItem[];
  branchId: number | null;
  branchName?: string;
  itemCount: number;
  cartTotal: number;
  selectedVoucher: UserReward | null;
  voucherDiscount: number;
  finalTotal: number;
  isLoading: boolean;
  itemDiscounts: ItemDiscountInfo[];  // Per-item discount info for display

  // Actions
  addToCart: (product: any, selectedOptions: SelectedOption[], quantity: number, specialInstructions?: string) => Promise<boolean>;
  updateCartItem: (itemId: string, updates: Partial<CartItem>) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  loadCart: () => Promise<void>;
  setSelectedVoucher: (voucher: UserReward | null) => void;
  autoApplyBestVoucher: () => Promise<void>;  // Auto-apply best available voucher
  invalidateVoucherCache: () => void;  // Clear voucher cache (call after order completion)
}

// ============================================================================
// CONTEXT
// ============================================================================

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'cart_data';
const VOUCHER_CACHE_KEY = 'voucher_cache';
const VOUCHER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const MAX_CART_ITEMS = 20;
const DEBOUNCE_DELAY = 300;
const AUTO_APPLY_DEBOUNCE = 500; // Debounce auto-apply to prevent rapid calls

// ============================================================================
// PROVIDER
// ============================================================================

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branchName, setBranchName] = useState<string | undefined>(undefined);
  const [selectedVoucher, setSelectedVoucherState] = useState<UserReward | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoApplyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voucherCacheRef = useRef<{ data: any[] | null; timestamp: number }>({ data: null, timestamp: 0 });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  /**
   * Single source of truth for how a voucher applies to a cart.
   *
   * Product / category scope: discount goes to exactly 1 unit of the
   *   highest-priced eligible cart line (customer-friendly cap).
   * Order / custom scope: discount applies across the whole cart (with
   *   per-line amounts distributed proportionally for the strikethrough UI).
   *   `free_item` on order scope frees 1 unit of the highest-priced item.
   *
   * Backend (`backend/app/routes/order.py`) mirrors this — it's authoritative.
   * This frontend version exists purely so the checkout preview matches what
   * the customer will actually be charged.
   */
  const voucherCalc = useMemo(() => {
    if (!selectedVoucher || cart.length === 0) return null;

    const perItem = new Map<string, { discountAmount: number; discountedUnits: number; discountLabel: string }>();
    const scope = selectedVoucher.target_scope || 'custom';
    const isItemScope = scope === 'product' || scope === 'category';
    const rewardValue = selectedVoucher.reward_value;
    const rewardType = selectedVoucher.reward_type;

    if (isItemScope) {
      const eligible = cart.filter(item => {
        if (!selectedVoucher.target_id) return false;
        if (scope === 'product') return item.productId === selectedVoucher.target_id;
        if (scope === 'category') return item.categoryId === selectedVoucher.target_id;
        return false;
      });
      if (eligible.length === 0) return { totalDiscount: 0, perItem };

      const unitPriceOf = (i: CartItem) => i.subtotal / i.quantity;
      const target = eligible.reduce((best, i) => (unitPriceOf(i) > unitPriceOf(best) ? i : best), eligible[0]);
      const unitPrice = unitPriceOf(target);

      let amount = 0;
      let label = '';
      if (rewardType === 'discount_percentage') {
        amount = unitPrice * (rewardValue / 100);
        label = `${rewardValue}% OFF`;
      } else if (rewardType === 'discount_fixed') {
        amount = Math.min(rewardValue, unitPrice);
        label = `RM ${rewardValue} OFF`;
      } else if (rewardType === 'free_item') {
        amount = unitPrice;
        label = 'FREE';
      }
      amount = Math.round(amount * 100) / 100;
      perItem.set(target.id, { discountAmount: amount, discountedUnits: 1, discountLabel: label });
      return { totalDiscount: amount, perItem };
    }

    // Order / custom scope
    const total = cart.reduce((s, i) => s + i.subtotal, 0);
    if (total === 0) return { totalDiscount: 0, perItem };

    if (rewardType === 'free_item') {
      const unitPriceOf = (i: CartItem) => i.subtotal / i.quantity;
      const target = cart.reduce((best, i) => (unitPriceOf(i) > unitPriceOf(best) ? i : best), cart[0]);
      const amount = Math.round(unitPriceOf(target) * 100) / 100;
      perItem.set(target.id, { discountAmount: amount, discountedUnits: 1, discountLabel: 'FREE' });
      return { totalDiscount: amount, perItem };
    }

    let totalDiscount = 0;
    let label = '';
    if (rewardType === 'discount_percentage') {
      totalDiscount = Math.min(total * (rewardValue / 100), total);
      label = `${rewardValue}% OFF`;
    } else if (rewardType === 'discount_fixed') {
      totalDiscount = Math.min(rewardValue, total);
      label = `RM ${rewardValue} OFF`;
    }
    totalDiscount = Math.round(totalDiscount * 100) / 100;

    for (const item of cart) {
      const proportion = item.subtotal / total;
      const amount = Math.round(Math.min(totalDiscount * proportion, item.subtotal) * 100) / 100;
      perItem.set(item.id, { discountAmount: amount, discountedUnits: item.quantity, discountLabel: label });
    }
    return { totalDiscount, perItem };
  }, [cart, selectedVoucher]);

  const voucherDiscount = voucherCalc?.totalDiscount || 0;
  const finalTotal = Math.max(cartTotal - voucherDiscount, 0);

  const itemDiscounts: ItemDiscountInfo[] = useMemo(() => {
    return cart.map(item => {
      const calc = voucherCalc?.perItem.get(item.id);
      if (!calc || calc.discountAmount === 0) {
        return {
          itemId: item.id,
          originalPrice: item.subtotal,
          discountedPrice: item.subtotal,
          discountAmount: 0,
          discountLabel: '',
          discountedUnits: 0,
          hasDiscount: false,
        };
      }
      return {
        itemId: item.id,
        originalPrice: item.subtotal,
        discountedPrice: Math.max(item.subtotal - calc.discountAmount, 0),
        discountAmount: calc.discountAmount,
        discountLabel: calc.discountLabel,
        discountedUnits: calc.discountedUnits,
        hasDiscount: true,
      };
    });
  }, [cart, voucherCalc]);

  // ============================================================================
  // ASYNC STORAGE OPERATIONS
  // ============================================================================

  const loadCart = useCallback(async () => {
    try {
      setIsLoading(true);
      const cartData = await AsyncStorage.getItem(CART_STORAGE_KEY);

      if (cartData) {
        const parsed: CartState = JSON.parse(cartData);
        setCart(parsed.items || []);
        setBranchId(parsed.branchId || null);
        setBranchName(parsed.branchName);
        setSelectedVoucherState(parsed.selectedVoucher || null);
      }
    } catch (error) {
      console.error('Failed to load cart from storage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveCart = useCallback((newCart: CartItem[], newBranchId: number | null, newBranchName?: string, newVoucher?: UserReward | null) => {
    // Debounce save to avoid excessive writes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const timeout = setTimeout(async () => {
      try {
        const cartState: CartState = {
          items: newCart,
          branchId: newBranchId,
          branchName: newBranchName,
          selectedVoucher: newVoucher,
        };
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState));
      } catch (error) {
        console.error('Failed to save cart to storage:', error);
      }
    }, DEBOUNCE_DELAY);

    saveTimeoutRef.current = timeout;
  }, []); // Empty deps - uses ref which doesn't cause re-renders

  // ============================================================================
  // CART ACTIONS
  // ============================================================================

  const addToCart = useCallback(async (
    product: any,
    selectedOptions: SelectedOption[],
    quantity: number,
    specialInstructions?: string
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      // Check if cart is full
      if (cart.length >= MAX_CART_ITEMS) {
        Alert.alert(
          'Cart Full',
          `Maximum ${MAX_CART_ITEMS} items allowed in cart`,
          [{ text: 'OK' }]
        );
        resolve(false);
        return;
      }

      // Branch lock validation
      if (branchId && branchId !== product.branch_id) {
        Alert.alert(
          'Different Branch',
          `Your cart contains items from ${branchName || 'another branch'}. Clear cart and add this item?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Clear & Add',
              onPress: () => {
                // Clear cart and add new item
                performAddToCart(product, selectedOptions, quantity, specialInstructions);
                resolve(true);
              },
            },
          ]
        );
        return;
      }

      // Add item to cart
      performAddToCart(product, selectedOptions, quantity, specialInstructions);
      resolve(true);
    });
  }, [cart, branchId, branchName]);

  // Helper: Check if two option arrays are identical
  const areOptionsEqual = useCallback((opts1: SelectedOption[], opts2: SelectedOption[]): boolean => {
    if (opts1.length !== opts2.length) return false;

    // Sort by optionId for consistent comparison
    const sorted1 = [...opts1].sort((a, b) => a.optionId.localeCompare(b.optionId));
    const sorted2 = [...opts2].sort((a, b) => a.optionId.localeCompare(b.optionId));

    return sorted1.every((opt, index) => opt.optionId === sorted2[index].optionId);
  }, []);

  // Helper: Find existing cart item with same product and options
  const findMatchingCartItem = useCallback((
    productId: string,
    selectedOptions: SelectedOption[],
    specialInstructions?: string
  ): CartItem | undefined => {
    return cart.find(item =>
      item.productId === productId &&
      areOptionsEqual(item.selectedOptions, selectedOptions) &&
      (item.specialInstructions || '') === (specialInstructions || '')
    );
  }, [cart, areOptionsEqual]);

  const performAddToCart = useCallback((
    product: any,
    selectedOptions: SelectedOption[],
    quantity: number,
    specialInstructions?: string
  ) => {
    const productId = product.id.toString();
    const basePrice = product.price;
    const optionsTotal = selectedOptions.reduce((sum, opt) => sum + opt.priceAdjustment, 0);
    const unitPrice = basePrice + optionsTotal;

    // Check for existing item with same product, options, and instructions
    const existingItem = findMatchingCartItem(productId, selectedOptions, specialInstructions);

    let newCart: CartItem[];

    if (existingItem) {
      // Combine quantities (cap at 10)
      const newQuantity = Math.min(existingItem.quantity + quantity, 10);
      const newSubtotal = Math.round(unitPrice * newQuantity * 100) / 100;

      newCart = cart.map(item =>
        item.id === existingItem.id
          ? { ...item, quantity: newQuantity, subtotal: newSubtotal }
          : item
      );
    } else {
      // Create new cart item
      const subtotal = Math.round(unitPrice * quantity * 100) / 100;
      const cartItem: CartItem = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId,
        productName: product.name,
        productPrice: basePrice,
        productImage: product.image_url,
        quantity,
        selectedOptions,
        subtotal,
        specialInstructions,
      };
      newCart = [...cart, cartItem];
    }

    const newBranchId = product.branch_id;
    const newBranchName = product.branch_name || branchName;

    setCart(newCart);
    setBranchId(newBranchId);
    setBranchName(newBranchName);
    saveCart(newCart, newBranchId, newBranchName, selectedVoucher);
  }, [cart, branchName, selectedVoucher, saveCart, findMatchingCartItem]);

  const updateCartItem = useCallback((itemId: string, updates: Partial<CartItem>) => {
    const newCart = cart.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, ...updates };

        // Recalculate subtotal if quantity or options changed
        if (updates.quantity !== undefined || updates.selectedOptions !== undefined) {
          const basePrice = updatedItem.productPrice;
          const optionsTotal = updatedItem.selectedOptions.reduce((sum, opt) => sum + opt.priceAdjustment, 0);
          updatedItem.subtotal = Math.round((basePrice + optionsTotal) * updatedItem.quantity * 100) / 100;
        }

        return updatedItem;
      }
      return item;
    });

    setCart(newCart);
    saveCart(newCart, branchId, branchName, selectedVoucher);
  }, [cart, branchId, branchName, selectedVoucher, saveCart]);

  const removeFromCart = useCallback((itemId: string) => {
    const newCart = cart.filter(item => item.id !== itemId);

    // Clear branch if cart is empty
    const newBranchId = newCart.length === 0 ? null : branchId;
    const newBranchName = newCart.length === 0 ? undefined : branchName;

    setCart(newCart);
    setBranchId(newBranchId);
    setBranchName(newBranchName);
    saveCart(newCart, newBranchId, newBranchName, null); // Clear voucher when cart is cleared
  }, [cart, branchId, branchName, saveCart]);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    // Validate quantity
    if (quantity < 1 || quantity > 10) {
      Alert.alert('Invalid Quantity', 'Quantity must be between 1 and 10');
      return;
    }

    updateCartItem(itemId, { quantity });
  }, [updateCartItem]);

  const clearCart = useCallback(() => {
    setCart([]);
    setBranchId(null);
    setBranchName(undefined);
    setSelectedVoucherState(null); // Clear selected voucher
    saveCart([], null, undefined, null);
    // Invalidate voucher cache to force fresh fetch on next cart
    voucherCacheRef.current = { data: null, timestamp: 0 };
  }, [saveCart]);

  const setSelectedVoucher = useCallback((voucher: UserReward | null) => {
    setSelectedVoucherState(voucher);
    saveCart(cart, branchId, branchName, voucher);
  }, [cart, branchId, branchName, saveCart]);

  // Helper: Get cached vouchers or fetch fresh
  const getCachedVouchers = useCallback(async (): Promise<any[]> => {
    const now = Date.now();
    const cache = voucherCacheRef.current;

    // Return cached data if still valid
    if (cache.data && (now - cache.timestamp) < VOUCHER_CACHE_TTL) {
      return cache.data;
    }

    // Fetch fresh data
    try {
      const activeRewards = await api.rewards.getMyRewards('active');
      if (Array.isArray(activeRewards)) {
        voucherCacheRef.current = { data: activeRewards, timestamp: now };
        return activeRewards;
      }
    } catch (error) {
      console.error('Failed to fetch vouchers:', error);
    }

    return cache.data || [];
  }, []);

  // Helper: Calculate discount for a voucher (memoizable logic)
  const calculateVoucherDiscount = useCallback((rewardData: any, cartItems: CartItem[], currentBranchId: number): number => {
    if (!rewardData) return 0;

    // Check branch restriction
    if (rewardData.branch_id && rewardData.branch_id !== currentBranchId.toString()) return 0;

    // Get applicable items
    let applicableItems = cartItems;
    if (rewardData.target_scope === 'product' && rewardData.target_id) {
      applicableItems = cartItems.filter(item => item.productId === rewardData.target_id);
      if (applicableItems.length === 0) return 0;
    }

    const applicableTotal = applicableItems.reduce((sum, item) => sum + item.subtotal, 0);
    if (applicableTotal === 0) return 0;

    switch (rewardData.reward_type) {
      case 'discount_percentage':
        return applicableTotal * ((rewardData.discount_value || 0) / 100);
      case 'discount_fixed':
        return Math.min(rewardData.discount_value || 0, applicableTotal);
      case 'free_item':
        return Math.min(...applicableItems.map(i => i.subtotal));
      default:
        return 0;
    }
  }, []);

  // Auto-apply the best available voucher (with debouncing and caching)
  const autoApplyBestVoucher = useCallback(async () => {
    if (cart.length === 0 || !branchId) return;

    // Clear any pending auto-apply
    if (autoApplyTimeoutRef.current) {
      clearTimeout(autoApplyTimeoutRef.current);
    }

    // Debounce the actual execution
    return new Promise<void>((resolve) => {
      autoApplyTimeoutRef.current = setTimeout(async () => {
        try {
          const activeRewards = await getCachedVouchers();
          if (activeRewards.length === 0) {
            resolve();
            return;
          }

          const now = new Date();
          let bestVoucher: any = null;
          let bestDiscount = 0;

          // Single pass to find best voucher
          for (const reward of activeRewards) {
            // Skip expired or non-active
            if (new Date(reward.expires_at) < now || reward.status !== 'active') continue;

            const discount = calculateVoucherDiscount(reward.reward, cart, branchId);
            if (discount > bestDiscount) {
              bestDiscount = discount;
              bestVoucher = reward;
            }
          }

          // Apply best voucher if found
          if (bestVoucher) {
            const voucherToApply: UserReward = {
              id: bestVoucher.id,
              redemption_code: bestVoucher.redemption_code,
              reward_type: bestVoucher.reward.reward_type,
              reward_value: bestVoucher.reward.discount_value || 0,
              reward_name: bestVoucher.reward.title,
              expires_at: bestVoucher.expires_at,
              status: bestVoucher.status,
              target_scope: bestVoucher.reward.target_scope,
              target_id: bestVoucher.reward.target_id,
              branch_id: bestVoucher.reward.branch_id,
            };

            setSelectedVoucherState(voucherToApply);
            saveCart(cart, branchId, branchName, voucherToApply);
          }
          resolve();
        } catch (error) {
          console.error('Failed to auto-apply voucher:', error);
          resolve();
        }
      }, AUTO_APPLY_DEBOUNCE);
    });
  }, [cart, branchId, branchName, saveCart, getCachedVouchers, calculateVoucherDiscount]);

  // Invalidate voucher cache (call when voucher is used/redeemed)
  const invalidateVoucherCache = useCallback(() => {
    voucherCacheRef.current = { data: null, timestamp: 0 };
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load cart on mount
  useEffect(() => {
    loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount, loadCart is stable

  // Clear cart on logout
  useEffect(() => {
    if (!user) {
      clearCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only depend on user, clearCart is stable

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (autoApplyTimeoutRef.current) {
        clearTimeout(autoApplyTimeoutRef.current);
      }
    };
  }, []); // Cleanup on unmount

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const contextValue: CartContextType = {
    cart,
    branchId,
    branchName,
    itemCount,
    cartTotal,
    selectedVoucher,
    voucherDiscount,
    finalTotal,
    isLoading,
    itemDiscounts,
    addToCart,
    updateCartItem,
    removeFromCart,
    updateQuantity,
    clearCart,
    loadCart,
    setSelectedVoucher,
    autoApplyBestVoucher,
    invalidateVoucherCache,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
