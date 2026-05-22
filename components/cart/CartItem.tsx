import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CartItem as CartItemType, useCart } from '@/context/CartContext';
import { API_URL } from '@/services/api';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/constants/theme';

interface CartItemProps {
  item: CartItemType;
}

export const CartItem: React.FC<CartItemProps> = ({ item }) => {
  const { removeFromCart } = useCart();

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeFromCart(item.id);
  };

  const imageUri = item.productImage
    ? item.productImage.startsWith('http')
      ? item.productImage
      : `${API_URL}${item.productImage}`
    : 'https://via.placeholder.com/100';

  return (
    <View style={styles.container}>
      {/* Product Image */}
      <Image source={{ uri: imageUri }} style={styles.image} />

      {/* Product Details */}
      <View style={styles.details}>
        {/* Product Name */}
        <Text style={styles.productName} numberOfLines={2}>
          {item.productName}
        </Text>

        {/* Selected Options */}
        {item.selectedOptions.length > 0 && (
          <Text style={styles.optionsText} numberOfLines={2}>
            {item.selectedOptions.map((opt) => opt.optionName).join(' / ')}
          </Text>
        )}

        {/* Price Row */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>RM {item.subtotal.toFixed(2)}</Text>

          {/* Delete Button */}
          <TouchableOpacity onPress={handleRemove} style={styles.deleteButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="trash-outline" size={20} color="#EB5757" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quantity Badge */}
      <View style={styles.quantityBadge}>
        <Text style={styles.quantityText}>× {item.quantity}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  image: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  details: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
    color: '#000000',
    marginBottom: 6,
  },
  optionsText: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: '#000000',
  },
  deleteButton: {
    padding: 4,
  },
  quantityBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  quantityText: {
    fontSize: 14,
    fontFamily: Fonts.semibold,
    color: '#666666',
  },
});
