import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseModal } from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { PrizeFormModal } from './PrizeFormModal';
import { api } from '@/services/api';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface LuckyDraw {
  id: number;
  name: string;
  prizes?: Prize[];
}

interface Prize {
  id: number;
  name: string;
  prize_type: 'points' | 'reward' | 'voucher';
  probability_weight: number;
  stock_quantity?: number;
  stock_remaining?: number;
  points_amount?: number;
  reward_id?: number;
  reward?: any;
  voucher_discount_percent?: number;
  voucher_discount_amount?: number;
  voucher_description?: string;
  display_order: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  draw: LuckyDraw | null;
}

export function PrizeManagerModal({ visible, onClose, draw }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPrizeForm, setShowPrizeForm] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);

  const [isListVisible, setIsListVisible] = useState(true);

  useEffect(() => {
    if (visible && draw) {
      loadPrizes();
      setIsListVisible(true); // Reset visibility when opened
    }
  }, [visible, draw]);

  const loadPrizes = async () => {
    if (!draw) return;

    setLoading(true);
    try {
      const response = await api.get(`/merchant/lucky-draws/${draw.id}`);
      setPrizes(response.prizes || []);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load prizes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPrizes();
  };

  const handleAddPrize = () => {
    Haptics.selectionAsync();
    setEditingPrize(null);
    // Close list first, then open form
    setIsListVisible(false);
    setTimeout(() => {
      setShowPrizeForm(true);
    }, 400);
  };

  const handleEditPrize = (prize: Prize) => {
    Haptics.selectionAsync();
    setEditingPrize(prize);
    // Close list first, then open form
    setIsListVisible(false);
    setTimeout(() => {
      setShowPrizeForm(true);
    }, 400);
  };

  const handleDeletePrize = (prize: Prize) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Delete Prize',
      `Are you sure you want to delete "${prize.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!draw) return;

            try {
              await api.delete(`/merchant/lucky-draws/${draw.id}/prizes/${prize.id}`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadPrizes();
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete prize');
            }
          },
        },
      ]
    );
  };

  const getPrizeTypeIcon = (type: string) => {
    switch (type) {
      case 'points':
        return 'star';
      case 'reward':
        return 'gift';
      case 'voucher':
        return 'pricetag';
      default:
        return 'help';
    }
  };

  const getPrizeTypeColor = (type: string) => {
    switch (type) {
      case 'points':
        return theme.primary;
      case 'reward':
        return '#FF6B6B';
      case 'voucher':
        return '#4ECDC4';
      default:
        return theme.icon;
    }
  };

  const getPrizeValue = (prize: Prize) => {
    switch (prize.prize_type) {
      case 'points':
        return `${prize.points_amount} points`;
      case 'reward':
        return prize.reward?.title || `Reward #${prize.reward_id}`;
      case 'voucher':
        if (prize.voucher_discount_percent) {
          return `${prize.voucher_discount_percent}% off`;
        } else if (prize.voucher_discount_amount) {
          return `$${prize.voucher_discount_amount} off`;
        }
        return 'Discount voucher';
      default:
        return 'Unknown';
    }
  };

  const renderPrizeItem = ({ item }: { item: Prize }) => {
    const typeColor = getPrizeTypeColor(item.prize_type);
    const isOutOfStock = item.stock_remaining !== null && item.stock_remaining !== undefined && item.stock_remaining === 0;

    return (
      <View style={[
        styles.prizeCard,
        { backgroundColor: theme.card, borderColor: theme.border },
        isOutOfStock && { borderColor: theme.error, opacity: 0.7 }
      ]}>
        <View style={styles.prizeHeader}>
          <View style={[styles.typeIconBadge, { backgroundColor: typeColor + '20' }]}>
            <Ionicons name={getPrizeTypeIcon(item.prize_type) as any} size={24} color={typeColor} />
          </View>

          <View style={styles.prizeInfo}>
            <Text style={[styles.prizeName, { color: theme.text }]}>{item.name}</Text>
            <Text style={[styles.prizeValue, { color: theme.icon }]}>{getPrizeValue(item)}</Text>
          </View>
        </View>

        <View style={styles.prizeDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="analytics-outline" size={16} color={theme.icon} />
            <Text style={[styles.detailText, { color: theme.icon }]}>Weight: {item.probability_weight}</Text>
          </View>

          {item.stock_quantity !== null && item.stock_quantity !== undefined && (
            <View style={styles.detailRow}>
              <Ionicons name="cube-outline" size={16} color={isOutOfStock ? theme.error : theme.icon} />
              <Text style={[
                styles.detailText,
                { color: isOutOfStock ? theme.error : theme.icon },
                isOutOfStock && { fontWeight: '600' }
              ]}>
                Stock: {item.stock_remaining} / {item.stock_quantity}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Ionicons name="reorder-two-outline" size={16} color={theme.icon} />
            <Text style={[styles.detailText, { color: theme.icon }]}>Order: {item.display_order}</Text>
          </View>
        </View>

        <View style={[styles.prizeActions, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditPrize(item)}
          >
            <Ionicons name="create-outline" size={20} color={theme.primary} />
            <Text style={[styles.actionButtonText, { color: theme.primary }]}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeletePrize(item)}
          >
            <Ionicons name="trash-outline" size={20} color={theme.error} />
            <Text style={[styles.actionButtonText, { color: theme.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>

        {isOutOfStock && (
          <View style={[styles.outOfStockBadge, { backgroundColor: theme.error }]}>
            <Text style={styles.outOfStockText}>OUT OF STOCK</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <BaseModal
        visible={visible && isListVisible}
        onClose={onClose}
        title={`Prizes - ${draw?.name || ''}`}
        scrollable={false}
      >
        <View style={styles.container}>
          {loading && prizes.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.icon }]}>Loading prizes...</Text>
            </View>
          ) : prizes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={64} color={theme.icon} />
              <Text style={[styles.emptyText, { color: theme.icon }]}>No prizes yet</Text>
              <Text style={[styles.emptySubtext, { color: theme.icon }]}>
                Add prizes to this lucky draw to get started
              </Text>
            </View>
          ) : (
            <FlatList
              style={{ flex: 1 }}
              data={prizes.sort((a, b) => a.display_order - b.display_order)}
              renderItem={renderPrizeItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.primary}
                />
              }
            />
          )}

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Button
              variant="primary"
              title="Add Prize"
              onPress={handleAddPrize}
            />
          </View>
        </View>
      </BaseModal>

      <PrizeFormModal
        visible={showPrizeForm}
        onClose={() => {
          setShowPrizeForm(false);
          setEditingPrize(null);
          loadPrizes();
          // Re-open list after form closes
          setTimeout(() => {
            setIsListVisible(true);
          }, 400);
        }}
        draw={draw}
        prize={editingPrize}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  listContent: {
    padding: 16,
  },
  prizeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  prizeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prizeInfo: {
    flex: 1,
  },
  prizeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  prizeValue: {
    fontSize: 14,
  },
  prizeDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
  },
  prizeActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  outOfStockText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
});
