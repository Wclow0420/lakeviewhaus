import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseModal } from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/services/api';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface LuckyDraw {
  id: string;
  name: string;
}

interface Prize {
  id: string;
  name: string;
  prize_type: 'points' | 'reward';
  probability_weight: number;
  stock_quantity?: number;
  points_amount?: number;
  reward_id?: string;
  display_order: number;
}

interface Reward {
  id: string;
  title: string;
  points_cost: number;
  is_active: boolean;
  image_url?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  draw: LuckyDraw | null;
  prize?: Prize | null;
}

const PRIZE_TYPES = [
  { id: 'points', label: 'Points', icon: 'star-outline', description: 'Award loyalty points' },
  { id: 'reward', label: 'Reward', icon: 'gift-outline', description: 'Give a specific active reward' },
];

export function PrizeFormModal({ visible, onClose, draw, prize }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme as keyof typeof Colors];
  const isEditing = !!prize;

  const [prizeType, setPrizeType] = useState<'points' | 'reward'>('points');
  const [name, setName] = useState('');
  const [probabilityWeight, setProbabilityWeight] = useState('1');
  const [stockQuantity, setStockQuantity] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');

  // Points type
  const [pointsAmount, setPointsAmount] = useState('');

  // Reward type
  const [rewardId, setRewardId] = useState('');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && prize) {
      // Editing existing prize
      // @ts-ignore - allow legacy types if present but force cast
      setPrizeType(prize.prize_type === 'voucher' ? 'points' : prize.prize_type);
      setName(prize.name);
      setProbabilityWeight(prize.probability_weight.toString());
      setStockQuantity(prize.stock_quantity?.toString() || '');
      setDisplayOrder(prize.display_order.toString());

      if (prize.prize_type === 'points') {
        setPointsAmount(prize.points_amount?.toString() || '');
      } else if (prize.prize_type === 'reward') {
        setRewardId(prize.reward_id || '');
      }
    } else if (visible) {
      // Creating new prize
      resetForm();
    }
  }, [visible, prize]);

  useEffect(() => {
    if (visible && prizeType === 'reward') {
      loadRewards();
    }
  }, [visible, prizeType]);

  const resetForm = () => {
    setPrizeType('points');
    setName('');
    setProbabilityWeight('1');
    setStockQuantity('');
    setDisplayOrder('0');
    setPointsAmount('');
    setRewardId('');
  };

  const loadRewards = async () => {
    setLoadingRewards(true);
    try {
      const response = await api.rewards.getRewards({ active_only: true });
      setRewards(response);
    } catch (error) {
      console.error('Failed to load rewards:', error);
    } finally {
      setLoadingRewards(false);
    }
  };

  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a prize name');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    }

    const weight = parseInt(probabilityWeight);
    if (isNaN(weight) || weight < 1) {
      Alert.alert('Validation Error', 'Probability weight must be at least 1');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    }

    if (stockQuantity && (isNaN(parseInt(stockQuantity)) || parseInt(stockQuantity) < 0)) {
      Alert.alert('Validation Error', 'Stock quantity must be a valid number (0 or greater)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    }

    // Type-specific validation
    if (prizeType === 'points') {
      if (!pointsAmount || isNaN(parseInt(pointsAmount)) || parseInt(pointsAmount) < 1) {
        Alert.alert('Validation Error', 'Points amount must be at least 1');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return false;
      }
    } else if (prizeType === 'reward') {
      if (!rewardId) {
        Alert.alert('Validation Error', 'Please select a reward');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!draw || !validateForm()) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    const payload: any = {
      prize_type: prizeType,
      name: name.trim(),
      probability_weight: parseInt(probabilityWeight),
      stock_quantity: stockQuantity ? parseInt(stockQuantity) : undefined,
      display_order: parseInt(displayOrder),
    };

    // Add type-specific fields
    if (prizeType === 'points') {
      payload.points_amount = parseInt(pointsAmount);
    } else if (prizeType === 'reward') {
      payload.reward_id = rewardId;
    }

    try {
      if (prize) {
        // Update existing prize
        await api.put(`/merchant/lucky-draws/${draw.id}/prizes/${prize.id}`, payload);
      } else {
        // Create new prize
        await api.post(`/merchant/lucky-draws/${draw.id}/prizes`, payload);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success',
        prize ? 'Prize updated successfully' : 'Prize added successfully'
      );
      onClose();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save prize');
    } finally {
      setLoading(false);
    }
  };

  const handlePrizeTypeChange = (type: 'points' | 'reward') => {
    if (isEditing) return; // Locked when editing
    Haptics.selectionAsync();
    setPrizeType(type);

    // Clear type-specific data when switching
    if (type === 'points') {
      setRewardId('');
      if (!name) setName('Bonus Points');
    } else {
      setPointsAmount('');
      if (!name) setName('Mystery Gift');
    }
  };

  // Handler for reward selection to auto-fill name
  const handleRewardSelect = (r: Reward) => {
    Haptics.selectionAsync();
    setRewardId(r.id);
    setName(r.title); // Auto-fill name
  };

  const renderPrizeTypeSelector = () => (
    <View style={styles.section}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Prize Type</Text>
        {isEditing && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="lock-closed-outline" size={14} color={theme.icon} style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 12, color: theme.icon }}>Cannot change</Text>
          </View>
        )}
      </View>

      <View style={[styles.typeGrid, isEditing && { opacity: 0.6 }]}>
        {PRIZE_TYPES.map(type => {
          const isSelected = prizeType === type.id;
          return (
            <TouchableOpacity
              key={type.id}
              disabled={isEditing}
              style={[
                styles.typeCard,
                {
                  borderColor: isSelected ? theme.primary : theme.border,
                  backgroundColor: isSelected ? `${theme.primary}10` : 'transparent'
                }
              ]}
              onPress={() => handlePrizeTypeChange(type.id as 'points' | 'reward')}
            >
              <Ionicons
                name={type.icon as any}
                size={24}
                color={isSelected ? theme.primary : theme.icon}
              />
              <Text style={[styles.typeLabel, { color: theme.text }]}>{type.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderTypeSpecificFields = () => {
    if (prizeType === 'points') {
      return (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Details</Text>
          <Input
            label="Points Amount *"
            value={pointsAmount}
            onChangeText={setPointsAmount}
            placeholder="Enter points amount"
            keyboardType="number-pad"
          />
        </View>
      );
    } else if (prizeType === 'reward') {
      return (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Reward</Text>
          {loadingRewards ? (
            <View style={[styles.loadingRewards, { backgroundColor: theme.card }]}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={styles.loadingText}>Loading rewards...</Text>
            </View>
          ) : rewards.length === 0 ? (
            <View style={[styles.noRewards, { backgroundColor: theme.card }]}>
              <Text style={styles.noRewardsText}>
                No active rewards found. Create a reward first.
              </Text>
            </View>
          ) : (
            <View style={styles.rewardsList}>
              {rewards.map((reward) => (
                <TouchableOpacity
                  key={reward.id}
                  style={[
                    styles.rewardOption,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    rewardId === reward.id && {
                      borderColor: theme.primary,
                      backgroundColor: theme.primary + '10'
                    },
                  ]}
                  onPress={() => handleRewardSelect(reward)}
                >
                  <View style={styles.rewardOptionContent}>
                    <Text style={[styles.rewardOptionTitle, { color: theme.text }]}>{reward.title}</Text>
                    <Text style={styles.rewardOptionPoints}>{reward.points_cost} pts</Text>
                  </View>
                  {rewardId === reward.id && (
                    <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      );
    }
    return null;
  };

  if (!draw) {
    return null;
  }

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={prize ? 'Edit Prize' : 'Add Prize'}
      scrollable={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            {renderPrizeTypeSelector()}

            {renderTypeSpecificFields()}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Settings</Text>

              <Input
                label="Prize Name *"
                value={name}
                onChangeText={setName}
                placeholder="Enter prize name"
              />

              <View style={styles.row}>
                <View style={[styles.field, styles.halfField]}>
                  <Input
                    label="Probability Weight"
                    value={probabilityWeight}
                    onChangeText={setProbabilityWeight}
                    placeholder="1"
                    keyboardType="number-pad"
                  />
                  <Text style={[styles.hint, { color: theme.icon }]}>Higher = more likely</Text>
                </View>

                <View style={[styles.field, styles.halfField]}>
                  <Input
                    label="Display Order"
                    value={displayOrder}
                    onChangeText={setDisplayOrder}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Input
                  label="Stock Quantity (Optional)"
                  value={stockQuantity}
                  onChangeText={setStockQuantity}
                  placeholder="Unlimited (leave empty)"
                  keyboardType="number-pad"
                />
                <Text style={[styles.hint, { color: theme.icon }]}>Leave empty for unlimited stock</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <View style={styles.buttonRow}>
            <View style={styles.buttonHalf}>
              <Button variant="outline" title="Cancel" onPress={onClose} disabled={loading} />
            </View>
            <View style={styles.buttonHalf}>
              <Button
                variant="primary"
                title={prize ? 'Update' : 'Add Prize'}
                onPress={handleSubmit}
                loading={loading}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  field: {
    marginBottom: 20,
  },
  halfField: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 4,
  },
  // Type Cards
  typeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Rewards List
  loadingRewards: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
  },
  noRewards: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  noRewardsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  rewardsList: {
    gap: 8,
  },
  rewardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 2,
    borderRadius: 8,
  },
  rewardOptionContent: {
    flex: 1,
  },
  rewardOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  rewardOptionPoints: {
    fontSize: 13,
    color: '#999',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonHalf: {
    flex: 1,
  },
});
