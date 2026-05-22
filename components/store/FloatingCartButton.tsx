import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCart } from '@/context/CartContext';
import { Fonts } from '@/constants/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export const FloatingCartButton: React.FC = () => {
  const router = useRouter();
  const { itemCount, cartTotal, cart } = useCart();
  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);
  const prevCount = useRef(itemCount);

  // Animate in/out based on cart items
  useEffect(() => {
    if (itemCount > 0) {
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withSpring(100, {
        damping: 20,
        stiffness: 90,
      });
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [itemCount]);

  // Bounce when item count increases
  useEffect(() => {
    if (itemCount > prevCount.current && prevCount.current > 0) {
      scale.value = withSequence(
        withSpring(1.08, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 150 }),
      );
    }
    prevCount.current = itemCount;
  }, [itemCount]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(tabs)/store/checkout');
  };

  if (cart.length === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Cart Icon with Badge */}
        <View style={styles.iconContainer}>
          <Ionicons name="cart" size={24} color="#000000" />
          {itemCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {itemCount > 99 ? '99+' : itemCount}
              </Text>
            </View>
          )}
        </View>

        {/* Cart Total */}
        <View style={styles.textContainer}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>RM {cartTotal.toFixed(2)}</Text>
        </View>

        {/* Arrow Icon */}
        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={24} color="#000000" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 70, // Above tab bar
    left: '5%',
    right: '5%',
    zIndex: 999,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCD259',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  iconContainer: {
    position: 'relative',
    marginRight: 16,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#E53935',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#000000',
    opacity: 0.6,
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#000000',
  },
  arrowContainer: {
    marginLeft: 'auto',
  },
});
