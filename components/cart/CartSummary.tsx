import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Fonts } from '@/constants/theme';

interface CartSummaryProps {
  subtotal: number;
  discount?: number;
  total: number;
  showDivider?: boolean;
}

export const CartSummary: React.FC<CartSummaryProps> = ({
  subtotal,
  discount = 0,
  total,
  showDivider = true,
}) => {
  return (
    <View style={styles.container}>
      {/* Subtotal */}
      <View style={styles.row}>
        <Text style={styles.label}>Subtotal</Text>
        <Text style={styles.value}>RM {subtotal.toFixed(2)}</Text>
      </View>

      {/* Discount (if applicable) */}
      {discount > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>Discount</Text>
          <Text style={[styles.value, styles.discount]}>
            -RM {discount.toFixed(2)}
          </Text>
        </View>
      )}

      {/* Divider */}
      {showDivider && <View style={styles.divider} />}

      {/* Total */}
      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>RM {total.toFixed(2)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    color: '#666666',
  },
  value: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: '#000000',
  },
  discount: {
    color: '#27AE60',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#000000',
  },
  totalValue: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#000000',
  },
});
