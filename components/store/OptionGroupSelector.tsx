import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

interface OptionItem {
  id: string;
  name: string;
  price_adjustment: number;
}

interface OptionGroup {
  id: string;
  name: string;
  min_selection: number;
  max_selection: number;
  items: OptionItem[];
}

interface OptionGroupSelectorProps {
  group: OptionGroup;
  selectedOptionIds: string[];
  onOptionToggle: (optionId: string) => void;
}

export const OptionGroupSelector: React.FC<OptionGroupSelectorProps> = ({
  group,
  selectedOptionIds,
  onOptionToggle,
}) => {
  const isRadio = group.max_selection === 1;
  const isRequired = group.min_selection >= 1;
  const canSelectMore = selectedOptionIds.length < group.max_selection;

  const handleOptionPress = (optionId: string) => {
    const isSelected = selectedOptionIds.includes(optionId);

    // For radio buttons, always allow selection (will deselect others)
    if (isRadio) {
      Haptics.selectionAsync();
      onOptionToggle(optionId);
      return;
    }

    // For checkboxes
    if (isSelected) {
      // Allow deselection
      Haptics.selectionAsync();
      onOptionToggle(optionId);
    } else if (canSelectMore) {
      // Allow selection if under max
      Haptics.selectionAsync();
      onOptionToggle(optionId);
    } else {
      // Max selections reached
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  return (
    <View style={styles.container}>
      {/* Group Header */}
      <Text style={styles.groupName}>
        {group.name}
        {isRequired && <Text style={styles.required}> *</Text>}
      </Text>

      {/* Options Pills */}
      <View style={styles.pillsContainer}>
        {group.items.map((option) => {
          const isSelected = selectedOptionIds.includes(option.id);
          const canSelect = isSelected || canSelectMore;

          // For radio buttons, always allow selection (can switch between options)
          const isDisabled = !isRadio && !isSelected && !canSelectMore;

          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.pill,
                isSelected && styles.pillSelected,
                isDisabled && styles.pillDisabled,
              ]}
              onPress={() => handleOptionPress(option.id)}
              activeOpacity={0.7}
              disabled={isDisabled}
            >
              <Text
                style={[
                  styles.pillText,
                  isSelected && styles.pillTextSelected,
                  !canSelect && styles.pillTextDisabled,
                ]}
              >
                {option.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// Use light theme colors
const theme = Colors.light;

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  groupName: {
    fontSize: 17,
    fontFamily: Fonts.semibold,
    color: '#000000',
    marginBottom: 12,
  },
  required: {
    color: '#EB5757',
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pillSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.secondary,
  },
  pillDisabled: {
    opacity: 0.4,
  },
  pillText: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: '#666666',
  },
  pillTextSelected: {
    color: theme.secondary,
    fontFamily: Fonts.semibold,
  },
  pillTextDisabled: {
    color: '#999999',
  },
});
