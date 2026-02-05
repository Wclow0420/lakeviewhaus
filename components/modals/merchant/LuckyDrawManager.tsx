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
import { LuckyDrawFormModal } from './LuckyDrawFormModal';
import { PrizeManagerModal } from './PrizeManagerModal';
import { LuckyDrawStatsModal } from './LuckyDrawStatsModal';
import { api } from '@/services/api';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface LuckyDraw {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
  points_cost: number;
  is_active: boolean;
  is_day7_draw: boolean;
  max_daily_spins_per_user?: number;
  total_available_spins?: number;
  remaining_spins?: number;
  start_date?: string;
  end_date?: string;
  prizes?: Prize[];
}

interface Prize {
  id: number;
  name: string;
  prize_type: 'points' | 'reward' | 'voucher';
  probability_weight: number;
  stock_remaining?: number;
  stock_quantity?: number;
  display_order: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LuckyDrawManager({ visible, onClose }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [draws, setDraws] = useState<LuckyDraw[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDraw, setSelectedDraw] = useState<LuckyDraw | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  useEffect(() => {
    if (visible) {
      loadDraws();
    }
  }, [visible]);

  const loadDraws = async () => {
    setLoading(true);
    try {
      const response = await api.get('/merchant/lucky-draws');
      console.log('[LuckyDrawManager] Response:', response);
      setDraws(response.lucky_draws || []);
    } catch (error: any) {
      console.error('[LuckyDrawManager] Error:', error);
      console.error('[LuckyDrawManager] Error response:', error.response);
      console.error('[LuckyDrawManager] Error data:', error.response?.data);
      Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to load lucky draws');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDraws();
  };

  const handleCreate = () => {
    Haptics.selectionAsync();
    setSelectedDraw(null);
    // Close parent modal first, then open child after delay
    onClose();
    setTimeout(() => {
      setShowCreateModal(true);
    }, 300);
  };

  const handleEdit = (draw: LuckyDraw) => {
    Haptics.selectionAsync();
    setSelectedDraw(draw);
    onClose();
    setTimeout(() => {
      setShowCreateModal(true);
    }, 300);
  };

  const handleManagePrizes = (draw: LuckyDraw) => {
    Haptics.selectionAsync();
    setSelectedDraw(draw);
    onClose();
    setTimeout(() => {
      setShowPrizeModal(true);
    }, 300);
  };

  const handleViewStats = (draw: LuckyDraw) => {
    Haptics.selectionAsync();
    setSelectedDraw(draw);
    onClose();
    setTimeout(() => {
      setShowStatsModal(true);
    }, 300);
  };

  const handleToggleActive = async (draw: LuckyDraw) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await api.put(`/merchant/lucky-draws/${draw.id}`, {
        is_active: !draw.is_active,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadDraws();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDelete = (draw: LuckyDraw) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Delete Lucky Draw',
      `Are you sure you want to delete "${draw.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/merchant/lucky-draws/${draw.id}`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadDraws();
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete lucky draw');
            }
          },
        },
      ]
    );
  };

  const renderDrawItem = ({ item }: { item: LuckyDraw }) => (
    <View style={[styles.drawCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.drawHeader}>
        <View style={styles.drawHeaderLeft}>
          <Text style={[styles.drawName, { color: theme.text }]}>{item.name}</Text>
          <View style={styles.badges}>
            {item.is_day7_draw && (
              <View style={[styles.day7Badge, { backgroundColor: theme.primary }]}>
                <Text style={styles.day7BadgeText}>Day 7</Text>
              </View>
            )}
            <View style={[styles.statusBadge, item.is_active ? styles.activeBadge : styles.inactiveBadge]}>
              <Text style={styles.statusBadgeText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => handleToggleActive(item)}
          style={styles.toggleButton}
        >
          <Ionicons
            name={item.is_active ? 'toggle' : 'toggle-outline'}
            size={32}
            color={item.is_active ? theme.primary : theme.icon}
          />
        </TouchableOpacity>
      </View>

      {item.description && (
        <Text style={[styles.drawDescription, { color: theme.icon }]}>{item.description}</Text>
      )}

      <View style={styles.drawInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="trophy-outline" size={16} color={theme.icon} />
          <Text style={[styles.infoText, { color: theme.icon }]}>
            {item.points_cost === 0 ? 'Free' : `${item.points_cost} points`}
          </Text>
        </View>

        {item.remaining_spins !== null && item.remaining_spins !== undefined && (
          <View style={styles.infoRow}>
            <Ionicons name="reload-outline" size={16} color={theme.icon} />
            <Text style={[styles.infoText, { color: theme.icon }]}>
              {item.remaining_spins} / {item.total_available_spins} spins left
            </Text>
          </View>
        )}

        {item.prizes && (
          <View style={styles.infoRow}>
            <Ionicons name="gift-outline" size={16} color={theme.icon} />
            <Text style={[styles.infoText, { color: theme.icon }]}>{item.prizes.length} prizes</Text>
          </View>
        )}
      </View>

      <View style={[styles.actionButtons, { borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleManagePrizes(item)}
        >
          <Ionicons name="gift" size={20} color={theme.primary} />
          <Text style={[styles.actionButtonText, { color: theme.primary }]}>Prizes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleViewStats(item)}
        >
          <Ionicons name="stats-chart" size={20} color={theme.primary} />
          <Text style={[styles.actionButtonText, { color: theme.primary }]}>Stats</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEdit(item)}
        >
          <Ionicons name="create" size={20} color={theme.primary} />
          <Text style={[styles.actionButtonText, { color: theme.primary }]}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash" size={20} color={theme.error} />
          <Text style={[styles.actionButtonText, { color: theme.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <BaseModal
        visible={visible}
        onClose={onClose}
        title="Lucky Draw Manager"
        scrollable={false}
      >
        <View style={styles.container}>
          {loading && draws.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.icon }]}>Loading lucky draws...</Text>
            </View>
          ) : draws.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="gift-outline" size={64} color={theme.icon} />
              <Text style={[styles.emptyText, { color: theme.icon }]}>No lucky draws yet</Text>
              <Text style={[styles.emptySubtext, { color: theme.icon }]}>
                Create your first lucky draw to get started
              </Text>
            </View>
          ) : (
            <FlatList
              data={draws}
              renderItem={renderDrawItem}
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
              title="Create Lucky Draw"
              onPress={handleCreate}
            />
          </View>
        </View>
      </BaseModal>

      <LuckyDrawFormModal
        visible={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          loadDraws();
        }}
        draw={selectedDraw}
      />

      <PrizeManagerModal
        visible={showPrizeModal}
        onClose={() => {
          setShowPrizeModal(false);
          loadDraws();
        }}
        draw={selectedDraw}
      />

      <LuckyDrawStatsModal
        visible={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        draw={selectedDraw}
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
  drawCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  drawHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  drawHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  drawName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  day7Badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  day7BadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  activeBadge: {
    backgroundColor: '#4CAF50',
  },
  inactiveBadge: {
    backgroundColor: '#666',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  toggleButton: {
    padding: 4,
  },
  drawDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  drawInfo: {
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
});
