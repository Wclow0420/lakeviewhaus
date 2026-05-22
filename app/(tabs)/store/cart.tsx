import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CartItem } from '@/components/cart/CartItem';
import { useCart } from '@/context/CartContext';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/constants/theme';

export default function CartScreen() {
  const router = useRouter();
  const { cart, itemCount, cartTotal, clearCart } = useCart();

  const handleClearCart = () => {
    Alert.alert('Clear Cart', 'Remove all items from cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          clearCart();
        },
      },
    ]);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Add items to cart before checkout');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(tabs)/store/checkout');
  };

  const handleBrowseMenu = () => {
    router.back();
  };

  // Empty state
  if (cart.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#000000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Cart</Text>
            <View style={styles.headerRight} />
          </View>

          {/* Empty State */}
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={80} color="#CCCCCC" />
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySubtitle}>Add items from the menu to get started</Text>
            <TouchableOpacity style={styles.browseButton} onPress={handleBrowseMenu}>
              <Text style={styles.browseButtonText}>Browse Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cart ({itemCount})</Text>
          <TouchableOpacity onPress={handleClearCart} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={22} color="#EB5757" />
          </TouchableOpacity>
        </View>

        {/* Cart Items List */}
        <FlatList
          data={cart}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CartItem item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Sticky Bottom Section */}
        <View style={styles.stickyBottom}>
          {/* Summary */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>RM {cartTotal.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>RM {cartTotal.toFixed(2)}</Text>
          </View>

          {/* Checkout Button */}
          <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout} activeOpacity={0.8}>
            <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#000000',
  },
  headerRight: {
    width: 40,
  },
  clearButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  stickyBottom: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666666',
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
    color: '#000000',
  },
  totalLabel: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#000000',
  },
  totalValue: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: '#000000',
  },
  checkoutButton: {
    backgroundColor: '#8B2F2F',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  checkoutButtonText: {
    fontSize: 17,
    fontFamily: Fonts.semibold,
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: '#000000',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
  },
  browseButton: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  browseButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
    color: '#FFFFFF',
  },
});
