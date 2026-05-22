import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/constants/theme';

interface QuantitySelectorProps {
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  onQuantityChange,
  min = 1,
  max = 10,
  disabled = false,
}) => {
  const canDecrement = quantity > min && !disabled;
  const canIncrement = quantity < max && !disabled;

  const handleDecrement = () => {
    if (canDecrement) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onQuantityChange(quantity - 1);
    }
  };

  const handleIncrement = () => {
    if (canIncrement) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onQuantityChange(quantity + 1);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          !canDecrement && styles.buttonDisabled,
        ]}
        onPress={handleDecrement}
        disabled={!canDecrement}
        activeOpacity={0.7}
      >
        <Ionicons
          name="remove"
          size={20}
          color={canDecrement ? '#000000' : '#CCCCCC'}
        />
      </TouchableOpacity>

      <View style={styles.quantityContainer}>
        <Text style={styles.quantityText}>{quantity}</Text>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          !canIncrement && styles.buttonDisabled,
        ]}
        onPress={handleIncrement}
        disabled={!canIncrement}
        activeOpacity={0.7}
      >
        <Ionicons
          name="add"
          size={20}
          color={canIncrement ? '#000000' : '#CCCCCC'}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F1EC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  buttonDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  quantityContainer: {
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  quantityText: {
    fontSize: 18,
    fontFamily: Fonts.semibold,
    color: '#000000',
  },
});
