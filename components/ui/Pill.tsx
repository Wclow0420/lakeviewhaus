import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface PillProps {
    label: string;
    selected: boolean;
    onPress: () => void;
    onLongPress?: () => void;
    activeColor?: string;
    inactiveColor?: string;
    style?: ViewStyle;
}

export const Pill: React.FC<PillProps> = ({
    label,
    selected,
    onPress,
    onLongPress,
    activeColor,
    inactiveColor,
    style
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const bg = selected ? (activeColor || theme.text) : (inactiveColor || theme.card);
    const text = selected ? theme.background : theme.text;
    const border = selected ? (activeColor || theme.text) : theme.border;

    const handlePress = () => {
        Haptics.selectionAsync();
        onPress();
    };

    const handleLongPress = () => {
        if (onLongPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onLongPress();
        }
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            onLongPress={onLongPress ? handleLongPress : undefined}
            style={[
                styles.pill,
                {
                    backgroundColor: bg,
                    borderColor: border,
                    borderWidth: 1
                },
                style
            ]}
        >
            <Text style={[styles.label, { color: text }]}>{label}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    pill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
    }
});
