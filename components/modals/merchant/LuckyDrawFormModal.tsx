import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BaseModal } from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
}

interface Props {
  visible: boolean;
  onClose: () => void;
  draw?: LuckyDraw | null;
}

export function LuckyDrawFormModal({ visible, onClose, draw }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pointsCost, setPointsCost] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [isDay7Draw, setIsDay7Draw] = useState(false);
  const [maxDailySpins, setMaxDailySpins] = useState('');
  const [totalSpins, setTotalSpins] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && draw) {
      // Editing existing draw
      setName(draw.name);
      setDescription(draw.description || '');
      setImageUrl(draw.image_url || '');
      setPointsCost(draw.points_cost.toString());
      setIsActive(draw.is_active);
      setIsDay7Draw(draw.is_day7_draw);
      setMaxDailySpins(draw.max_daily_spins_per_user?.toString() || '');
      setTotalSpins(draw.total_available_spins?.toString() || '');
    } else if (visible) {
      // Creating new draw
      resetForm();
    }
  }, [visible, draw]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setImageUrl('');
    setPointsCost('0');
    setIsActive(true);
    setIsDay7Draw(false);
    setMaxDailySpins('');
    setTotalSpins('');
  };

  const handleIsDay7Change = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsDay7Draw(value);

    // Day 7 draws must be free
    if (value) {
      setPointsCost('0');
    }
  };

  const handleIsActiveChange = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsActive(value);
  };

  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a name for the lucky draw');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    }

    const points = parseInt(pointsCost);
    if (isNaN(points) || points < 0) {
      Alert.alert('Validation Error', 'Points cost must be a valid number (0 or greater)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    }

    if (isDay7Draw && points !== 0) {
      Alert.alert('Validation Error', 'Day 7 lucky draw must be free (0 points)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    }

    if (maxDailySpins && (isNaN(parseInt(maxDailySpins)) || parseInt(maxDailySpins) < 1)) {
      Alert.alert('Validation Error', 'Max daily spins must be a valid number (1 or greater)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    }

    if (totalSpins && (isNaN(parseInt(totalSpins)) || parseInt(totalSpins) < 1)) {
      Alert.alert('Validation Error', 'Total spins must be a valid number (1 or greater)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      image_url: imageUrl.trim() || undefined,
      points_cost: parseInt(pointsCost),
      is_active: isActive,
      is_day7_draw: isDay7Draw,
      max_daily_spins_per_user: maxDailySpins ? parseInt(maxDailySpins) : undefined,
      total_available_spins: totalSpins ? parseInt(totalSpins) : undefined,
    };

    try {
      if (draw) {
        // Update existing draw
        await api.put(`/merchant/lucky-draws/${draw.id}`, payload);
      } else {
        // Create new draw
        await api.post('/merchant/lucky-draws', payload);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success',
        draw ? 'Lucky draw updated successfully' : 'Lucky draw created successfully'
      );
      onClose();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save lucky draw');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={draw ? 'Edit Lucky Draw' : 'Create Lucky Draw'}
      scrollable={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            {/* Name */}
            <Input
              label="Name *"
              value={name}
              onChangeText={setName}
              placeholder="Enter lucky draw name"
            />

            {/* Description */}
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description (optional)"
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }}
            />

            {/* Image URL */}
            <Input
              label="Image URL"
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://example.com/image.jpg"
              autoCapitalize="none"
              keyboardType="url"
            />

            {/* Day 7 Draw Toggle */}
            <View style={styles.switchField}>
              <View style={styles.switchLabelContainer}>
                <Text style={[styles.label, { color: theme.text }]}>Day 7 Check-in Draw</Text>
                <Text style={[styles.switchHint, { color: theme.icon }]}>
                  Only one Day 7 draw allowed per merchant
                </Text>
              </View>
              <Switch
                value={isDay7Draw}
                onValueChange={handleIsDay7Change}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            </View>

            {/* Points Cost */}
            <Input
              label={`Points Cost ${isDay7Draw ? '(Must be 0 for Day 7)' : ''}`}
              value={pointsCost}
              onChangeText={setPointsCost}
              placeholder="0"
              keyboardType="number-pad"
              editable={!isDay7Draw}
              style={isDay7Draw ? { opacity: 0.5 } : {}}
            />

            {/* Max Daily Spins */}
            <Input
              label="Max Daily Spins Per User"
              value={maxDailySpins}
              onChangeText={setMaxDailySpins}
              placeholder="Unlimited (leave empty)"
              keyboardType="number-pad"
            />
            <Text style={[styles.hint, { color: theme.icon }]}>Leave empty for unlimited daily spins</Text>

            {/* Total Available Spins */}
            <View style={{ marginTop: 20 }}>
              <Input
                label="Total Available Spins"
                value={totalSpins}
                onChangeText={setTotalSpins}
                placeholder="Unlimited (leave empty)"
                keyboardType="number-pad"
              />
              <Text style={[styles.hint, { color: theme.icon }]}>Leave empty for unlimited total spins</Text>
            </View>


            {/* Active Toggle */}
            <View style={styles.switchField}>
              <View style={styles.switchLabelContainer}>
                <Text style={[styles.label, { color: theme.text }]}>Active</Text>
                <Text style={[styles.switchHint, { color: theme.icon }]}>
                  Users can only spin active lucky draws
                </Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={handleIsActiveChange}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <View style={styles.buttonRow}>
            <View style={styles.buttonHalf}>
              <Button variant="outline" title="Cancel" onPress={onClose} disabled={loading} />
            </View>
            <View style={styles.buttonHalf}>
              <Button variant="primary" title={draw ? 'Update' : 'Create'} onPress={handleSubmit} loading={loading} />
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: -10, // Pull closer to input because Input component has its own bottom margin
    marginBottom: 10,
    marginLeft: 4,
  },
  switchField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
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
