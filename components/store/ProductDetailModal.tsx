import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { QuantitySelector } from './QuantitySelector';
import { OptionGroupSelector } from './OptionGroupSelector';
import { useCart, SelectedOption } from '@/context/CartContext';
import { API_URL } from '@/services/api';
import { Colors, Fonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ProductDetailModalProps {
  visible: boolean;
  onClose: () => void;
  product: any | null;
  editMode?: boolean;
  cartItemId?: string;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  visible,
  onClose,
  product,
  editMode = false,
  cartItemId,
}) => {
  const { addToCart, updateCartItem, cart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(false);

  // Load existing cart item data in edit mode
  useEffect(() => {
    if (editMode && cartItemId && visible) {
      const existingItem = cart.find((item) => item.id === cartItemId);
      if (existingItem) {
        setQuantity(existingItem.quantity);

        // Reconstruct selected options map
        const optionsMap = new Map<string, string[]>();
        existingItem.selectedOptions.forEach((opt) => {
          const groupOptions = optionsMap.get(opt.groupId) || [];
          groupOptions.push(opt.optionId);
          optionsMap.set(opt.groupId, groupOptions);
        });
        setSelectedOptions(optionsMap);
      }
    } else if (visible) {
      // Reset for new item
      setQuantity(1);
      setSelectedOptions(new Map());
    }
  }, [visible, editMode, cartItemId, cart]);

  // Calculate current price
  const currentPrice = useMemo(() => {
    if (!product) return 0;

    let total = product.price;

    // Add selected options prices
    product.options?.forEach((group: any) => {
      const groupSelections = selectedOptions.get(group.id) || [];
      groupSelections.forEach((optionId) => {
        const option = group.items.find((item: any) => item.id === optionId);
        if (option) {
          total += option.price_adjustment;
        }
      });
    });

    return total * quantity;
  }, [product, selectedOptions, quantity]);

  // Validation
  const canAddToCart = useMemo(() => {
    if (!product) return false;

    // Check all required option groups have selections
    const requiredGroupsMet = product.options?.every((group: any) => {
      if (group.min_selection > 0) {
        const selections = selectedOptions.get(group.id) || [];
        return selections.length >= group.min_selection;
      }
      return true;
    });

    return requiredGroupsMet;
  }, [product, selectedOptions]);

  const handleOptionToggle = (groupId: string, optionId: string, maxSelection: number) => {
    const newMap = new Map(selectedOptions);
    const currentSelections = newMap.get(groupId) || [];

    if (maxSelection === 1) {
      // Radio: Replace selection
      newMap.set(groupId, [optionId]);
    } else {
      // Checkbox: Toggle selection
      const index = currentSelections.indexOf(optionId);
      if (index >= 0) {
        // Remove selection
        const updated = currentSelections.filter((id) => id !== optionId);
        if (updated.length === 0) {
          newMap.delete(groupId);
        } else {
          newMap.set(groupId, updated);
        }
      } else {
        // Add selection if under max
        if (currentSelections.length < maxSelection) {
          newMap.set(groupId, [...currentSelections, optionId]);
        }
      }
    }

    setSelectedOptions(newMap);
  };

  const handleAddToCart = async () => {
    if (!canAddToCart) {
      Alert.alert('Required Options', 'Please select all required options');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Build selected options array
    const optionsArray: SelectedOption[] = [];
    product.options?.forEach((group: any) => {
      const groupSelections = selectedOptions.get(group.id) || [];
      groupSelections.forEach((optionId) => {
        const option = group.items.find((item: any) => item.id === optionId);
        if (option) {
          optionsArray.push({
            groupId: group.id,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            priceAdjustment: option.price_adjustment,
          });
        }
      });
    });

    try {
      if (editMode && cartItemId) {
        // Update existing cart item
        updateCartItem(cartItemId, {
          quantity,
          selectedOptions: optionsArray,
          subtotal: currentPrice,
        });
      } else {
        // Add new item to cart
        const success = await addToCart(product, optionsArray, quantity);
        if (!success) return;
      }

      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to add to cart');
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  const imageUri = product.image_url
    ? product.image_url.startsWith('http')
      ? product.image_url
      : `${API_URL}${product.image_url}`
    : 'https://via.placeholder.com/300';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header with Close Button */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Product Image Section */}
          <View style={styles.imageSection}>
            <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="contain" />
          </View>

          {/* Content Container (White rounded) */}
          <View style={styles.contentContainer}>
            {/* Scrollable Content */}
            <ScrollView
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollContentContainer}
              showsVerticalScrollIndicator={false}
            >
              {/* Product Title */}
              <Text style={styles.productTitle}>{product.name}</Text>

              {/* Option Groups */}
              {product.options && product.options.length > 0 && (
                <View style={styles.optionsSection}>
                  {product.options.map((group: any) => (
                    <OptionGroupSelector
                      key={group.id}
                      group={group}
                      selectedOptionIds={selectedOptions.get(group.id) || []}
                      onOptionToggle={(optionId) =>
                        handleOptionToggle(group.id, optionId, group.max_selection)
                      }
                    />
                  ))}
                </View>
              )}

              {/* Product Description */}
              {product.description && (
                <View style={styles.descriptionSection}>
                  <Text style={styles.descriptionTitle}>Product Description</Text>
                  <Text style={styles.descriptionText}>{product.description}</Text>
                </View>
              )}

              {/* Bottom padding for sticky footer */}
              <View style={{ height: 120 }} />
            </ScrollView>

            {/* Sticky Bottom Section */}
            <View style={styles.stickyBottom}>
              <View style={styles.quantityPriceRow}>
                <QuantitySelector
                  quantity={quantity}
                  onQuantityChange={setQuantity}
                  min={1}
                  max={10}
                />
                <Text style={styles.totalPrice}>RM {currentPrice.toFixed(2)}</Text>
              </View>

              <TouchableOpacity
                style={[styles.addButton, (!canAddToCart || loading) && styles.addButtonDisabled]}
                onPress={handleAddToCart}
                disabled={!canAddToCart || loading}
                activeOpacity={0.8}
              >
                <Text style={styles.addButtonText}>
                  {loading ? 'Adding...' : editMode ? 'Update Cart' : 'Add To Cart'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageSection: {
    height: SCREEN_HEIGHT * 0.35,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  productTitle: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: '#000000',
    marginBottom: 20,
  },
  optionsSection: {
    marginBottom: 20,
  },
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionTitle: {
    fontSize: 18,
    fontFamily: Fonts.semibold,
    color: '#000000',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666666',
  },
  stickyBottom: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  quantityPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  totalPrice: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#000000',
  },
  addButton: {
    backgroundColor: Colors.light.primary,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  addButtonText: {
    fontSize: 17,
    fontFamily: Fonts.semibold,
    color: Colors.light.secondary,
  },
});
