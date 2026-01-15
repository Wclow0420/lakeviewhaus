import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

interface RewardBadgeProps {
    type: string;          // e.g. 'free_item', 'discount_percentage', 'discount_fixed'
    value?: number;        // e.g. 20, 10
    variant?: 'overlay' | 'inline'; // 'overlay' adds absolute positioning styles
    style?: ViewStyle;
}

export const RewardBadge: React.FC<RewardBadgeProps> = ({
    type,
    value,
    variant = 'inline',
    style
}) => {
    // Only hooks inside the component
    // Assuming color scheme doesn't change badge logic much, but we might want text color consistency

    let label = '';
    let color = '#4CAF50'; // Default Green

    switch (type) {
        case 'free_item':
            label = 'FREE';
            color = '#4CAF50'; // Green
            break;
        case 'discount_percentage':
            label = `${value || 0}% OFF`;
            color = '#FF9800'; // Orange
            break;
        case 'discount_fixed':
            label = `RM ${value || 0} OFF`;
            color = '#2196F3'; // Blue
            break;
        default:
            return null;
    }

    const containerStyle = variant === 'overlay' ? styles.overlay : styles.inline;

    return (
        <View style={[containerStyle, { backgroundColor: color }, style]}>
            <Text style={styles.text}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    inline: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
    },
    overlay: {
        position: 'absolute',
        top: 8,
        left: 8,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        zIndex: 5,
        elevation: 2,
    },
    text: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
        textTransform: 'uppercase',
    }
});
